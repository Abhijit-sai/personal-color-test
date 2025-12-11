# personal_color_nodes.py
# -----------------------------------------------------------------------------
# Personal Color Test – ComfyUI Custom Nodes
# Backward-compatible full build: preserves 19 original nodes + adds new ones.
# Implements:
#  - Robust skin stats (median+MAD, ITA)
#  - Skin-only white balance (ΔE clamp)
#  - Beard/hairline color+texture removal
#  - Deck builders (HSV + LCh + LCh+)
#  - Reweighted drape scoring (season-hue, contrast, chroma, anchors, neutrals)
#  - Warm/Cool A/B drape override
#  - Merge fixed+adaptive decks then diversify (Hue NMS + farthest-point LCh)
#  - Grids/contact sheet renderers
#  - Neutrals scoring & face–neutral sanity
#
# NOTE: All original node *names and sockets* are retained. New nodes are prefixed "PC_".
# -----------------------------------------------------------------------------

from __future__ import annotations
import math, re, json, itertools
from typing import List, Tuple, Dict, Any
import numpy as np

try:
    import torch
    from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageFilter
except Exception:
    torch = None

# =============================== Color helpers ===============================

def clamp01(x): return max(0.0, min(1.0, float(x)))

def hex_to_rgb(hexs: str) -> Tuple[int,int,int]:
    h = hexs.strip().lstrip('#')
    if len(h) == 3: h = ''.join([c*2 for c in h])
    return tuple(int(h[i:i+2], 16) for i in (0,2,4))

def rgb_to_hex(r:int,g:int,b:int)->str:
    return '#%02x%02x%02x' % (int(round(r)), int(round(g)), int(round(b)))

def srgb_to_linear(u: float) -> float:
    u = u/255.0
    return u/12.92 if u<=0.04045 else ((u+0.055)/1.055)**2.4

def linear_to_srgb(u: float) -> float:
    return 12.92*u if u<=0.0031308 else 1.055*(u**(1/2.4)) - 0.055

def rgb_to_xyz(r,g,b):
    R,G,B = map(srgb_to_linear, (r,g,b))
    X = 0.4124564*R + 0.3575761*G + 0.1804375*B
    Y = 0.2126729*R + 0.7151522*G + 0.0721750*B
    Z = 0.0193339*R + 0.1191920*G + 0.9503041*B
    return X,Y,Z

def xyz_to_lab(X,Y,Z):
    Xn, Yn, Zn = 0.95047, 1.00000, 1.08883
    def f(t): return t**(1/3) if t>0.008856 else (7.787*t + 16/116)
    fx, fy, fz = f(X/Xn), f(Y/Yn), f(Z/Zn)
    L = 116*fy - 16
    a = 500*(fx-fy)
    b = 200*(fy-fz)
    return L,a,b

def rgb_to_lab(r,g,b): return xyz_to_lab(*rgb_to_xyz(r,g,b))
def hex_to_lab(h: str) -> Tuple[float,float,float]: return rgb_to_lab(*hex_to_rgb(h))

def lab_to_lch(L,a,b):
    C = math.sqrt(a*a + b*b)
    h = (math.degrees(math.atan2(b, a)) + 360.0) % 360.0
    return L,C,h

def lab_to_rgb(L,a,b):
    # Lab -> XYZ
    Y = (L + 16)/116.0
    X = a/500.0 + Y
    Z = Y - b/200.0
    def invf(t): return t**3 if t**3>0.008856 else (t-16/116)/7.787
    Xn, Yn, Zn = 0.95047, 1.0000, 1.08883
    X = Xn * invf(X); Y = Yn * invf(Y); Z = Zn * invf(Z)
    # XYZ -> sRGB
    R =  3.2404542*X - 1.5371385*Y - 0.4985314*Z
    G = -0.9692660*X + 1.8760108*Y + 0.0415560*Z
    B =  0.0556434*X - 0.2040259*Y + 1.0572252*Z
    r = int(round(255*clamp01(linear_to_srgb(R))))
    g = int(round(255*clamp01(linear_to_srgb(G))))
    b = int(round(255*clamp01(linear_to_srgb(B))))
    return r,g,b

def lab_to_hex(L, a, b):
    # Lab(D65)->XYZ->linear sRGB->sRGB with gamut clip and zero-padded hex
    # constants
    REF_X, REF_Y, REF_Z = 95.047, 100.0, 108.883
    y = (L + 16.0) / 116.0
    x = a / 500.0 + y
    z = y - b / 200.0
    def f_inv(t):
        return t**3 if t**3 > 0.008856 else (t - 16.0/116.0) / 7.787
    X = REF_X * f_inv(x)
    Y = REF_Y * f_inv(y)
    Z = REF_Z * f_inv(z)
    # XYZ -> linear sRGB (D65)
    r =  3.2406*X/100.0 + -1.5372*Y/100.0 + -0.4986*Z/100.0
    g = -0.9689*X/100.0 +  1.8758*Y/100.0 +  0.0415*Z/100.0
    b_ =  0.0557*X/100.0 + -0.2040*Y/100.0 +  1.0570*Z/100.0
    # simple gamut clip in linear space
    r = min(max(r, 0.0), 1.0)
    g = min(max(g, 0.0), 1.0)
    b_ = min(max(b_,0.0), 1.0)
    # linear->gamma sRGB
    def to_srgb(u): return (12.92*u if u <= 0.0031308 else 1.055*(u**(1/2.4)) - 0.055)
    R = int(round(255.0*to_srgb(r)))
    G = int(round(255.0*to_srgb(g)))
    B = int(round(255.0*to_srgb(b_)))
    return "#{:02x}{:02x}{:02x}".format(R,G,B)

def deltaE76(l1,l2): return math.sqrt(sum((x-y)**2 for x,y in zip(l1,l2)))

def ITA(L,b):
    denom = b if abs(b)>1e-6 else (1e-6 if b>=0 else -1e-6)
    return math.degrees(math.atan((L-50.0)/denom))

def parse_hex_list(s: str) -> List[str]:
    if isinstance(s, list): return s
    toks = re.split(r'[\s,;]+', (s or '').strip())
    out = []
    for t in toks:
        if not t: continue
        tt = t if t.startswith('#') else '#'+t
        if re.fullmatch(r'#?[0-9a-fA-F]{6}', tt): out.append(tt.lower())
    return out

def median_and_mad(arr: np.ndarray) -> Tuple[float,float]:
    if arr.size==0: return 0.0, 0.0
    med = float(np.median(arr))
    mad = float(np.median(np.abs(arr - med)))
    return med, mad

# =============================== Image helpers ===============================

def tensor_to_pil(img_t):
    if img_t is None: return None
    if isinstance(img_t, Image.Image): return img_t
    if isinstance(img_t, torch.Tensor):
        t = img_t[0].detach().cpu().clamp(0,1).numpy()
        t = (t*255).astype(np.uint8)
        if t.shape[-1]==1: t = np.repeat(t, 3, axis=-1)
        return Image.fromarray(t)
    raise TypeError("Unsupported image type")

def pil_to_tensor(im):
    if torch is None: return im
    arr = np.asarray(im).astype(np.float32)/255.0
    if arr.ndim==2: arr = np.stack([arr,arr,arr], axis=-1)
    t = torch.from_numpy(arr)[None, ...]
    return t

# ============================== Season knowledge =============================

SEASON_GROUPS = {
    "Light Spring":  [(20, 95), (320, 350)],
    "Warm (True) Spring": [(25, 100), (330, 355)],
    "Bright Spring": [(15, 95), (300, 355)],

    "Light Summer":  [(160, 260)],
    "Cool (True) Summer": [(170, 260)],
    "Soft Summer":  [(160, 250)],

    "Soft Autumn":  [(30, 120)],
    "Warm (True) Autumn": [(25, 120)],
    "Dark Autumn":  [(20, 130), (330, 350)],

    "Dark Winter":  [(190, 300)],
    "Cool (True) Winter": [(180, 300)],
    "Bright Winter": [(180, 330)],
}

NEUTRALS = [
    "#ffffff", "#f5f5f5", "#e6e6e6", "#c0c0c0", "#808080", "#404040",
    "#000000", "#0d1b2a", "#1f305e", "#2f3e46", "#a58b6f", "#d2b48c"
]

def hue_distance_to_bands(h: float, bands: List[Tuple[float,float]]) -> float:
    def dist_to_interval(x,a,b):
        if a<=b:
            if a<=x<=b: return 0.0
            return min(abs(x-a), abs(x-b))
        else:
            if x>=a or x<=b: return 0.0
            return min(abs(x-a), abs(x-b))
    return min(dist_to_interval(h,*band) for band in bands)

