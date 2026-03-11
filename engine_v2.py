"""
Personal Color Engine v2.0
--------------------------
Key changes from v1 (engine.py):
  1. PIPELINE SPLIT: Season classification uses RAW (un-white-balanced) stats
     to preserve true warm/cool undertone signal. Deck scoring still uses
     WB-corrected stats for lighting-invariant palette matching.
  2. CIRCULAR HUE MEDIAN: Uses sin/cos decomposition instead of linear median
     to correctly handle hue values crossing the 0°/360° boundary.
  3. DETERMINISTIC SAMPLING: Fixed random seed for reproducible results.
  4. RELATIVE BEARD FILTER: Thresholds are relative to the person's own skin
     median, preventing dark-skin discrimination.

Existing v1 engine (engine.py) is UNTOUCHED and remains the production default.
"""
import json
import math
import torch
import numpy as np
from PIL import Image
import personal_color_nodes as nodes
from face_mask import FaceParser


def _circular_median_deg(angles_deg: np.ndarray) -> float:
    """Compute median direction on a circle using sin/cos decomposition.
    
    Standard np.median() on circular data (e.g., hue in degrees) gives wrong
    results when values straddle 0°/360°. For example, median([350, 355, 5, 10])
    would incorrectly return ~177° instead of ~0°.
    """
    if angles_deg.size == 0:
        return 0.0
    rads = np.deg2rad(angles_deg)
    # Use median of sin/cos components (more robust than mean for outliers)
    med_sin = float(np.median(np.sin(rads)))
    med_cos = float(np.median(np.cos(rads)))
    return (math.degrees(math.atan2(med_sin, med_cos)) + 360.0) % 360.0


def _robust_skin_stats_v2(hexes: list) -> dict:
    """Same as nodes.robust_skin_stats but with circular hue median fix."""
    labs = np.array([nodes.hex_to_lab(h) for h in hexes], dtype=np.float32)
    Ls, as_, bs = labs[:, 0], labs[:, 1], labs[:, 2]
    Cs = np.sqrt(as_**2 + bs**2)
    hs = (np.degrees(np.arctan2(bs, as_)) + 360.0) % 360.0

    Lm, Lmad = nodes.median_and_mad(Ls)
    am, amad = nodes.median_and_mad(as_)
    bm, bmad = nodes.median_and_mad(bs)
    Cm, Cmad = nodes.median_and_mad(Cs)
    
    # v2 FIX: circular hue median
    hm = _circular_median_deg(hs)

    ita = nodes.ITA(Lm, bm)
    return dict(
        L=round(Lm, 3), a=round(am, 3), b=round(bm, 3),
        C=round(Cm, 3), h=round(hm, 2), ITA=round(ita, 2),
        spread=dict(L=Lmad, a=amad, b=bmad, C=Cmad),
        n=len(hexes),
    )


