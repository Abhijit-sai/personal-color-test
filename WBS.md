2. Work Breakdown Structure (WBS)

We’ll think in phases. Each phase can be a milestone.

Phase 0 – Setup & context

0.1. Create project repository (monorepo or split: /engine + /web).
0.2. Add Project_Summary.md file at repo root.
0.3. Add provided files:

personal_color_nodes.py

Comfy JSON workflow

Face parsing repo as submodule or /vendor/face_parsing/.

0.4. Document initial scope and versions in Project_Summary.md.

Phase 1 – Color engine Replicate model (MVP priority)

Goal: a working Replicate model API for color analysis.

1.1. Integrate face parsing repo

Add as submodule or copy minimal files.

Implement Python FaceParser class:

Load model/weights.

Preprocess image.

Output label map (19 classes).

Build skin mask (skin + neck).

1.2. Wrap existing personal color nodes as a Python “library”

Ensure personal_color_nodes.py functions/classes can be imported and used without Comfy.

Identify needed helpers:

RefineSkinMask

SkinAnchor

SeasonFromStatsConf

MakeColorDeckLChPlus

PC_MakeColorDeck_Classic

DrapeScoreK

PC_MergeDecksScore

ScoreNeutrals

Conversion helpers.

1.3. Implement analyze_image() pipeline

Steps:

Run FaceParser → raw skin mask.

RefineSkinMask → refined mask.

SkinAnchor (normalized stats) → stats_json, median_hex, etc.

(Optional) “Actual skin” anchor without GrayWorld → actual skin hex.

SeasonFromStatsConf → season4, season12, confidence, undertone, depth, clarity.

Build color decks:

LCh adaptive deck.

Classic deck.

Score decks:

DrapeScoreK for both.

Merge scores via PC_MergeDecksScore.

Score neutrals via ScoreNeutrals.

Select:

best 10 colors.

top 5 neutrals.

avoid 10 colors.

Return the JSON output.

1.4. Create predict.py for Cog / Replicate

Predictor.setup():

Load face parsing model.

Initialize data structures.

Predictor.predict(image):

Load PIL image.

Call analyze_image() pipeline.

Return dict in final contract shape.

1.5. Define cog.yaml

Python version, GPU flag, dependencies.

1.6. Local testing

Use cog predict with sample images.

Validate outputs are sensible.

1.7. Push to Replicate

cog push to create hosted model.

Note model version & URL in Project_Summary.md.

Phase 2 – Backend API for web app

2.1. Decide stack (e.g., small Node.js/Express or Python/FastAPI).
2.2. Implement /api/analyze endpoint:

Accepts image upload.

Calls Replicate model (with secret API token).

Returns JSON result to frontend.

2.3. Basic auth wiring (if done on backend).
2.4. Error handling & logging.

Phase 3 – Frontend web app (v2)

3.1. Choose frontend framework (e.g., Next.js / React).
3.2. Implement:

Landing page.

Auth page (email login).

Upload page (file picker + drag-drop).

Results page layout.

3.3. Integrate with backend:

On upload, call /api/analyze.

Render results.

3.4. Basic styling (clean, minimal).

Phase 4 – Report view & download (v3)

4.1. Design “Personal Color Report” layout (high-level structure).
4.2. Implement report component:

Shows photo, name, age, season, color grids.

4.3. Export as:

Image (e.g., HTML -> canvas -> image).

PDF (server-side or client-side library).

4.4. Add “Download report” button & test.

Phase 5 – Fashion avatars (v4)

5.1. Select image generation model/API (Replicate or other).
5.2. Define prompts templates for each style:

Indian traditional.

Western professional.

Casual party.

5.3. Implement avatar generation endpoint:

Input: user face image + list of best colors.

Output: 3 URLs of generated images.

5.4. Integrate into frontend:

Show avatars on the report page.

Handle loading states & errors.

Phase 6 – QA, polish & launch

6.1. Test with multiple images (diverse skin tones, lighting, etc).
6.2. Adjust thresholds & deck parameters if needed.
6.3. Add basic logging & monitoring.
6.4. Update documentation & Project_Summary.md with final feature status.

Phase 7 – Commercialization & Payments (V5)

7.1. Setup Stripe account and API keys.
7.2. Implement `/api/checkout` endpoint for Stripe sessions.
7.3. Create Landing Page with pricing and CTA.
7.4. Implement success/cancel return pages from Stripe.

Phase 8 – Enhanced Face Validation (V6)

8.1. Extract MediaPipe face detection into `lib/faceDetection.ts`.
8.2. Integrate `detectFace` into `CameraCapture.tsx` (Live mode).
8.3. Integrate `detectFace` into `UploadForm.tsx` (Upload mode).
8.4. Implement "No Face Detected" UI overlays with modern aesthetics.
