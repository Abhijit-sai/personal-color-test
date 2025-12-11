import os
import sys
import torch
import numpy as np
from PIL import Image
import torchvision.transforms as transforms

# Add face_parsing to path so we can import modules from it
current_dir = os.path.dirname(os.path.abspath(__file__))
face_parsing_dir = os.path.join(current_dir, 'face_parsing')
if face_parsing_dir not in sys.path:
    sys.path.append(face_parsing_dir)

from networks import get_model

class FaceParser:
    def __init__(self, model_path, device='cuda', cpu_only=False):
        self.device = 'cpu' if cpu_only or not torch.cuda.is_available() else device
        self.n_classes = 19
        self.net = get_model('FaceParseNet50', n_classes=self.n_classes, pretrained=False)
        self.net.to(self.device)
        self.net.eval()
        
        if os.path.exists(model_path):
            print(f"Loading FaceParsing weights from {model_path}")
            state_dict = torch.load(model_path, map_location=self.device)
            # Handle potential DataParallel wrapping keys
            new_state_dict = {}
            for k, v in state_dict.items():
                if k.startswith('module.'):
                    new_state_dict[k[7:]] = v
                else:
                    new_state_dict[k] = v
            self.net.load_state_dict(new_state_dict)
        else:
            print(f"WARNING: Model path {model_path} not found. Running with random weights (Results will be garbage).")

        self.transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize((0.485, 0.456, 0.406), (0.229, 0.224, 0.225)),
        ])

    def get_mask(self, image_pil):
        """
        Returns a PIL image of the skin mask (labels 1, 16, 17).
        """
        w, h = image_pil.size
        # Resize to 512x512 for inference
        img_resized = image_pil.resize((512, 512), Image.BILINEAR)
        img_tensor = self.transform(img_resized).unsqueeze(0).to(self.device)

        with torch.no_grad():
            out = self.net(img_tensor)
            # FaceParseNet50 returns [[seg1, seg2], [edge]]
            if isinstance(out, list):
                # We want the final segmentation from the first group
                # typically out[0][-1]
                out = out[0][-1]
            
            # Now out should be [1, 19, 512, 512]
            out = torch.nn.functional.interpolate(out, (h, w), mode='bilinear', align_corners=True)
            parsing = out.argmax(1)[0].cpu().numpy()

        # Labels: 1=skin, 16=neck_l?, 17=neck
        # We might want to include ears (8, 9) and nose (2) if not part of skin?
        # Typically 'skin' (1) excludes nose in some datasets (CelebAMask-HQ 'skin' usually includes broad face area minus features).
        # Let's check the README table again.
        # 1: skin, 2: nose, 3: eye_g, 4: l_eye, 5: r_eye, 6: l_brow, 7: r_brow, 8: l_ear, 9: r_ear, 10: mouth, 11: u_lip, 12: l_lip, 13: hair, 14: hat, 15: ear_r, 16: neck_l, 17: neck, 18: cloth
        
        # We want "Skin". 
        # Usually skin analysis wants cheeks/forehead/chin.
        # Label 1 is the main face skin.
        # Label 2 is nose. Often good for color.
        # Label 16, 17 are neck.
        # Lips/Eyes/Brows should be excluded.
        # Ears (8, 9, 15?) might be okay but can be shadowed.
        # Let's stick to [1, 2, 16, 17] (Skin, Nose, Necks).
        # Wait, 'ear_r' is 15. 'l_ear' 8, 'r_ear' 9.
        
        target_labels = [1, 2, 16, 17] 
        
        mask = np.isin(parsing, target_labels).astype(np.uint8) * 255
        return Image.fromarray(mask, mode='L')