def _keep_useful(hx):
    kept = []
    for h in hx:
        L,a,b = hex_to_lab(h)
        _,C,_ = lab_to_lch(L,a,b)
        if C >= 8.0:             # discard muddy/edge pixels
            kept.append(h)
    return kept or hx

# =============================== Core logic ==================================

def robust_skin_stats(hexes: List[str]) -> Dict[str,Any]:
    labs = np.array([hex_to_lab(h) for h in hexes], dtype=np.float32)
    Ls, as_, bs = labs[:,0], labs[:,1], labs[:,2]
    Cs = np.sqrt(as_**2 + bs**2)
    hs = (np.degrees(np.arctan2(bs, as_))+360.0)%360.0
    Lm,Lmad = median_and_mad(Ls); am,amad = median_and_mad(as_)
    bm,bmad = median_and_mad(bs); Cm,Cmad = median_and_mad(Cs)
    hm,_ = median_and_mad(hs)
    ita = ITA(Lm, bm)
    return dict(L=round(Lm,3), a=round(am,3), b=round(bm,3),
                C=round(Cm,3), h=round(hm,2), ITA=round(ita,2),
                spread=dict(L=Lmad, a=amad, b=bmad, C=Cmad),
                n=len(hexes))

def skin_white_balance_hexes(hexes: List[str], max_deltaE: float=6.0) -> List[str]:
    labs = np.array([hex_to_lab(h) for h in hexes], dtype=np.float32)
    Ls, as_, bs = labs[:,0], labs[:,1], labs[:,2]
    am,_ = median_and_mad(as_); bm,_ = median_and_mad(bs)
    shift = np.array([0.0, -am, -bm], dtype=np.float32)
    mag = float(np.linalg.norm(shift))
    if mag>max_deltaE and mag>0: shift *= (max_deltaE/mag)
    labs[:,1] += shift[1]; labs[:,2] += shift[2]
    return [lab_to_hex(*row) for row in labs]

def season_axes(L:float,a:float,b:float,C:float,ITAdeg:float, spread:Dict[str,float]):
    warm_score = max(0.0, (b-2.0)/10.0) + max(0.0, (a)/12.0)
    cool_score = max(0.0, (2.0-b)/10.0) + max(0.0, (-a)/12.0)
    undertone = "Neutral"
    if warm_score - cool_score > 0.12: undertone="Warm"
    elif cool_score - warm_score > 0.12: undertone="Cool"

    depth = "Mid"
    if ITAdeg >= 28.0 or L>=78.0: depth="Light"
    if ITAdeg <= 15.0 or L<=45.0: depth="Deep"

    clarity = "Soft"
    if C >= 14.0 and spread.get("C",0.0)<=3.0: clarity="Clear"

    fam = "Neutral"
    if undertone=="Warm" and clarity=="Clear": fam="Spring"
    elif undertone=="Warm": fam="Autumn"
    elif undertone=="Cool" and clarity=="Clear": fam="Winter"
    elif undertone=="Cool": fam="Summer"

    if fam=="Spring":
        twelve = "Light Spring" if depth=="Light" else ("Bright Spring" if clarity=="Clear" else "Warm (True) Spring")
    elif fam=="Summer":
        twelve = "Light Summer" if depth=="Light" else ("Cool (True) Summer" if clarity=="Clear" else "Soft Summer")
    elif fam=="Autumn":
        twelve = "Soft Autumn" if clarity!="Clear" and depth!="Deep" else ("Dark Autumn" if depth=="Deep" else "Warm (True) Autumn")
    elif fam=="Winter":
        twelve = "Dark Winter" if depth=="Deep" else ("Bright Winter" if clarity=="Clear" else "Cool (True) Winter")
    else:
        twelve = "Soft Summer" if cool_score>=warm_score else "Soft Autumn"

    ut_margin = abs(warm_score - cool_score)
    if depth=="Light": depth_margin = abs((ITAdeg-28.0))/10.0
    elif depth=="Deep": depth_margin = abs((15.0-ITAdeg))/10.0
    else: depth_margin = 0.0
    clar_margin = abs((C-14.0))/10.0
    conf = clamp01(0.35*ut_margin + 0.25*depth_margin + 0.25*clar_margin + 0.15*(1.0/(1.0+spread.get("C",0.0))))
    reasons = f"undertone={undertone} (margin {round(ut_margin,2)}), depth={depth} (ITA {round(ITAdeg,1)}), clarity={clarity} (C {round(C,1)}), spreadC={round(spread.get('C',0.0),2)}"
    return fam, twelve, undertone, depth, clarity, float(conf), reasons

def drape_score(deck: List[str], stats: Dict[str,Any], season12: str, preset="v3") -> List[Tuple[str,float]]:
    Ls = stats.get("L",65.0); C_skin = stats.get("C",12.0)
    fam = ("Winter" if "Winter" in season12 else
           "Summer" if "Summer" in season12 else
           "Autumn" if "Autumn" in season12 else
           "Spring")

    # season-aware chroma targets
    if fam in ("Winter","Spring"):     C_target, C_floor, C_drop = 42.0, 24.0, 18.0
    else:                              C_target, C_floor, C_drop = 28.0, 16.0, 14.0

    # weights (v3): more hue & chroma, less contrast; no neutrals bonus
    if preset.lower()=="v2":           w_h,w_con,w_chr,w_anc = 0.35,0.25,0.25,0.15
    else:                              w_h,w_con,w_chr,w_anc = 0.40,0.20,0.35,0.05

    bands = SEASON_GROUPS.get(season12, SEASON_GROUPS["Cool (True) Winter"])

    def hue_fit_deg(h):
        # distance to any allowed band
        def dist_to_interval(x,a,b):
            if a<=b:
                return 0.0 if (a<=x<=b) else min(abs(x-a),abs(x-b))
            else:
                return 0.0 if (x>=a or x<=b) else min(abs(x-a),abs(x-b))
        d = min(dist_to_interval(h,*band) for band in bands)
        return 1.0 - min(1.0, d/35.0)  # 0..1

    def chroma_fit(Cc):
        # soft floor up to target, then gentle roll-off after target
        if Cc < C_floor:  return 0.0
        if Cc <= C_target:
            return (Cc - C_floor) / max(6.0, (C_target - C_floor))  # 0..1
        # above target: still ok, but taper
        return max(0.0, 1.0 - (Cc - C_target)/C_drop)

    out=[]
    for hx in deck:
        L,a_,b_ = hex_to_lab(hx)
        _,Cc,hc = lab_to_lch(L,a_,b_)
        hf  = hue_fit_deg(hc)

        # contrast: best around mid contrast; avoid extremes
        dL = abs(Ls - L)
        if dL<=12:        con = dL/12.0
        elif dL>=28:      con = max(0.0, 1.0 - (dL-28)/22.0)
        else:             con = 1.0

        chr = chroma_fit(Cc)

        # anchor: tiny tilt toward colors that aren’t greenish if the skin chroma is very low
        green_pen = 0.2 if (C_skin<12.0 and 80<=hc<=160) else 0.0
        score = (w_h*hf + w_con*con + w_chr*chr + w_anc*1.0) - green_pen
        out.append((hx, clamp01(score)))

    out.sort(key=lambda x:x[1], reverse=True)
    return out

def _nms(hexes, order, hue_deg=18.0, dl=8.0, dc=6.0, k=12):
    keep = []
    def far_enough(i,j):
        L1,a1,b1 = hex_to_lab(hexes[i]); L2,a2,b2 = hex_to_lab(hexes[j])
        de = deltaE76((L1,a1,b1),(L2,a2,b2))
        _,_,h1 = lab_to_lch(L1,a1,b1); _,_,h2 = lab_to_lch(L2,a2,b2)
        dh = min(abs(h1-h2), 360-abs(h1-h2))
        return not (de <= math.hypot(dl,dc) or dh < hue_deg)
    for idx in order:
        if all(far_enough(idx, j) for j in keep):
            keep.append(idx)
        if len(keep) >= k: break
    return keep

