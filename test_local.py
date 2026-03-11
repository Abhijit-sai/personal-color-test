import os
import sys
import json
try:
    import gdown
except ImportError:
    print("Installing gdown...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "gdown", "scipy", "scikit-learn", "torch", "torchvision", "numpy", "Pillow", "opencv-python-headless"])
    import gdown

# Mock cog module to avoid installing it locally
try:
    import cog
except ImportError:
    from types import SimpleNamespace
    cog_mock = SimpleNamespace()
    cog_mock.BasePredictor = object
    cog_mock.Input = lambda **kwargs: kwargs.get('description', '')
    cog_mock.Path = str
    sys.modules["cog"] = cog_mock

import torch
import numpy as np
from PIL import Image
from predict import Predictor

def main():
    # Parse command line args: --version v1|v2
    version = "v1"
    for i, arg in enumerate(sys.argv):
        if arg == "--version" and i + 1 < len(sys.argv):
            version = sys.argv[i + 1]
    
    print(f"=== Personal Color Test - Local Testing ===")
    print(f"Engine version: {version}")
    print()

    print("Initializing Predictor (this handles download + setup)...")
    p = Predictor()
    p.setup()
    
    image_path = "face_parsing/samples/sample1.png"
    if not os.path.exists(image_path):
        print(f"Sample image {image_path} not found. Utilizing a dummy path or download a sample.")
        return

    print(f"Running prediction on {image_path} with engine {version}...")
    try:
        result = p.predict(image_path, model_version=version)
        print(f"\n--- Result JSON (engine {version}) ---")
        print(json.dumps(result, indent=2))
        
        # Validate schema basics
        assert "skin" in result, "Missing 'skin' key"
        assert "season" in result, "Missing 'season' key"
        assert "best_colors" in result, "Missing 'best_colors' key"
        
        # Show version info
        debug = result.get("debug", {})
        print(f"\nEngine version: {debug.get('version', 'unknown')}")
        if "v2_changes" in debug:
            print("v2 changes applied:")
            for change in debug["v2_changes"]:
                print(f"  - {change}")
        
        print(f"\nTest PASSED ({version})!")
    except Exception as e:
        print(f"\nTest FAILED: {e}")
        import traceback
        traceback.print_exc()

def compare():
    """Run both v1 and v2 on the same image and show differences."""
    print("=== Comparing v1 vs v2 ===")
    print()
    
    p = Predictor()
    p.setup()
    
    image_path = "face_parsing/samples/sample1.png"
    if not os.path.exists(image_path):
        print(f"Sample image {image_path} not found.")
        return
    
    r1 = p.predict(image_path, model_version="v1")
    r2 = p.predict(image_path, model_version="v2")
    
    if "error" in r1 or "error" in r2:
        print(f"v1 error: {r1.get('error')}")
        print(f"v2 error: {r2.get('error')}")
        return
    
    print(f"{'':20s} {'v1':>20s} {'v2':>20s} {'Match':>8s}")
    print(f"{'-'*70}")
    
    # Season comparison
    for key in ["season4", "season12", "undertone", "depth", "clarity", "confidence"]:
        v1_val = r1["season"].get(key, "N/A")
        v2_val = r2["season"].get(key, "N/A")
        match = "✓" if v1_val == v2_val else "≠"
        print(f"{key:20s} {str(v1_val):>20s} {str(v2_val):>20s} {match:>8s}")
    
    # Skin hex
    for key in ["hex_actual", "hex_normalized", "hue_deg"]:
        v1_val = r1["skin"].get(key, "N/A")
        v2_val = r2["skin"].get(key, "N/A")
        match = "✓" if v1_val == v2_val else "≠"
        print(f"{key:20s} {str(v1_val):>20s} {str(v2_val):>20s} {match:>8s}")
    
    # Best colors overlap
    v1_best = set(r1.get("best_colors", []))
    v2_best = set(r2.get("best_colors", []))
    overlap = len(v1_best & v2_best)
    print(f"\nBest colors overlap: {overlap}/{len(v1_best)} colors in common")
    
    print("\nDone!")

if __name__ == "__main__":
    if "--compare" in sys.argv:
        compare()
    else:
        main()