class PersonalColorEngineV2:
    """v2 engine with pipeline-split fix for undertone classification."""

    VERSION = "v2.0"

    def __init__(self, face_model_path="face_parsing/models/model.pth"):
        self.face_parser = FaceParser(face_model_path)

        # Instantiate nodes (same as v1)
        self.refine_mask = nodes.RefineSkinMask()
        self.skin_anchor = nodes.SkinAnchor()
        self.season_clf = nodes.SeasonFromStatsConf()
        self.deck_lch_plus = nodes.MakeColorDeckLChPlus()
        self.deck_classic = nodes.PC_MakeColorDeck_Classic()
        self.drape_score = nodes.PC_DrapeScore()
        self.merge_decks = nodes.PC_MergeDecksScore()
        self.score_neutrals = nodes.ScoreNeutrals()
        self.drape_score_k = nodes.DrapeScoreK()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def pil_to_tensor(self, img_pil):
        return nodes.pil_to_tensor(img_pil)

    def tensor_to_pil(self, img_tensor):
        return nodes.tensor_to_pil(img_tensor)

    def _build_hex_deterministic(self, image_tensor, mask_tensor,
                                  stride=2, max_pixels=8000, seed=42):
        """Same as SkinAnchor._build_hex_from_image_mask but with FIXED seed."""
        im = nodes.tensor_to_pil(image_tensor).convert("RGB")
        mk = nodes.tensor_to_pil(mask_tensor).convert("L")
        arr = np.asarray(im).astype(np.uint8)
        m = (np.asarray(mk).astype(np.float32) / 255.0) > 0.5

        sampled = m[::stride, ::stride]
        yy, xx = np.where(sampled)
        if yy.size == 0:
            return []

        yy = (yy * stride).clip(0, arr.shape[0] - 1)
        xx = (xx * stride).clip(0, arr.shape[1] - 1)

        if yy.size > max_pixels:
            rng = np.random.RandomState(seed)  # v2 FIX: deterministic
            idx = rng.choice(yy.size, size=max_pixels, replace=False)
            yy, xx = yy[idx], xx[idx]

        pixels = arr[yy, xx, :]
        return [nodes.rgb_to_hex(int(r), int(g), int(b)) for r, g, b in pixels]

    def _refine_mask_relative(self, image_tensor, mask_tensor,
                               raw_hex_list, texture_tau=0.12):
        """Beard filter with thresholds RELATIVE to the person's own skin median.
        
        v1 uses absolute L<35, C<18 which discriminates against dark skin.
        v2 uses: L < median_L - 20  AND  C < median_C - 8
        """
        if not raw_hex_list:
            return self.refine_mask.run(image_tensor, mask_tensor)

        # Get the person's own skin median stats first
        raw_stats = _robust_skin_stats_v2(raw_hex_list)
        median_L = raw_stats.get("L", 65.0)
        median_C = raw_stats.get("C", 20.0)

        # Thresholds relative to this person's skin
        beard_L_thresh = max(20.0, median_L - 20.0)
        beard_C_thresh = max(6.0, median_C - 8.0)

        # Run the beard filter manually with relative thresholds
        im = nodes.tensor_to_pil(image_tensor).convert("RGB")
        mk = nodes.tensor_to_pil(mask_tensor).convert("L")
        w, h = im.size
        arr = np.asarray(im).astype(np.float32)
        m_arr = np.asarray(mk).astype(np.float32) / 255.0

        flat = arr.reshape(-1, 3)
        labs = np.array([nodes.rgb_to_lab(*px) for px in flat], dtype=np.float32)
        Ls, as_, bs = labs[:, 0], labs[:, 1], labs[:, 2]
        Cs = np.sqrt(as_**2 + bs**2)

        keep = m_arr.reshape(-1) > 0.5

        # v2 FIX: relative thresholds instead of absolute
        cond_dark_lowc = (Ls < beard_L_thresh) & (Cs < beard_C_thresh)
        # Cool fiber detection stays the same (b<2, a<6, C<14) — this is
        # about detecting grayish beard fiber, not skin tone
        cond_cool_fiber = (bs < 2) & (as_ < 6) & (Cs < 14)
        beard = cond_dark_lowc | cond_cool_fiber

        # Texture (Laplacian)
        from PIL import ImageOps, ImageFilter
        gray = ImageOps.grayscale(im)
        g = np.asarray(gray).astype(np.float32) / 255.0
        try:
            from scipy.signal import convolve2d
            k = np.array([[0, -1, 0], [-1, 4, -1], [0, -1, 0]], dtype=np.float32)
            tex = np.abs(convolve2d(g, k, mode="same", boundary="symm"))
        except ImportError:
            edges_im = Image.fromarray((g * 255).astype(np.uint8)).filter(
                ImageFilter.FIND_EDGES
            )
            tex = np.abs(np.asarray(edges_im).astype(np.float32) / 255.0)

        tex = tex / tex.max() if np.max(tex) > 0 else tex
        high_tex = tex.reshape(-1) > texture_tau

        drop = keep & (beard | high_tex)
        keep2 = keep & (~drop)
        out = (keep2.reshape(h, w).astype(np.float32)) * 255.0
        out_img = Image.fromarray(out.astype(np.uint8), mode="L")

        dbg = dict(
            pct_removed=round(100.0 * drop.sum() / max(1, keep.sum()), 2),
            pixels_kept=int(keep2.sum()),
            pixels_dropped=int(drop.sum()),
            beard_L_thresh=round(beard_L_thresh, 1),
            beard_C_thresh=round(beard_C_thresh, 1),
            note="v2 relative thresholds",
        )
        return (nodes.pil_to_tensor(out_img), json.dumps(dbg))

    # ------------------------------------------------------------------
    # Main pipeline
    # ------------------------------------------------------------------
    def analyze_image(self, image_input, tuning_params=None):
        """
        v2 pipeline — key difference: season classification uses RAW stats.

        image_input: PIL Image or path
        tuning_params: dict with keys like 'undertone_tau', 'wb_max_deltaE'
        Returns: Dict fully populated
        """
        params = tuning_params or {}

        if hasattr(image_input, "convert"):
            image = image_input.convert("RGB")
        else:
            image = Image.open(str(image_input)).convert("RGB")

        w, h = image.size

        # ------- 1. Face Parsing (same as v1) -------
        raw_mask_pil = self.face_parser.get_mask(image)
        image_tensor = self.pil_to_tensor(image)
        mask_tensor = self.pil_to_tensor(raw_mask_pil.convert("RGB"))

        # ------- 2. Initial pixel sampling (before refinement) -------
        # We need raw pixels for relative beard thresholds
        initial_hex_list = self._build_hex_deterministic(image_tensor, mask_tensor)

        # ------- 3. Refine Mask (v2: relative beard thresholds) -------
        refined_mask_tensor, refine_debug = self._refine_mask_relative(
            image_tensor, mask_tensor, initial_hex_list,
            texture_tau=float(params.get("texture_tau", 0.12)),
        )

        # ------- 4. Final skin pixel sampling (deterministic) -------
        raw_hex_list = self._build_hex_deterministic(
            image_tensor, refined_mask_tensor
        )
        raw_hex_str = ",".join(raw_hex_list)

        # ------- 5A. Actual skin stats (No WB) — v2 uses circular hue -------
        stats_actual = _robust_skin_stats_v2(raw_hex_list) if raw_hex_list else {}
        stats_actual_json = json.dumps(stats_actual)
        actual_median_hex = nodes.lab_to_hex(
            stats_actual.get("L", 0), stats_actual.get("a", 0), stats_actual.get("b", 0)
        )
        actual_hue = stats_actual.get("h", 0.0)

        # ------- 5B. Normalized stats (WB) — for deck scoring only -------
        wb_max = float(params.get("wb_max_deltaE", 6.0))
        stats_norm_json, L, a, b, C, h_val, ITA, norm_median_hex, wb_hex_str = (
            self.skin_anchor.run(
                image_tensor, refined_mask_tensor,
                hex_list=raw_hex_str, wb_on=True, max_deltaE=wb_max,
            )
        )

        # =====================================================================
        # v2 CORE FIX: Season classification on RAW stats, NOT WB-corrected
        # =====================================================================
        # In v1, season_clf.run(stats_norm_json) — WB has already shifted a*/b*
        # toward zero, destroying warm undertone signal.
        # In v2, we classify on the original, unmodified skin statistics.
        season_res = self.season_clf.run(stats_actual_json, tuning_params=params)
        season4, season12, undertone, depth, clarity, confidence, reasons = season_res

        # ------- 6. Build Decks (still uses WB-corrected stats) -------
        deck_adaptive_str, = self.deck_lch_plus.run(stats_json=stats_norm_json)

        deck_classic_str, = self.deck_classic.run(
            adaptive=True, stats_json=stats_norm_json,
            hues="0:360:15", L_list="+15,-10", C_list="22,48",
            include_neutrals=False,
        )

        # ------- 7. Score Decks (WB-corrected stats for perceptual matching) -------
        scores_adaptive_json, _ = self.drape_score.run(
            deck_adaptive_str, stats_norm_json, season12
        )
        scores_classic_json, _ = self.drape_score.run(
            deck_classic_str, stats_norm_json, season12
        )

        # ------- 8. Merge & Select Top 10 -------
        merged_json, merged_hex_top10 = self.merge_decks.run(
            scores_classic_json, scores_adaptive_json,
            top_k=10, hue_nms_deg=18.0, dl_thresh=8.0, dc_thresh=6.0,
        )
        best_colors = merged_hex_top10.split(",")

        # ------- 9. Neutrals -------
        neutrals_json, neutrals_hex_top5 = self.score_neutrals.run(
            stats_norm_json, season12=season12, top_k=5, diversify=True,
        )
        neutrals = neutrals_hex_top5.split(",")

        # ------- 10. Avoid Colors -------
        _, avoid_hex_str, _, _ = self.drape_score_k.run(
            deck_classic_str, stats_norm_json, season12, avoid_k=10,
        )
        avoid_colors = avoid_hex_str.split(",")

        # ------- Construct Output -------
        return {
            "skin": {
                "hex_actual": actual_median_hex,
                "hex_normalized": norm_median_hex,
                "hue_deg": round(actual_hue, 1),
            },
            "season": {
                "season4": season4,
                "season12": season12,
                "confidence": round(confidence, 2),
                "undertone": undertone,
                "depth": depth,
                "clarity": clarity,
            },
            "best_colors": best_colors,
            "neutrals": neutrals,
            "avoid_colors": avoid_colors,
            "debug": {
                "reasons": [reasons],
                "version": self.VERSION,
                "stats_actual": stats_actual,
                "stats_norm": json.loads(stats_norm_json),
                "refine_debug": json.loads(refine_debug),
                "v2_changes": [
                    "Season classified on RAW stats (not WB-corrected)",
                    "Circular hue median",
                    "Deterministic pixel sampling (seed=42)",
                    "Relative beard filter thresholds",
                ],
            },
        }