def hue_nms_and_farthest(scores: List[Tuple[str,float]], top_k:int=12, hue_nms_deg:float=18.0, dl:float=8.0, dc:float=6.0):
    def lch(hx): L,a,b=hex_to_lab(hx); return lab_to_lch(L,a,b)
    kept=[]
    for hx,sc in scores:
        L,C,h = lch(hx); suppress=False
        for kx,_ in kept:
            Lk,Ck,hk = lch(kx)
            dh = min(abs(h-hk), 360-abs(h-hk))
            if dh<=hue_nms_deg and abs(L-Lk)<dl and abs(C-Ck)<dc:
                suppress=True; break
        if not suppress: kept.append((hx,sc))
        if len(kept)>=max(3, top_k*2): break
    if not kept: return []
    selected=[kept[0]]
    while len(selected)<min(top_k, len(kept)):
        best_i, best_s = None, -1
        for i,(hx,sc) in enumerate(kept):
            if (hx,sc) in selected: continue
            L,C,h = lch(hx); dmin=1e9
            for (hy,sy) in selected:
                Ly,Cy,hyh=lch(hy); dh=min(abs(h-hyh),360-abs(h-hyh))
                d = math.sqrt((L-Ly)**2 + (C-Cy)**2 + (min(dh,60)/60.0*30.0)**2)
                dmin=min(dmin,d)
            score = dmin + 5.0*sc
            if score>best_s: best_s, best_i = score, i
        selected.append(kept[best_i])
    return selected[:top_k]

def _nms_diverse(hexes, scores, hue_deg=18, dl=8, dc=6, k=12, seed=0):
    import random
    random.seed(seed)
    order = list(range(len(hexes)))
    # sort by score descending
    order.sort(key=lambda i: scores[i], reverse=True)
    keep = []
    def ok(i, j):
        L1,a1,b1 = hex_to_lab(hexes[i]); L2,a2,b2 = hex_to_lab(hexes[j])
        # ΔE & hue separation
        de = deltaE76((L1,a1,b1),(L2,a2,b2))
        _,_,h1 = lab_to_lch(L1,a1,b1); _,_,h2 = lab_to_lch(L2,a2,b2)
        dh = min(abs(h1-h2), 360-abs(h1-h2))
        return not (de <= math.hypot(dl,dc) or dh < hue_deg)
    for i in order:
        if all(ok(i,j) for j in keep):
            keep.append(i)
        if len(keep) >= k: break
    return [hexes[i] for i in keep]

# ============================ NEW Utility Nodes ==============================

class PC_SkinWhiteBalance:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("wb_hex_list",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "hex_list": ("STRING", {"multiline": True}),
            "wb_on": ("BOOLEAN", {"default": True}),
            "max_deltaE": ("FLOAT", {"default": 6.0, "min":0.0, "max":15.0, "step":0.5})
        }}
    def run(self, hex_list, wb_on=True, max_deltaE=6.0):
        hx = parse_hex_list(hex_list)
        if not wb_on or not hx: return (hex_list,)
        return (','.join(skin_white_balance_hexes(hx, max_deltaE)),)

class PC_BeardColorCut:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("IMAGE","STRING")
    RETURN_NAMES = ("refined_mask","debug_json")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "image": ("IMAGE",),
            "mask": ("IMAGE",),
            "texture_tau": ("FLOAT", {"default": 0.12, "min":0.0, "max":1.0, "step":0.01}),
            "dilate_hair_px": ("INT", {"default": 2, "min":0, "max":8})
        }}
    def run(self, image, mask, texture_tau=0.12, dilate_hair_px=2):
        im = tensor_to_pil(image).convert("RGB")
        m  = tensor_to_pil(mask).convert("L")
        w,h = im.size
        arr = np.asarray(im).astype(np.float32)
        m_arr = np.asarray(m).astype(np.float32)/255.0
        # Lab
        flat = arr.reshape(-1,3)
        labs = np.array([rgb_to_lab(*px) for px in flat], dtype=np.float32)
        Ls, as_, bs = labs[:,0], labs[:,1], labs[:,2]
        Cs = np.sqrt(as_**2 + bs**2)
        keep = m_arr.reshape(-1)>0.5
        cond_dark_lowc = (Ls<35) & (Cs<18)
        cond_cool_fiber = (bs<2) & (as_<6) & (Cs<14)
        beard = (cond_dark_lowc | cond_cool_fiber)
        # texture (Laplacian)
        gray = ImageOps.grayscale(im)
        g = np.asarray(gray).astype(np.float32)/255.0
        k = np.array([[0,-1,0],[-1,4,-1],[0,-1,0]], dtype=np.float32)
        try:
            from scipy.signal import convolve2d
            tex = np.abs(convolve2d(g, k, mode="same", boundary="symm"))
        except Exception:
            edges_im = Image.fromarray((g*255).astype(np.uint8)).filter(ImageFilter.FIND_EDGES)
            edges = np.asarray(edges_im).astype(np.float32) / 255.0
            tex = np.abs(edges)
        tex = tex/tex.max() if np.max(tex)>0 else tex
        high_tex = tex.reshape(-1) > texture_tau
        drop = keep & (beard | high_tex)
        keep2 = keep & (~drop)
        out = (keep2.reshape(h,w).astype(np.float32))*255.0
        out_img = Image.fromarray(out.astype(np.uint8), mode="L")
        dbg = dict(pct_removed=round(100.0*drop.sum()/max(1,keep.sum()),2),
                   pixels_kept=int(keep2.sum()), pixels_dropped=int(drop.sum()))
        return (pil_to_tensor(out_img), json.dumps(dbg))

class PC_FixedSeasonDeck:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","STRING")
    RETURN_NAMES = ("hex_list","season_name")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "season12": ("STRING", {"default":"Cool (True) Winter"}),
            "include_neutrals": ("BOOLEAN", {"default": True})
        }}
    def _palette(self, s):
        base = {
            "Light Spring": ["#ffe9d6","#ffdfc2","#f6edb9","#e6f7c6","#d0f5e7","#c8f1ff","#ffd4e8",
                             "#f4b86a","#f7c98c","#fcd199","#c9dc92","#a6d6c5","#a8dcf8","#f2b3d1"],
            "Warm (True) Spring": ["#fff1d9","#ffe0b3","#ffd18a","#f6c35e","#f2ac3d","#e68a2e",
                                   "#b2d85e","#78c77b","#3ec1a7","#2aa9d2","#2576d4","#e0568d"],
            "Bright Spring": ["#ffffff","#f7f0c2","#ffdf5e","#f4b400","#ff6f61","#ff3b6e",
                              "#00c7b7","#00b5ff","#007bff","#00a86b","#ff007f","#b300ff"],
            "Light Summer": ["#f3f6fb","#e7f0fa","#dbe7f2","#cfe3ef","#cfeee9","#d9f3e2","#f0e4ef",
                             "#bcd7ec","#b6cee3","#a9c8e0","#a9d7cf","#bcdccf","#d9cbe0"],
            "Cool (True) Summer": ["#f0f4fa","#dfe7f0","#ccd8e6","#b7c7db","#a7c5cc","#9fc0bb",
                                   "#97b0d6","#7aa0c0","#658aa9","#5e9d9d","#7d8fb3","#a47fa8"],
            "Soft Summer": ["#f2f4f5","#e5eaed","#d9e0e3","#cfd6d8","#cbd3cf","#cdd6d0",
                            "#b8c6c8","#a9b7b7","#9ba9a7","#98a2ad","#a09aa6","#b19aa4"],
            "Soft Autumn": ["#f4efe5","#efe6d6","#e8dcc9","#d6c8ad","#c3b594","#a8a587",
                            "#9fb097","#91a28e","#8b9b84","#8f8b75","#8a7a6a","#7a6658"],
            "Warm (True) Autumn": ["#efe3cc","#e1d3b5","#d6c39b","#c6a26b","#b87d3a","#9f5a2a",
                                   "#a9b66f","#7fa15a","#538467","#3e7062","#2f5e6a","#7d4a6e"],
            "Dark Autumn": ["#e9e1cd","#d8ccb0","#c7b593","#a1845a","#7a5d3b","#593c2d",
                            "#6b8a69","#4e6f61","#365a5a","#2b4752","#223d59","#73445a"],
            "Dark Winter": ["#f2f3f6","#e1e3e9","#d1d4dd","#b2b6c3","#8e93a1","#6c7180",
                            "#354a7a","#1f2d50","#151f2f","#203a4a","#2a5a5a","#5d2a5d"],
            "Cool (True) Winter": ["#ffffff","#e6eef9","#d9e7ff","#cce0ff","#b3d1ff","#a6e6ff",
                                   "#5ab0ff","#2b78ff","#0047ab","#00b7c6","#00a18b","#8b00ff"],
            "Bright Winter": ["#ffffff","#f3f3f3","#dde6ff","#c9f0ff","#a6ffe8","#ffe1f0",
                              "#00c8ff","#0096ff","#003cff","#00d68f","#ff1a8c","#6b00ff"]
        }
        pal = base.get(s, base["Cool (True) Winter"])
        return (NEUTRALS + pal) if self._incs else pal
    def run(self, season12, include_neutrals=True):
        self._incs = include_neutrals
        return (','.join(self._palette(season12)), season12)

