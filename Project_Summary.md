# Project Summary: Personal Color Test (PCT)

**Current Status:** Initialization / Phase 1 Planning
**Last Updated:** 2025-12-12

## Overview
This project aims to build an AI-powered Personal Color Analysis system.
Phase 1 focuses on building a Replicate-hosted model (Cog) that takes a selfie and returns skin tone, season, and color recommendations.

## Feature Set
### Phase 1: Replicate Model (In Progress)
- **Input:** Single image (face selfie).
- **Core Logic:**
  - Face parsing (skin segmentation).
  - Skin stats & white balance (Gray World ignored for "actual" skin tone).
  - Seasonal classification (4-season & 12-season).
  - Color deck generation & scoring.
- **Output:** JSON containing:
  - Skin hex (actual & normalized).
  - Season details (confidence, undertone, depth, clarity).
  - Top 10 Best Colors.
  - Top 5 Neutrals.
  - Top 10 Avoid Colors.
  - Debug info.

## Work Breakdown & Plan

### Phase 1: Engine / Replicate Model (Completed)
- **Project Setup**: Initialized `Project_Summary.md` and repo structure.
- **Face Parsing**:
  - Cloned `FaceParsing.PyTorch`.
  - Created `face_mask.py` wrapper.
  - Implemented logic to extract Skin/Neck labels.
- **Engine Logic**:
  - Created `engine.py`.
  - Integrated `personal_color_nodes.py`.
  - Implemented full pipeline: Masking -> Refinement -> Stats (Actual/Norm) -> Season -> Decks -> Scoring -> Merging.
- **Cog Implementation**:
  - Created `cog.yaml` with dependencies.
  - Created `predict.py` with auto-download for FaceParsing weights (`model.pth` from GDrive).
- **Testing**:
  - Created `test_local.py` for local verification without Docker.
  - Requires `torch`, `torchvision`, `numpy`, `PIL`, `scipy`, `sklearn`, `gdown`.

### Usage / Verification
To verify locally:
```bash
python test_local.py
```

### Tuning / Bias Correction
The API accepts an optional `tuning_params` JSON string.
Supported keys:
- `undertone_tau` (float, default 0.25): Threshold for Warm vs Cool. Higher values = harder to be classified as Warm/Cool (more Neutrals).
- `wb_max_deltaE` (float, default 6.0): Max white balance shift. Lower = closer to actual skin color.

Example:
```json
{
  "undertone_tau": 0.30, 
  "wb_max_deltaE": 4.0
}
```



### Phase 2: Backend Wrapper (Future)
*   [ ] API Endpoint creation.

### Phase 3: Frontend Web App (Future)
*   [ ] UI/UX for upload & results.

## Changelog
- **2025-12-12**: Initialized Project Summary. Analysis of `personal_color_nodes.py` complete.
