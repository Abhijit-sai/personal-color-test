import json
import torch
import numpy as np
from PIL import Image
import personal_color_nodes as nodes
from face_mask import FaceParser

class PersonalColorEngine:
    def __init__(self, face_model_path="face_parsing/models/model.pth"):
        self.face_parser = FaceParser(face_model_path)
        
        # Instantiate nodes
        self.refine_mask = nodes.RefineSkinMask()
        self.skin_anchor = nodes.SkinAnchor()
        self.season_clf = nodes.SeasonFromStatsConf()
        self.deck_lch_plus = nodes.MakeColorDeckLChPlus()
        self.deck_classic = nodes.PC_MakeColorDeck_Classic()
        self.drape_score = nodes.PC_DrapeScore()
        # self.drape_score_k = nodes.DrapeScoreK() # If needed
        self.merge_decks = nodes.PC_MergeDecksScore()
        self.score_neutrals = nodes.ScoreNeutrals()
        self.drape_score_k = nodes.DrapeScoreK() # Used for avoid colors

    def pil_to_tensor(self, img_pil):
        # Convert PIL to [1, H, W, 3] float tensor
        return nodes.pil_to_tensor(img_pil)

    def tensor_to_pil(self, img_tensor):
        return nodes.tensor_to_pil(img_tensor)

    def analyze_image(self, image_input, tuning_params=None):
        """
        image_input: PIL Image or path
        tuning_params: dict with keys like 'undertone_tau', 'wb_max_deltaE'
        Returns: Dict fully populated
        """
        params = tuning_params or {}
        
        if isinstance(image_input, str):
            image = Image.open(image_input).convert("RGB")
        else:
            image = image_input.convert("RGB")

        w, h = image.size
        # 1. Face Parsing
        # Mask is PIL L
        raw_mask_pil = self.face_parser.get_mask(image)
        
        # Convert to tensors for nodes
        image_tensor = self.pil_to_tensor(image)
        mask_tensor = self.pil_to_tensor(raw_mask_pil.convert("RGB"))

        # 2. Refine Mask
        # Returns (tensor, debug_json)
        refined_mask_tensor, refine_debug = self.refine_mask.run(image_tensor, mask_tensor)
        
        # 3. Skin Stats (Normal & Actual)
        raw_hex_list = self.skin_anchor._build_hex_from_image_mask(image_tensor, refined_mask_tensor)
        raw_hex_str = ",".join(raw_hex_list)

        # A) Actual (No WB)
        stats_actual_json, actual_median_hex = nodes.HexListSkinStats().run(raw_hex_str)
        s_act = json.loads(stats_actual_json)
        actual_hue = s_act.get("h", 0.0)

        # B) Normalized (WB)
        # Use param override if present
        wb_max = float(params.get("wb_max_deltaE", 6.0))
        
        stats_norm_json, L, a, b, C, h, ITA, norm_median_hex, wb_hex_str = self.skin_anchor.run(
            image_tensor, refined_mask_tensor, hex_list=raw_hex_str, wb_on=True, max_deltaE=wb_max
        )

        # 4. Season Classification
        season_res = self.season_clf.run(stats_norm_json, tuning_params=params)
        # (fam, twelve, undertone, depth, clarity, confidence, reasons)
        season4, season12, undertone, depth, clarity, confidence, reasons = season_res

        # 5. Build Decks
        # Deck 1: LCh Plus (Adaptive) - uses stats
        deck_adaptive_str, = self.deck_lch_plus.run(stats_json=stats_norm_json)
        
        # Deck 2: Classic (Fixed/Generic) - Standard wide gamut to check against season
        # Using default params: hues=0:360:15, L_list=+15,-10 (relative?), C_list=22,48
        # PRD implies using this to find best colors.
        # If I use defaults, it uses Adaptive L/C if stats provided?
        # Let's pass stats_json="" to force generic defaults if we want "Classic" to be broadly representative?
        # Or if "PC_MakeColorDeck_Classic" implies traditional seasonal palettes, maybe I should use PC_FixedSeasonDeck?
        # Re-reading PRD: "Build color decks using MakeColorDeckLChPlus and PC_MakeColorDeck_Classic."
        # If I check the node inputs for PC_MakeColorDeck_Classic, it takes 'adaptive' bool. Default True.
        # I'll enable adaptive for better results, using the formatted stats.
        deck_classic_str, = self.deck_classic.run(adaptive=True, stats_json=stats_norm_json, 
                                                hues="0:360:15", L_list="+15,-10", C_list="22,48", include_neutrals=False)

        # 6. Score Decks
        # Use PC_DrapeScore (v3 default)
        scores_adaptive_json, _ = self.drape_score.run(deck_adaptive_str, stats_norm_json, season12)
        scores_classic_json, _ = self.drape_score.run(deck_classic_str, stats_norm_json, season12)

        # 7. Merge & Select Top 10
        # PC_MergeDecksScore
        merged_json, merged_hex_top10 = self.merge_decks.run(
            scores_classic_json, scores_adaptive_json, top_k=10, 
            hue_nms_deg=18.0, dl_thresh=8.0, dc_thresh=6.0
        )
        best_colors = merged_hex_top10.split(',')

        # 8. Neutrals
        # ScoreNeutrals
        neutrals_json, neutrals_hex_top5 = self.score_neutrals.run(stats_norm_json, season12=season12, top_k=5, diversify=True)
        neutrals = neutrals_hex_top5.split(',')

        # 9. Avoid Colors
        # Use DrapeScoreK on the generic Classic deck (it covers wide range).
        # We ask for avoid_k=10.
        # We pass the same stats and season.
        # DrapeScoreK returns (top_hex, avoid_hex, scores_json, ranked)
        _, avoid_hex_str, _, _ = self.drape_score_k.run(deck_classic_str, stats_norm_json, season12, avoid_k=10)
        avoid_colors = avoid_hex_str.split(',')

        # Construct Output
        return {
            "skin": {
                "hex_actual": actual_median_hex,
                "hex_normalized": norm_median_hex,
                "hue_deg": round(actual_hue, 1)
            },
            "season": {
                "season4": season4,
                "season12": season12,
                "confidence": round(confidence, 2),
                "undertone": undertone,
                "depth": depth,
                "clarity": clarity
            },
            "best_colors": best_colors,
            "neutrals": neutrals,
            "avoid_colors": avoid_colors,
            "debug": {
                "reasons": [reasons],
                "version": "v1.0",
                "stats_actual": json.loads(stats_actual_json),
                "stats_norm": json.loads(stats_norm_json),
                "refine_debug": json.loads(refine_debug)
            }
        }