class PC_DrapeScore:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","STRING")
    RETURN_NAMES = ("scores_json","sorted_hex_list")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "deck_hex_list": ("STRING", {"multiline": True}),
            "stats_json": ("STRING", {"multiline": True}),
            "season12": ("STRING", {"default":"Cool (True) Winter"}),
            "weights_preset": ("STRING", {"default":"v2"}),
        }}
    def run(self, deck_hex_list, stats_json, season12, weights_preset="v2"):
        deck = parse_hex_list(deck_hex_list)
        stats = json.loads(stats_json) if stats_json.strip() else {}
        scores = drape_score(deck, stats, season12, weights_preset)
        return (json.dumps(scores), ','.join([h for h,_ in scores]))

class PC_TopKDiversify:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","STRING")
    RETURN_NAMES = ("diverse_scores_json","hex_topk")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "scores_json": ("STRING", {"multiline": True}),
            "top_k": ("INT", {"default": 12, "min":3, "max":24}),
            "hue_nms_deg": ("FLOAT", {"default": 18.0, "min": 8.0, "max": 45.0}),
            "dl_thresh": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 30.0}),
            "dc_thresh": ("FLOAT", {"default": 6.0, "min": 0.0, "max": 30.0}),
        }}
    def run(self, scores_json, top_k=12, hue_nms_deg=18.0, dl_thresh=8.0, dc_thresh=6.0):
        arr = json.loads(scores_json) if scores_json.strip() else []
        sel = hue_nms_and_farthest(arr, top_k, hue_nms_deg, dl_thresh, dc_thresh)
        return (json.dumps(sel), ','.join([h for h,_ in sel]))

class PC_MergeDecksScore:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","STRING")
    RETURN_NAMES = ("diverse_scores_json","hex_topk")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "fixed_scores_json": ("STRING", {"multiline": True}),
            "adaptive_scores_json": ("STRING", {"multiline": True}),
            "top_k": ("INT", {"default": 12, "min": 6, "max": 24}),
            "hue_nms_deg": ("FLOAT", {"default": 18.0, "min": 8.0, "max": 45.0}),
            "dl_thresh": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 30.0}),
            "dc_thresh": ("FLOAT", {"default": 6.0, "min": 0.0, "max": 30.0}),
        }}
    def run(self, fixed_scores_json, adaptive_scores_json, top_k, hue_nms_deg, dl_thresh, dc_thresh):
        import numpy as np, json
        fx = json.loads(fixed_scores_json) if fixed_scores_json.strip() else []
        ax = json.loads(adaptive_scores_json) if adaptive_scores_json.strip() else []

        def zscore(arr):
            if not arr: return []
            vals = np.array([s for _,s in arr], dtype=np.float32)
            m, sd = float(vals.mean()), float(vals.std() if vals.std()>1e-6 else 1.0)
            return [(h, (s-m)/sd) for h,s in arr]

        fzn = zscore(fx)
        azn = zscore(ax)

        # round-robin interleave (fair share) using normalized scores
        fzn.sort(key=lambda x:x[1], reverse=True)
        azn.sort(key=lambda x:x[1], reverse=True)
        inter = []
        i=j=0
        seen=set()
        while (i<len(fzn) or j<len(azn)) and len(inter)<top_k*4:
            if i<len(fzn):
                h,s = fzn[i]; i+=1
                if h not in seen: inter.append((h, s)); seen.add(h)
            if j<len(azn):
                h,s = azn[j]; j+=1
                if h not in seen: inter.append((h, s)); seen.add(h)

        # diversity selection on the interleaved list
        sel = hue_nms_and_farthest(inter, top_k, hue_nms_deg, dl_thresh, dc_thresh)
        return (json.dumps(sel), ','.join([h for h,_ in sel]))

class PC_WarmCoolDrapeDecision:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","FLOAT","STRING")
    RETURN_NAMES = ("undertone_override","delta","reason")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "warm_scores_json": ("STRING", {"multiline": True}),
            "cool_scores_json": ("STRING", {"multiline": True}),
            "tau": ("FLOAT", {"default": 0.12, "min":0.0, "max":0.5, "step":0.01})
        }}
    def run(self, warm_scores_json, cool_scores_json, tau=0.12):
        def topk_mean(js, k=3):
            arr = json.loads(js) if js.strip() else []
            arr = sorted(arr, key=lambda x:x[1], reverse=True)[:k]
            return sum(x[1] for x in arr)/max(1,len(arr))
        mw, mc = topk_mean(warm_scores_json), topk_mean(cool_scores_json)
        delta = abs(mw-mc)
        if delta>tau:
            ut = "Warm" if mw>mc else "Cool"
            reason = f"{ut} drape wins: {round(max(mw,mc),3)} vs {round(min(mw,mc),3)} (Δ={round(delta,3)}>{tau})"
        else:
            ut = "Neutral"; reason = f"No override: Δ={round(delta,3)}<=τ"
        return (ut, float(delta), reason)

# =========================== Original 19 Node Set ============================

# 1) HexSkinStats (single hex → stats)
class HexSkinStats:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","FLOAT","FLOAT","FLOAT","FLOAT","FLOAT","FLOAT","STRING")
    RETURN_NAMES = ("stats_json","L","a","b","C","h","ITA","median_hex")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{"hex": ("STRING", {"default":"#c8a27a"})}}
    def run(self, hex):
        hx = parse_hex_list(hex)
        if not hx: return (json.dumps({}),0,0,0,0,0,0,"#cccccc")
        stats = robust_skin_stats(hx)
        return (json.dumps(stats), stats["L"], stats["a"], stats["b"], stats["C"], stats["h"], stats["ITA"], hx[0])

