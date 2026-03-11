1. Product Requirement Document (PRD)
1.1. Product overview

Product name (working): Personal Color Test (PCT)
Core idea: A web experience where a user:

Logs in with email.

Uploads a selfie.

Gets an automatic personal color analysis:

Actual skin tone hex.

Personal color season (primary).

Top 10 colors to wear.

Top 5 neutrals to wear.

Top 10 colors to avoid.

(Extended) Sees hyper-realistic fashion avatars of themselves in recommended palettes.

Gets a downloadable personal color report (image or PDF).

Engine:
The core color logic already exists in:

A Python module with “personal color nodes” (skin stats, seasons, drape scoring, deck generation).

A ComfyUI JSON workflow describing the node graph.

A face parsing repo (e.g., TracelessLe/FaceParsing.PyTorch) for skin segmentation.

We will wrap this logic into a Replicate model (Cog) that exposes a simple HTTP API, and then build a web app on top.

1.2. Goals & non-goals

Goals (v1–v6):

V1: Color Analysis API
- A Replicate-hosted AI model (Done).

V2: Web App
- Core analysis flow with image upload (Done).

V3: Report & “Personal Color Report” view
- PDF and Image download functionality (Done).

V4: Fashion avatars (In Progress)
- AI-generated outfits in recommended palettes.

V5: Commercialization & Payments
- Integration with Stripe for paid analysis.
- Premium Landing Page to drive conversions.

V6: Enhanced Face Validation
- Mandatory client-side face detection before uploading/capturing.
- User feedback for poor lighting or non-human subjects.

Non-goals (for now):

Full multi-language support.

Heavy analytics dashboard.

Editing/tuning personal color rules via UI.

1.3. User personas & journeys (high-level)

Persona:

Age 20–45, fashion/appearance-conscious, wants to know “what colors suit me”.

Comfort with selfies & web apps.

Main journey (web v2+):

Lands on website → Clicks “Get your color report”.

Logs in via email (basic password or magic link).

Sees instructions: face the camera, neutral lighting, no heavy filters.

Uploads one selfie (optional: multiple later).

System processes:

Sends image → backend → Replicate model.

Shows loading state.

On success, user sees:

Skin tone swatch + hex.

Season name (e.g., Soft Autumn).

Best 10 colors grid.

Top 5 neutrals grid.

Avoid 10 colors grid.

(V3) Can click “View full report”:

Shows a nicely formatted card with:

Their photo, name, age.

Short explanations (“Why this season”, “How to use these colors”).

Buttons: “Download as Image” / “Download as PDF”.

(V4) Can scroll to “Style me” section showing 3 avatar pictures in recommended palettes.

1.4. Functional requirements
1.4.1. Authentication

Sign up / Login via email:

Option A: Email + password.

Option B: Email-only magic link (if using a service like Supabase/Auth provider).

Secure session management (JWT / cookies).

Minimal PII: name (optional), age (optional), email (mandatory).

1.4.2. Image upload

Max file size (e.g., 10MB).

Accepted formats: JPG, PNG, WEBP.

Basic validation:

At least X×Y resolution (e.g., 512×512).

Ideally one face; if face parsing fails, return friendly error.

1.4.3. Color Analysis API (core engine)

Source of truth:
Replicate model using:

personal_color_nodes.py (provided file)

Face parsing repo TracelessLe/FaceParsing.PyTorch (or similar).

Pipeline:

Load image.

Run face parsing → obtain face/skin mask.

Refine mask using RefineSkinMask.

Compute skin stats using SkinAnchor:

Use “normalized” branch (Gray World + skin white balance).

Get personal color season with SeasonFromStatsConf.

Generate color decks using:

MakeColorDeckLChPlus (LCh adaptive).

PC_MakeColorDeck_Classic (classic seasonal).

Score colors with DrapeScoreK for both decks.

Merge scores using PC_MergeDecksScore.

Score neutrals using ScoreNeutrals.

Select:

Top 10 best colors, top 5 neutrals, top 10 avoid.

Actual skin hex (from non-normalized “Actual Skin Tone” branch).

Replicate model API contract (v1):

Input:

image (file or URL): face selfie.

Output (JSON):

{
  "skin": {
    "hex_actual": "#e6b58d",
    "hex_normalized": "#e3b28a",
    "hue_deg": 42.3
  },
  "season": {
    "season4": "Autumn",
    "season12": "Soft Autumn",
    "confidence": 0.81,
    "undertone": "Warm",
    "depth": "Medium",
    "clarity": "Soft"
  },
  "best_colors": ["#7a3b61", "#e5a15a", "... up to 10 ..."],
  "neutrals": ["#fdf7f0", "#e3dad1", "... up to 5 ..."],
  "avoid_colors": ["#00ffff", "#ff00ff", "... up to 10 ..."],
  "debug": {
    "reasons": ["Warm undertone", "Soft clarity", "Between Soft Autumn / Soft Summer"],
    "version": "v1.0"
  }
}


This is what your web backend will consume.

1.4.4. Web backend (for website)

Expose an endpoint (e.g., /api/analyze) which:

Accepts uploaded image (multipart).

Forwards the image to Replicate model (using Replicate’s API).

Returns the parsed JSON response to the frontend.

Handles:

Auth check (optional for v1).

Basic error handling (invalid image, Replicate error, etc).

1.4.5. Frontend (v2+)

Pages:

Landing page: explanation, CTA “Start your color test”.

Auth page: email login.

Upload page: camera/drag-drop image + instructions.

Results page:

Skin swatch with hex_actual.

Season name + explanation.

3 sections:

Best colors grid (10 swatches with hex labels).

Neutrals grid (5 swatches).

Avoid colors grid (10 swatches).

Report page (v3):

Styled layout: name, age, photo, color summary.

Download buttons (image/PDF).

1.4.6. Report generation (v3)

Generate a single “Personal Color Report” view:

Either:

A server-generated HTML → rendered to PDF

Or canvas-based client-side image export.

Must include:

User photo.

Name & age (if provided).

Skin hex.

Season + short text (“You are Soft Autumn: warm, soft, medium depth”).

Color grids (best, neutrals, avoid).

1.4.7. Avatar generation (v4, extended)

Separate pipeline using image model on Replicate / similar:

Input:

Original user face image.

List of best color hexes.

Output:

3 images:

Indian traditional attire (e.g., kurta/saree, etc) in best palette.

Western professional (blazer, shirt, etc).

Casual party outfit.

Needed:

Prompt templates referencing color hexcodes.

Possibly a small LoRA or face ID preservation method if you want it really close.

1.5. Non-functional requirements

Performance:

Replicate inference ideally < 10 seconds per image.

Availability:

For v1, “best effort”.

No strict SLA, but should handle multiple concurrent users.

Privacy:

Images and results should not be publicly exposed.

Clear note in UI that images are processed only for analysis and not reused (unless you later add “save to gallery”).

Security:

Protect Replicate API key in backend (never in frontend).

Basic auth for user accounts.