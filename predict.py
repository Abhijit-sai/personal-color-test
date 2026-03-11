import os
import shutil
from typing import Any
from cog import BasePredictor, Input, Path
import torch
import gdown

# Ensure both engines can be imported
from engine import PersonalColorEngine
from engine_v2 import PersonalColorEngineV2

class Predictor(BasePredictor):
    def setup(self) -> None:
        """Load models into memory to make running multiple predictions efficient"""
        
        # Check and download model weights if needed
        weights_dir = "face_parsing/models"
        weights_path = os.path.join(weights_dir, "model.pth")
        
        if not os.path.exists(weights_dir):
            os.makedirs(weights_dir, exist_ok=True)
            
        if not os.path.exists(weights_path):
            print("Downloading FaceParsing weights...")
            file_id = '1neFVTZCWZcCeIoYA7V3i1Kk3DqaK4iei'
            url = f'https://drive.google.com/uc?id={file_id}'
            try:
                gdown.download(url, weights_path, quiet=False)
            except Exception as e:
                print(f"Failed to download weights: {e}")
                print("Please ensure 'face_parsing/models/model.pth' exists.")
        
        # Initialize BOTH engines (they share the same face parsing weights)
        self.engine_v1 = PersonalColorEngine(face_model_path=weights_path)
        print("PersonalColorEngine v1 initialized.")

        self.engine_v2 = PersonalColorEngineV2(face_model_path=weights_path)
        print("PersonalColorEngine v2 initialized.")

    def predict(
        self,
        image: Path = Input(description="Input selfie image"),
        model_version: str = Input(
            description="Engine version to use: 'v1' (original) or 'v2' (pipeline-split fix). "
                        "v2 classifies undertone on raw stats instead of white-balanced stats.",
            default="v1",
            choices=["v1", "v2"],
        ),
        tuning_params: str = Input(
            description="JSON string of tuning parameters (e.g. {'undertone_tau': 0.25, 'wb_max_deltaE': 6.0})", 
            default="{}"
        )
    ) -> Any:
        """Run personal color analysis on the input image"""
        version = (model_version or "v1").strip().lower()
        print(f"Analyzing image: {image} | Engine: {version}")
        
        # Parse tuning params
        params = {}
        if tuning_params and tuning_params.strip():
            try:
                import json
                params = json.loads(tuning_params)
            except Exception as e:
                print(f"Warning: Failed to parse tuning_params: {e}")

        # Select engine
        engine = self.engine_v2 if version == "v2" else self.engine_v1

        try:
            results = engine.analyze_image(image, tuning_params=params)
            # Inject params used into debug
            if "debug" in results:
                results["debug"]["tuning_params"] = params
                results["debug"]["engine_version"] = version
            return results
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"error": str(e), "engine_version": version}