# 2) SeasonFromStatsConf
class SeasonFromStatsConf:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","STRING","STRING","STRING","STRING","FLOAT","STRING")
    RETURN_NAMES = ("season4","season12","undertone","depth","clarity","confidence","reasons")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{"stats_json": ("STRING", {"multiline": True})}}

    def run(self, stats_json, tuning_params=None):
        params = tuning_params or {}
        s = json.loads(stats_json) if stats_json.strip() else {}
        L,a,b,C,ITAdeg = s.get("L",0), s.get("a",0), s.get("b",0), s.get("C",0), s.get("ITA",0)
        spread = s.get("spread",{})

        # --- 1) Undertone scores normalized by chroma and guarded ---
        C_guard = max(1.0, C)         # avoid division by 0
        aw = a / (8.0 + 0.4*C_guard)  # scale with chroma so WB-softened a/b don’t dominate
        bw = (b - 1.5) / (8.0 + 0.4*C_guard)
        cw = (2.0 - b) / (8.0 + 0.4*C_guard)

        warm_score = max(0.0, bw) + max(0.0, aw)
        cool_score = max(0.0, cw) + max(0.0, -aw)

        undertone = "Neutral"
        # tau = 0.25                    # ↑ from 0.18/0.12 to reduce false Neutrals
        tau = float(params.get("undertone_tau", 0.25))
        if C >= 10.0 and spread.get("C", 9.9) <= 3.5:   # only decide with decent chroma quality
            if warm_score - cool_score > tau: undertone = "Warm"
            elif cool_score - warm_score > tau: undertone = "Cool"

        # --- 2) Depth via ITA/L with slightly stricter bands ---
        depth = "Mid"
        if ITAdeg >= 32.0 or L>=80.0: depth="Light"
        if ITAdeg <= 12.0 or L<=42.0: depth="Deep"

        # --- 3) Clarity needs real chroma (raise threshold slightly) ---
        clarity = "Soft"
        if (C >= 18.0) or (C >= 16.0 and spread.get("C",9.9) <= 2.5): 
            clarity="Clear"

        # --- 4) Family & neutral fallback no longer always Summer ---
        fam = "Neutral"
        if undertone=="Warm" and clarity=="Clear": fam="Spring"
        elif undertone=="Warm": fam="Autumn"
        elif undertone=="Cool" and clarity=="Clear": fam="Winter"
        elif undertone=="Cool": fam="Summer"

        if fam=="Neutral":
            # tie-break with sign of a and a hint of ITA: warmer a or low ITA => Soft Autumn, else Soft Summer
            fam = "Autumn" if (a >= 0.75 or ITAdeg < 18.0) else "Summer"
        
        if fam=="Spring":
            twelve = "Light Spring" if depth=="Light" else ("Bright Spring" if clarity=="Clear" else "Warm (True) Spring")
        elif fam=="Summer":
            twelve = "Light Summer" if depth=="Light" else ("Cool (True) Summer" if clarity=="Clear" else "Soft Summer")
        elif fam=="Autumn":
            twelve = "Soft Autumn" if clarity!="Clear" and depth!="Deep" else ("Dark Autumn" if depth=="Deep" else "Warm (True) Autumn")
        elif fam=="Winter":
            twelve = "Dark Winter" if depth=="Deep" else ("Bright Winter" if clarity=="Clear" else "Cool (True) Winter")
        else:
            twelve = "Soft Summer" if cool_score>=warm_score else "Soft Autumn"

        # --- confidence (bounded & stricter) ---
        def squash(x, k=0.18):
            # logistic squashing; keeps everything in [0,1] smoothly
            return 1.0 / (1.0 + math.exp(-k * x))

        # undertone margin (use the threshold we set earlier: ~0.25)
        ut_margin = (warm_score - cool_score)
        conf_ut = squash(ut_margin / 0.25) if undertone != "Neutral" else 0.5

        # depth confidence: wider cushions (centered near ITA~32 for Light, ~12 for Deep)
        if depth == "Light":
            conf_depth = squash((ITAdeg - 32.0) / 6.0)
        elif depth == "Deep":
            conf_depth = squash((12.0 - ITAdeg) / 6.0)
        else:
            conf_depth = 0.5

        # clarity confidence: raise pivot to C≈18 (or mirror if Soft)
        if clarity == "Clear":
            conf_clarity = squash((C - 18.0) / 5.0)
        else:
            conf_clarity = squash((18.0 - C) / 5.0)

        # spread damping: tighter C spread -> higher confidence
        spreadC = float(spread.get("C", 0.0))
        conf_spread = 1.0 / (1.0 + spreadC)

        # blend
        base = 0.45 * conf_ut + 0.25 * conf_depth + 0.20 * conf_clarity + 0.10 * conf_spread
        confidence = 0.15 + 0.85 * base
        confidence = max(0.0, min(1.0, confidence))

        # cap confidence when undertone is Neutral or chroma is weak
        if undertone == "Neutral" or C < 10.0:
            confidence = min(confidence, 0.58)

        reasons = f"undertone={undertone}, depth={depth}, clarity={clarity}, C={round(C,1)}, ITA={round(ITAdeg,1)}, spreadC={round(spreadC,2)}"
        return (fam, twelve, undertone, depth, clarity, float(confidence), reasons)

# 3) PaletteToHex3  (image → 3 hex; simple dominant sampler)
class PaletteToHex3:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("hex3",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{"image": ("IMAGE",)}}
    def run(self, image):
        im = tensor_to_pil(image).convert("RGB").resize((64,64), Image.BILINEAR)
        arr = np.asarray(im).reshape(-1,3)
        from sklearn.cluster import KMeans
        k = 3
        model = KMeans(n_clusters=k, n_init=3, random_state=0).fit(arr)
        centers = model.cluster_centers_.astype(int)
        hexes = [rgb_to_hex(*c) for c in centers]
        return (','.join(hexes),)

# 4) PaletteToHexN
class PaletteToHexN:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("hex_list",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{"image": ("IMAGE",), "n": ("INT", {"default": 12, "min":3, "max":64})}}
    def run(self, image, n=12):
        im = tensor_to_pil(image).convert("RGB").resize((96,96), Image.BILINEAR)
        arr = np.asarray(im).reshape(-1,3)
        from sklearn.cluster import KMeans
        model = KMeans(n_clusters=n, n_init=4, random_state=0).fit(arr)
        centers = model.cluster_centers_.astype(int)
        hexes = [rgb_to_hex(*c) for c in centers]
        # dedupe near-duplicates
        uniq=[]
        for h in hexes:
            if h.lower() not in [u.lower() for u in uniq]: uniq.append(h)
        return (','.join(uniq),)

# 5) HexListSkinStats (robust)
class HexListSkinStats:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING","STRING")
    RETURN_NAMES = ("stats_json","skin_hex_median")
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{"hex_list": ("STRING", {"multiline": True})}}
    def run(self, hex_list):
        hx = parse_hex_list(hex_list)
        if not hx: return (json.dumps({}), "#cccccc")
        stats = robust_skin_stats(hx)
        median_hex = lab_to_hex(stats["L"], stats["a"], stats["b"])
        return (json.dumps(stats), median_hex)

# 6) MakeColorDeck (HSV grid)
class MakeColorDeck:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("hex_list",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "hue_step": ("INT", {"default": 15, "min": 5, "max": 60}),
            "sat": ("FLOAT", {"default": 0.6, "min": 0.1, "max": 1.0, "step": 0.05}),
            "value": ("FLOAT", {"default": 0.75, "min": 0.1, "max": 1.0, "step": 0.05}),
            "include_neutrals": ("BOOLEAN", {"default": True})
        }}
    def run(self, hue_step=15, sat=0.6, value=0.75, include_neutrals=True):
        # Simple HSV deck (approx) purely for variety/debug
        import colorsys
        hexes=[]
        for h in range(0,360,hue_step):
            r,g,b = colorsys.hsv_to_rgb(h/360.0, sat, value)
            hexes.append(rgb_to_hex(int(r*255), int(g*255), int(b*255)))
        if include_neutrals: hexes = NEUTRALS + hexes
        return (','.join(hexes),)

# 7) DrapeScore (already defined above as PC_DrapeScore) – expose alias
DrapeScore = PC_DrapeScore

# 8) DrapeContactSheet
class DrapeContactSheet:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("sheet",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "face": ("IMAGE",),
            "hex_list": ("STRING", {"multiline": True}),
            "cols": ("INT", {"default": 6, "min": 3, "max": 12}),
            "cell": ("INT", {"default": 96, "min": 48, "max": 160}),
            "mask": ("IMAGE",),
        }}
    def run(self, face, hex_list, cols=6, cell=96, mask=None):
        face_im = tensor_to_pil(face).convert("RGB")
        mask_im = tensor_to_pil(mask).convert("L") if mask is not None else Image.new("L", face_im.size, 255)
        from PIL import ImageFilter
        m = mask_im.filter(ImageFilter.GaussianBlur(radius=1))
        hx = parse_hex_list(hex_list)
        if not hx:
            grid = Image.new("RGB",(cols*cell, cell),(240,240,240))
            return (pil_to_tensor(grid),)
        rows = (len(hx)+cols-1)//cols
        W, H = cols*cell, rows*cell
        sheet = Image.new("RGB",(W,H),(240,240,240))
        for idx,code in enumerate(hx):
            r = idx//cols; c = idx%cols
            bg = Image.new("RGB",(cell,cell), code)
            # center face
            f = face_im.resize((cell,cell), Image.LANCZOS)
            mm = m.resize((cell,cell), Image.LANCZOS)
            comp = Image.composite(f, bg, mm.point(lambda p: int(p*0.92)))  # faint feather
            sheet.paste(comp,(c*cell, r*cell))
        return (pil_to_tensor(sheet),)

# 9) MakeColorDeckLCh
class MakeColorDeckLCh:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("hex_list",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "hue_step": ("INT", {"default": 15, "min": 5, "max": 60}),
            "L": ("FLOAT", {"default": 75.0, "min": 20.0, "max": 90.0, "step": 1.0}),
            "C": ("FLOAT", {"default": 36.0, "min": 6.0, "max": 60.0, "step": 1.0}),
            "include_neutrals": ("BOOLEAN", {"default": True})
        }}
    def run(self, hue_step=15, L=75.0, C=36.0, include_neutrals=True):
        hexes=[]
        for h in range(0,360,hue_step):
            a = C*math.cos(math.radians(h))
            b = C*math.sin(math.radians(h))
            hexes.append(lab_to_hex(L,a,b))
        if include_neutrals: hexes = NEUTRALS + hexes
        return (','.join(hexes),)

