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
    print("Initializing Predictor (this handles download + setup)...")
    p = Predictor()
    p.setup()
    
    image_path = "face_parsing/samples/sample1.png"
    if not os.path.exists(image_path):
        print(f"Sample image {image_path} not found. Utilizing a dummy path or download a sample.")
        # Try to find any jpg/png in current dir?
        # For now, assumes repo structure
        return

    print(f"Running prediction on {image_path}...")
    try:
        result = p.predict(image_path)
        print("\n--- Result JSON ---")
        print(json.dumps(result, indent=2))
        
        # Validate schema basics
        assert "skin" in result
        assert "season" in result
        assert "best_colors" in result
        print("\nTest PASSED!")
    except Exception as e:
        print(f"\nTest FAILED: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
