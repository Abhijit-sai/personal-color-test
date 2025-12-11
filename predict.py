import os
import shutil
from typing import Any
from cog import BasePredictor, Input, Path
import torch
import gdown

# Ensure engine can be imported
from engine import PersonalColorEngine

class Predictor(BasePredictor):
    def setup(self) -> None:
        """Load the model into memory to make running multiple predictions efficient"""
        
        # Check and download model weights if needed
        weights_dir = "face_parsing/models"
        weights_path = os.path.join(weights_dir, "model.pth")
        
        if not os.path.exists(weights_dir):
            os.makedirs(weights_dir, exist_ok=True)
            
        if not os.path.exists(weights_path):
            print("Downloading FaceParsing weights...")
            # Use gdown to download from Google Drive
            # 79999_iter.pth (BiseNet) or FaceParseNet50 (from README)?
            # README says: https://drive.google.com/file/d/1neFVTZCWZcCeIoYA7V3i1Kk3DqaK4iei/view?usp=sharing
            # ID: 1neFVTZCWZcCeIoYA7V3i1Kk3DqaK4iei
            file_id = '1neFVTZCWZcCeIoYA7V3i1Kk3DqaK4iei'
            url = f'https://drive.google.com/uc?id={file_id}'
            try:
                gdown.download(url, weights_path, quiet=False)
            except Exception as e:
                print(f"Failed to download weights: {e}")
                print("Please ensure 'face_parsing/models/model.pth' exists.")
        
        # Initialize Engine (loads models)
        self.engine = PersonalColorEngine(face_model_path=weights_path)
        print("PersonalColorEngine initialized.")

    def predict(
        self,
        image: Path = Input(description="Input selfie image"),
        tuning_params: str = Input(
            description="JSON string of tuning parameters (e.g. {'undertone_tau': 0.25, 'wb_max_deltaE': 6.0})", 
            default="{}"
        )
    ) -> Any:
        """Run personal color analysis on the input image"""
        print(f"Analyzing image: {image}")
        
        # Parse tuning params
        params = {}
        if tuning_params and tuning_params.strip():
            try:
                import json
                params = json.loads(tuning_params)
            except Exception as e:
                print(f"Warning: Failed to parse tuning_params: {e}")

        try:
            results = self.engine.analyze_image(image, tuning_params=params)
            # Inject params used into debug
            if "debug" in results:
                results["debug"]["tuning_params"] = params
            return results
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": str(e)}