# 10) MakeColorDeckLChPlus (multi L/C tiers)
class MakeColorDeckLChPlus:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("hex_list",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "hue_step": ("INT", {"default": 15, "min": 1, "max": 60}),
            "L_list": ("STRING", {"default":"65,75,85"}),        # supports ranges & +/- tokens
            "C_list": ("STRING", {"default":"22,36,48"}),        # supports ranges & +/- tokens
            "include_neutrals": ("BOOLEAN", {"default": False}), # keep neutrals out here
            "max_colors": ("INT", {"default": 240, "min": 0, "max": 2000}),  # 0 = no cap
            "dedupe_deltaE": ("FLOAT", {"default": 1.75, "min": 0.0, "max": 10.0, "step": 0.25}),
            "seed": ("INT", {"default": 0, "min": 0, "max": 2_000_000_000}),
        },"optional":{
            # optional: use stats so +/- tokens can be relative to skin L/C
            "stats": ("STRING", {"multiline": True}),
            "stats_json": ("STRING", {"multiline": True}),
        }}

    # ---- parsing helpers ----
    def _parse_num_list(self, s: str, base: float = None) -> List[float]:
        if not s or not s.strip(): return []
        out = []
        toks = [t for t in re.split(r'[\s,;]+', s.strip()) if t]
        for t in toks:
            if ':' in t:
                try:
                    a,b,st = t.split(':'); a,b,st = float(a), float(b), float(st)
                    if st == 0: continue
                    n = int(math.floor((b - a) / st))
                    out.extend([a + i*st for i in range(n+1)])
                except Exception:
                    continue
            elif (t.startswith('+') or t.startswith('-')) and base is not None:
                try: out.append(base + float(t))
                except Exception: continue
            else:
                try: out.append(float(t))
                except Exception: continue
        # unique + sorted for stability
        return sorted(list(dict.fromkeys([round(x,4) for x in out])))

    def _hex_to_lch(self, hx: str):
        L,a,b = hex_to_lab(hx); Lc, Cc, hc = lab_to_lch(L,a,b)
        return Lc, Cc, hc

    def _dedupe(self, hexes: list[str], deltaE_thresh: float) -> list[str]:
        if deltaE_thresh <= 0 or len(hexes) < 2: return hexes
        kept = []
        for h in hexes:
            L1,a1,b1 = hex_to_lab(h)
            drop = False
            for k in kept:
                L2,a2,b2 = hex_to_lab(k)
                if deltaE76((L1,a1,b1),(L2,a2,b2)) <= deltaE_thresh:
                    drop = True; break
            if not drop: kept.append(h)
        return kept

    def _fps_select(self, hexes: list[str], k: int, seed: int) -> list[str]:
        """Farthest-point sampling in LCh to keep diversity when downsampling."""
        if k <= 0 or len(hexes) <= k: return hexes
        rng = np.random.RandomState(seed)
        lch = [self._hex_to_lch(h) for h in hexes]

        # Start with the highest-chroma color to seed selection
        start = int(np.argmax([c for (_,c,_) in lch]))
        sel = [start]
        dmin = [float('inf')]*len(hexes)

        def lch_dist(i,j):
            L1,C1,h1 = lch[i]; L2,C2,h2 = lch[j]
            dh = min(abs(h1-h2), 360-abs(h1-h2))
            # scale H to ~L/C scales, encourage hue spread
            return math.sqrt(((L1-L2)/10.0)**2 + ((C1-C2)/8.0)**2 + (dh/24.0)**2)

        # initialize distances
        for i in range(len(hexes)):
            dmin[i] = lch_dist(i, start)

        while len(sel) < k:
            nxt = int(np.argmax(dmin))
            sel.append(nxt)
            # update min distances
            for i in range(len(hexes)):
                d = lch_dist(i, nxt)
                if d < dmin[i]: dmin[i] = d

        # keep original order of selection for visual stability
        return [hexes[i] for i in sel]

    def run(self, hue_step=15, L_list="65,75,85", C_list="22,36,48",
            include_neutrals=False, max_colors=240, dedupe_deltaE=1.75, seed=0,
            stats="", stats_json=""):

        # resolve stats for relative +/- tokens
        s = stats_json if stats_json and stats_json.strip() else stats
        st = json.loads(s) if s.strip() else {}
        L0 = st.get("L", 72.0); C0 = st.get("C", 32.0)

        Ls = self._parse_num_list(L_list, base=L0)
        Cs = self._parse_num_list(C_list, base=C0)
        if not Ls: Ls = [L0-10, L0, L0+10]
        if not Cs: Cs = [max(8.0, C0-10), C0, C0+12]

        # build grid
        hexes=[]
        step = max(1, int(hue_step))
        for L in Ls:
            for C in Cs:
                for h in range(0, 360, step):
                    a = C*math.cos(math.radians(h))
                    b = C*math.sin(math.radians(h))
                    hexes.append(lab_to_hex(L,a,b))

        if include_neutrals:
            hexes = NEUTRALS + hexes

        # collapse near-duplicates
        hexes = self._dedupe(hexes, dedupe_deltaE)

        # cap size with farthest-point sampling
        if max_colors and len(hexes) > max_colors:
            hexes = self._fps_select(hexes, max_colors, seed)

        return (','.join(hexes),)


# 11) DrapeSwatchGrid (simple grid)

# 12) DrapeScoreK (wrapper to pick top/bottom K lists)
class DrapeScoreK:
    CATEGORY="PC / Personal Color"
    RETURN_TYPES=("STRING","STRING","STRING","STRING")
    RETURN_NAMES=("top_hex","avoid_hex","scores_json","ranked_hexes")
    FUNCTION="run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "deck_hex_list": ("STRING", {"multiline": True}),
            "stats": ("STRING", {"multiline": True}),   # or wire stats_json here
            "season12": ("STRING", {"default": ""}),
            "k": ("INT", {"default": 12, "min": 4, "max": 40}),
            "avoid_k": ("INT", {"default": 12, "min": 4, "max": 40}),
            "weights_preset": ("STRING", {"default": "v3"}),
            "diversify": ("BOOLEAN", {"default": True}),
        },"optional":{
            "stats_json": ("STRING", {"multiline": True}),
        }}

    def run(self, deck_hex_list, stats, season12, k=12, avoid_k=12,
            weights_preset="v3", diversify=True, stats_json=""):
        deck = parse_hex_list(deck_hex_list)
        s = stats_json if stats_json.strip() else stats
        st = json.loads(s) if s.strip() else {}
        preset = (weights_preset or "v3").lower()
        ranked = drape_score(deck, st, season12, preset=preset)  # [(hex,score),...]
        if not ranked: return ("", "", "[]", "")

        hexes  = [h for h,_ in ranked]
        scores = [sc for _,sc in ranked]
        # always keep a ranked list for users who wire this to grids
        ranked_hexes = ",".join(hexes)
        scores_json  = json.dumps(ranked, ensure_ascii=False)

        # ---- TOP selection ----
        if diversify:
            order_desc = sorted(range(len(hexes)), key=lambda i: scores[i], reverse=True)
            top_idx = _nms(hexes, order_desc, k=k)
            top = [hexes[i] for i in top_idx]
        else:
            top = hexes[:k]

        # ---- AVOID selection (robust) ----
        if avoid_k <= 0:
            return (",".join(top), "", scores_json, ranked_hexes)

        # 1) start from lowest scores
        order_asc = sorted(range(len(hexes)), key=lambda i: scores[i])
        if diversify:
            avoid_idx = _nms(hexes, order_asc, k=avoid_k)  # different order ⇒ different result
        else:
            avoid_idx = order_asc[:avoid_k]
        avoid = [hexes[i] for i in avoid_idx]

        # 2) prune exact duplicates with TOP; keep ΔE separation but with fallback
        top_lab = [hex_to_lab(h) for h in top]
        def far_from_top(h, de_thresh):
            L,a,b = hex_to_lab(h)
            return all(deltaE76((L,a,b), t) > de_thresh for t in top_lab)

        # step A: strong pruning
        avoidA = [h for h in avoid if far_from_top(h, 2.0)]

        # step B: if we lost too many, relax gently
        if len(avoidA) < max(1, int(0.6*avoid_k)):
            avoidB = [h for h in avoid if far_from_top(h, 1.0)]
        else:
            avoidB = avoidA

        # step C: if still short, just take the worst remaining colors ignoring proximity
        if len(avoidB) < avoid_k:
            need = avoid_k - len(avoidB)
            pool = [h for h in [hexes[i] for i in order_asc] if h not in avoidB and h not in top]
            avoidB += pool[:need]

        avoid = avoidB[:avoid_k]

        return (",".join(top), ",".join(avoid), scores_json, ranked_hexes)

# 13) ScoreNeutrals
class ScoreNeutrals:
    CATEGORY="PC / Personal Color"
    RETURN_TYPES=("STRING","STRING")
    RETURN_NAMES=("scores_json","sorted_hex_list")
    FUNCTION="run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{"stats":("STRING",{"multiline":True})},
                "optional":{"stats_json":("STRING",{"multiline":True}),
                            "season12":("STRING",{"default":""}),
                            "weights_preset":("STRING",{"default":"v3"}),
                            "neutrals_hex_list":("STRING",{"default":""}),
                            "top_k":("INT",{"default":0,"min":0,"max":24}),
                            "diversify":("BOOLEAN",{"default":False})}}
    def run(self, stats, stats_json="", season12="", weights_preset="v3",
            neutrals_hex_list="", top_k=0, diversify=False):
        s = stats_json if stats_json.strip() else stats
        st = json.loads(s) if s.strip() else {"L":72,"a":2,"b":12,"C":26,"ITA":25,"spread":{"C":3}}
        # parse deck safely; fall back to curated set
        deck = [h for h in parse_hex_list(neutrals_hex_list) if re.match(r"^#([0-9a-fA-F]{6})$", h)]
        if not deck: deck = NEUTRALS[:]
        if not season12:
            fam, twelve, *_ = season_axes(st.get("L",0),st.get("a",0),st.get("b",0),
                                          st.get("C",0),st.get("ITA",0),st.get("spread",{}))
            season12 = twelve
        ranked = drape_score(deck, st, season12, preset=weights_preset)
        if top_k>0:
            ranked = (hue_nms_and_farthest(ranked, top_k, 18.0, 8.0, 6.0)
                      if diversify else ranked[:top_k])
        return (json.dumps(ranked), ",".join([h for h,_ in ranked]))



# 14) RefineSkinMask (kept + color-aware beard removal toggle)
class RefineSkinMask:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("IMAGE","STRING")
    RETURN_NAMES = ("refined_mask","debug_json")
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        # Accept BOTH historical 'face_mask' and new 'mask' names.
        # ComfyUI will wire whichever name exists in your saved workflow.
        return {"required": {
            "image": ("IMAGE",),
            "face_mask": ("IMAGE",),   # legacy name kept
            "use_beard_filter": ("BOOLEAN", {"default": True})
        },
        "optional": {
            "mask": ("IMAGE",),        # new alias (optional)
            "texture_tau": ("FLOAT", {"default": 0.12, "min":0.0, "max":1.0, "step":0.01}),
            "dilate_hair_px": ("INT", {"default": 2, "min":0, "max":8})
        }}

    def run(self, image, face_mask, use_beard_filter=True,
            mask=None, texture_tau=0.12, dilate_hair_px=2):
        # Prefer the explicitly provided new 'mask' if present; fall back to legacy 'face_mask'
        the_mask = mask if mask is not None else face_mask

        if not use_beard_filter:
            # Pass-through, no color/texture pruning
            return (the_mask, json.dumps({"pct_removed": 0.0, "note": "beard filter off"}))

        # Reuse the beard/hairline cutter logic (no SciPy needed)
        return PC_BeardColorCut().run(
            image=image,
            mask=the_mask,
            texture_tau=texture_tau,
            dilate_hair_px=dilate_hair_px
        )

# 15) GrayWorldMasked (image-level WB under mask, NOT used for stats by default)
class GrayWorldMasked:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("balanced_image",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "image": ("IMAGE",),
            "mask": ("IMAGE",),
            "strength": ("FLOAT", {"default": 0.5, "min":0.0, "max":1.0, "step":0.05})
        }}
    def run(self, image, mask, strength=0.5):
        im = tensor_to_pil(image).convert("RGB")
        m  = tensor_to_pil(mask).convert("L")
        arr = np.asarray(im).astype(np.float32)
        mm  = np.asarray(m).astype(np.float32)/255.0
        # Compute mean per channel in mask
        eps=1e-6
        w = mm[...,None]
        mean = (arr*w).sum(axis=(0,1)) / (w.sum(axis=(0,1))+eps)
        gray = mean.mean()
        gains = gray/(mean+eps)
        gains = 1.0 + strength*(gains-1.0)
        out = np.clip(arr*gains, 0, 255).astype(np.uint8)
        return (pil_to_tensor(Image.fromarray(out)),)

# 16) SkinAnchor (pass-through of robust medians; left for compatibility/UI)
class SkinAnchor:
    """
    Backward-compatible Skin Anchor.

    - If `hex_list` (optional) is provided and non-empty, use it.
    - Otherwise, sample skin pixels from `image` where `mask>0.5` to build a hex list.
    - Optionally apply skin-only WB (ΔE clamp) to that list.
    - Return robust stats AND the hex_list so downstream WB/stats nodes can consume it.
    """
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = (
        "STRING","FLOAT","FLOAT","FLOAT","FLOAT","FLOAT","FLOAT","STRING","STRING"
    )
    RETURN_NAMES = (
        "stats_json","L","a","b","C","h","ITA","median_hex","hex_list"
    )
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "mask": ("IMAGE",),
            },
            "optional": {
                # if provided, we won't build from image+mask
                "hex_list": ("STRING", {"multiline": True}),
                # controls
                "wb_on": ("BOOLEAN", {"default": True}),
                "max_deltaE": ("FLOAT", {"default": 6.0, "min": 0.0, "max": 15.0, "step": 0.5}),
                # sampling knobs (safe defaults)
                "sample_stride": ("INT", {"default": 2, "min": 1, "max": 8}),
                "max_pixels": ("INT", {"default": 8000, "min": 1000, "max": 50000}),
            }
        }

    def _build_hex_from_image_mask(self, image, mask, stride=2, max_pixels=8000):
        im = tensor_to_pil(image).convert("RGB")
        mk = tensor_to_pil(mask).convert("L")
        arr = np.asarray(im).astype(np.uint8)
        m   = (np.asarray(mk).astype(np.float32) / 255.0) > 0.5

        # stride sample to reduce correlation; then cap count
        sampled = m[::stride, ::stride]
        yy, xx = np.where(sampled)
        if yy.size == 0:
            return []

        # remap to original array indices
        yy = (yy * stride).clip(0, arr.shape[0]-1)
        xx = (xx * stride).clip(0, arr.shape[1]-1)

        if yy.size > max_pixels:
            idx = np.random.choice(yy.size, size=max_pixels, replace=False)
            yy, xx = yy[idx], xx[idx]

        pixels = arr[yy, xx, :]  # (N,3) uint8
        # convert to hex strings
        hexes = [rgb_to_hex(int(r), int(g), int(b)) for r, g, b in pixels]
        return hexes

    def run(
        self,
        image,
        mask,
        hex_list="",
        wb_on=True,
        max_deltaE=6.0,
        sample_stride=2,
        max_pixels=8000,
    ):
        # Use provided hex_list if present, else build from image+mask
        hx = parse_hex_list(hex_list)
        if not hx:
            hx = self._build_hex_from_image_mask(
                image=image, mask=mask, stride=sample_stride, max_pixels=max_pixels
            )

        if not hx:
            empty = json.dumps({})
            return (empty, 0,0,0,0,0,0, "#cccccc", "")

        # Optional WB on the hex set (stats branch only)
        if wb_on:
            hx = skin_white_balance_hexes(hx, max_deltaE=max_deltaE)

        # Drop muddy/edge pixels (low chroma) before computing medians
        hx = _keep_useful(hx)

        stats = robust_skin_stats(hx)
        median_hex = lab_to_hex(stats["L"], stats["a"], stats["b"])
        return (
            json.dumps(stats),
            stats["L"], stats["a"], stats["b"], stats["C"], stats["h"], stats["ITA"],
            median_hex,
            ','.join(hx),
        )

# 17) WarmCoolFromDrape (alias to PC_WarmCoolDrapeDecision)
WarmCoolFromDrape = PC_WarmCoolDrapeDecision

# 18) Display helpers already present as DrapeSwatchGrid / DrapeContactSheet
class DrapeSwatchGrid:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("grid",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            # legacy input name
            "hex_list": ("STRING", {"multiline": True}),
            # optional aliases so you can wire scores/ranked lists directly
        },"optional":{
            "scores_json": ("STRING", {"multiline": True}),
            "ranked_hexes": ("STRING", {"multiline": True}),
            "cols": ("INT", {"default": 8, "min":1, "max":16}),
            "cell": ("INT", {"default": 48, "min": 16, "max": 256}),
            "pad": ("INT", {"default": 6, "min":0, "max":24}),
        }}

    def _coerce_hexes(self, hex_list, scores_json, ranked_hexes):
        # Prefer ranked_hexes -> scores_json -> hex_list (legacy)
        if ranked_hexes and ranked_hexes.strip():
            try:
                arr = json.loads(ranked_hexes)
                # accept ["#aabbcc", "#ddeeff", ...]
                if arr and isinstance(arr[0], str):
                    return arr
            except Exception:
                pass
        if scores_json and scores_json.strip():
            try:
                arr = json.loads(scores_json)  # [["#aabbcc", 0.97], ...]
                return [h for h,_ in arr]
            except Exception:
                pass
        # fall back to comma/space separated string
        return parse_hex_list(hex_list)

    def run(self, hex_list, scores_json="", ranked_hexes="", cols=8, cell=48, pad=6):
        from PIL import ImageDraw
        hx = self._coerce_hexes(hex_list, scores_json, ranked_hexes)
        if not hx:
            W = cols*(cell+pad)+pad; H=cell+2*pad
            return (pil_to_tensor(Image.new("RGB",(W,H),(240,240,240))),)
        rows = (len(hx)+cols-1)//cols
        W = cols*(cell+pad)+pad; H=rows*(cell+pad)+pad
        im = Image.new("RGB",(W,H),(240,240,240)); dr=ImageDraw.Draw(im)
        for i,code in enumerate(hx):
            r=i//cols; c=i%cols
            x0 = pad + c*(cell+pad); y0 = pad + r*(cell+pad)
            dr.rectangle([x0,y0,x0+cell,y0+cell], fill=code, outline="#202020")
        return (pil_to_tensor(im),)

# 19) Classis Makecolor deck 
class PC_MakeColorDeck_Classic:
    CATEGORY="PC / Personal Color"
    RETURN_TYPES=("STRING",)
    RETURN_NAMES=("hex_list",)
    FUNCTION="run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "adaptive": ("BOOLEAN", {"default": True}),
            "hues": ("STRING", {"default":"0:360:15"}),
            "L_list": ("STRING", {"default":"+15,-10"}),
            "C_list": ("STRING", {"default":"22,48"}),
            "include_neutrals": ("BOOLEAN", {"default": False}),
        },"optional":{"stats_json":("STRING",{"multiline":True})}}
    def _parse_range(self, s):
        # '0:360:15' -> [0,15,...,360]
        a,b,st = [int(x) for x in s.split(":")]
        return list(range(a, b+1, st))
    def _nums(self, s, base):
        out=[]
        for t in re.split(r'[\s,;]+', s.strip()):
            if not t: continue
            if t[0] in "+-" and base is not None: out.append(base+float(t))
            else: out.append(float(t))
        return out
    def run(self, adaptive, hues, L_list, C_list, include_neutrals, stats_json=""):
        st = json.loads(stats_json) if stats_json.strip() else {}
        L0 = st.get("L",72.0); C0 = st.get("C",32.0)
        H  = self._parse_range(hues)
        Ls = self._nums(L_list, L0 if adaptive else None)
        Cs = self._nums(C_list, C0 if adaptive else None)
        if not Ls: Ls=[L0-10,L0,L0+10]
        if not Cs: Cs=[max(8.0,C0-10),C0,C0+12]
        hexes=[]
        for L in Ls:
            for C in Cs:
                for h in H:
                    a = C*math.cos(math.radians(h)); b = C*math.sin(math.radians(h))
                    hexes.append(lab_to_hex(L,a,b))
        if include_neutrals: hexes = NEUTRALS + hexes
        return (",".join(hexes),)



# 20) DrapeHint node 
class PC_DrapeHint:
    CATEGORY = "PC / Personal Color"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES  = ("hints",)
    FUNCTION = "run"
    @classmethod
    def INPUT_TYPES(cls):
        return {"required":{
            "season12": ("STRING", {"default": ""}),
        },"optional":{
            "scores_json": ("STRING", {"multiline": True}),
            "top_hex": ("STRING", {"multiline": True}),
            "avoid_hex": ("STRING", {"multiline": True}),
        }}
    def run(self, season12, scores_json="", top_hex="", avoid_hex=""):
        import json
        def hx(s): return parse_hex_list(s)
        tops = []
        if scores_json and scores_json.strip():
            try:
                arr = json.loads(scores_json); tops = [h for h,_ in arr[:6]]
            except: pass
        if not tops: tops = hx(top_hex)[:6]
        avoid = hx(avoid_hex)[:6]

        def label(h):
            L,a,b = hex_to_lab(h); Lc,Cc,H = lab_to_lch(L,a,b)
            return f"{h} (L{L:.0f}/C{Cc:.0f}/H{H:.0f})"
        lines = []
        if season12: lines.append(f"Season: {season12}")
        if tops:     lines.append("Best drapes: " + ", ".join(label(h) for h in tops))
        if avoid:    lines.append("Avoid near: " + ", ".join(label(h) for h in avoid))
        # simple nudge derived from tops
        if tops:
            Ls,Cs,hs = zip(*[lab_to_lch(*hex_to_lab(h)) for h in tops])
            lines.append(f"Trend: go ~L{np.mean(Ls):.0f}, C{np.mean(Cs):.0f}, keep hue spread ±{np.std(hs):.0f}°.")
        return ("\n".join(lines),)


# =============================== Node registry ===============================

NODE_CLASS_MAPPINGS = {
    # Original names
    "HexSkinStats": HexSkinStats,
    "SeasonFromStatsConf": SeasonFromStatsConf,
    "PaletteToHex3": PaletteToHex3,
    "PaletteToHexN": PaletteToHexN,
    "HexListSkinStats": HexListSkinStats,
    "MakeColorDeck": MakeColorDeck,
    "DrapeScore": DrapeScore,
    "DrapeContactSheet": DrapeContactSheet,
    "MakeColorDeckLCh": MakeColorDeckLCh,
    "MakeColorDeckLChPlus": MakeColorDeckLChPlus,
    "DrapeSwatchGrid": DrapeSwatchGrid,
    "DrapeScoreK": DrapeScoreK,
    "ScoreNeutrals": ScoreNeutrals,
    "RefineSkinMask": RefineSkinMask,
    "GrayWorldMasked": GrayWorldMasked,
    "SkinAnchor": SkinAnchor,
    "WarmCoolFromDrape": WarmCoolFromDrape,
    "PC_MakeColorDeck_Classic": PC_MakeColorDeck_Classic,
    "PC_SkinWhiteBalance": PC_SkinWhiteBalance,
    "PC_BeardColorCut": PC_BeardColorCut,
    "PC_FixedSeasonDeck": PC_FixedSeasonDeck,
    "PC_TopKDiversify": PC_TopKDiversify,
    "PC_MergeDecksScore": PC_MergeDecksScore,
    "PC_WarmCoolDrapeDecision": PC_WarmCoolDrapeDecision,
    "PC_DrapeHint": PC_DrapeHint, 
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "HexSkinStats": "PC: Hex → Skin Stats",
    "SeasonFromStatsConf": "PC: Season (with confidence)",
    "PaletteToHex3": "PC: Palette To Hex3",
    "PaletteToHexN": "PC: Palette → N Hex (string)",
    "HexListSkinStats": "PC: Hex List → Skin Stats",
    "MakeColorDeck": "PC: Make Color Deck (HSV)",
    "DrapeScore": "PC: Drape Score (v2)",
    "DrapeContactSheet": "PC: Drape Contact Sheet",
    "MakeColorDeckLCh": "PC: Make Color Deck (LCh)",
    "MakeColorDeckLChPlus": "PC: Make Color Deck (LCh+)",
    "DrapeSwatchGrid": "PC: Drape Swatch Grid",
    "DrapeScoreK": "PC: Drape Score (K)",
    "ScoreNeutrals": "PC: Score Neutrals",
    "RefineSkinMask": "PC: Refine Skin Mask",
    "GrayWorldMasked": "PC: Gray-World (masked)",
    "SkinAnchor": "PC: Skin Anchor",
    "WarmCoolFromDrape": "PC: Warm/Cool From Drape",
    "PC_MakeColorDeck_Classic": "PC: Make Color Deck (Classic)",
    "PC_SkinWhiteBalance": "PC: Skin White Balance (Lab clamp)",
    "PC_BeardColorCut": "PC: Beard / Hairline Color Cut",
    "PC_FixedSeasonDeck": "PC: Fixed Season Deck",
    "PC_TopKDiversify": "PC: Top-K Diversify (LCh)",
    "PC_MergeDecksScore": "PC: Merge & Diversify (Fixed+Adaptive)",
    "PC_WarmCoolDrapeDecision": "PC: Warm/Cool Drape Override",
    "PC_DrapeHint": "PC: Drape Hint",
}
