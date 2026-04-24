# Project Summary: Personal Color Test (PCT)

**Current Status:** Phase 13: Report V8 Editorial Redesign + Image Export + Signature Combinations
**Last Updated:** 2026-04-23

## Deployment Status
- **Auth**: Clerk Auth with optional **Test Bypass** (`NEXT_PUBLIC_SKIP_AUTH`) to resolve local clock skew blockers.
- **Storage**: Private **Supabase Storage** (`analysis-images` bucket) with **Signed URLs** for secure, reliable previews.
- **Replicate**: 
    - **Deployed Success**: Model hosted at `r8.im/abhijit-sai/personal-color-test`.
    - **Infrastructure**: Nvidia L40S GPU.
- **Supabase**:
    - **Infrastructure**: "Fashion Buddy" architecture live in production.
    - **Schema**: Added `clerk_id` to `profiles` for cross-platform mapping.
- **Web App**:
    - **Status**: Stable v1.1. Resolved duplication race conditions and broken base64 previews.

## Overview
This project is now a full-featured "Fashion Buddy" platform. Users can create profiles via Clerk, track their results timeline, and receive 12-season analysis with premium editorial reports. The report features a dark glassmorphic editorial design, image-based export (replacing PDF), and AI-powered Signature Color Combinations using HSL color theory math. Engine v2 is now the default model.

## Feature Set

### Phase 12: Engine Model Diagnosis (Current)
- **Deep Code Review**: Analyzed all 9 pipeline stages end-to-end across 4 core files (~1800 lines).
- **Critical Issues Found** (4):
    - White balance removes warm undertone signal before classification attempts to detect it.
    - No lighting quality validation — garbage-in with no user feedback.
    - Beard filter's `L<35` threshold misclassifies dark skin pixels as facial hair.
    - CelebAMask-HQ training data bias — segmentation degrades for darker skin tones.
- **Major Issues Found** (3):
    - Circular hue statistics computed with linear median (wrong for hues near 0°/360°).
    - Season classification thresholds not validated against any ground truth dataset.
    - Confidence metric not calibrated to actual prediction accuracy.
- **Risks**: Current engine likely has warm→Neutral/Cool misclassification bias for medium-warm skin tones (South Asian, East Asian, Latin American, Middle Eastern populations).
- **Next Steps**: Execute v2.0 roadmap starting with pipeline split (raw vs corrected stats paths), quality gates, and beard filter fix.

### Phase 11: Security & Stability
- **Secure Image Previews**: portraits are now stored in a private Supabase bucket. Signed URLs are generated on-demand, fixing broken history previews and improving privacy.
- **Duplication Guard**: Implemented `useRef` guards in `AnalysisLoader` to prevent multiple Replicate submissions during auth stabilizing.
- **Auth Bypass**: Added a modular bypass for testing environments where authentication (Clerk) is blocked or unstable.

## Roadmap
- [x] Phase 1: Engine & Deployment.
- [x] Phase 2: Web App Basic Integration.
- [x] Phase 3: UI Polish.
- [x] Phase 4: Performance Tuning.
- [x] Phase 5: Supabase & Tracking.
- [x] Phase 6: Live Capture Experience.
- [x] Phase 7: Commercialization & Payments.
- [x] Phase 8: Enhanced Face Validation.
- [x] Phase 9: Fashion Buddy Infrastructure.
- [x] Phase 10: Refinements & Clerk Migration.
- [x] Phase 11: Security & Stability.
- [/] Phase 12: Engine Model Diagnosis & v2.0 Planning.
- [/] Phase 13: Report V8 Editorial Redesign, Image Export, Signature Combinations.

### Phase 13: Report V8 Editorial Redesign (Current)
- **Editorial Layout Overhaul**: Transformed `FashionResultsView.tsx` into a premium dark glassmorphic editorial report with Bento Box grid (5/7 column split), hero portrait, and 3-column Style Guide.
- **Image Export**: Replaced `window.print()` PDF generation with `html-to-image` screenshot capture at 2x pixel ratio. Removed all `@media print` CSS. Export produces a pixel-perfect PNG matching the web report exactly.
- **Signature Combinations (HSL Color Theory)**: Added 3 algorithmically generated outfit color combinations:
  - *The Core Foundation*: Darkest neutral + highest-saturation accent (dark+light contrast).
  - *Tonal Harmony*: Two analogous hues (within 45° on color wheel) + mid-tone neutral.
  - *The Editorial Edge*: Darkest neutral + lightest neutral + bold accent (3-piece high contrast).
  - Uses `hexToHSL()` conversion with sorting by lightness/saturation to guarantee fashion-safe pairings.
- **Engine v2 Default**: Changed default `engineVersion` from `v1` to `v2` and removed dev-mode gating — all users (dev + production) now use the latest model.
- **Information Architecture**: Removed technical diagnostic clutter (confidence scores, ITA values, hue degrees). Introduced analysis date. Softened "Shades to Avoid" visual treatment. Limited avoid palette to 9 colors for clean grid layout.
- **Hex Codes Retained**: Kept hex codes under Best Colors swatches as proof of AI calculation per user request.

## Known Risks & Decisions
- **Risk**: Undertone misclassification for warm-to-neutral skin tones due to white-balance-then-classify pipeline design.
- **Decision**: v2.0 will classify on raw stats and score palettes on corrected stats (pipeline split).
- **Risk**: Segmentation model (FaceParseNet50/CelebAMask-HQ) has documented bias toward lighter skin tones.
- **Decision**: Segmentation upgrade (BiSeNet V2 or similar) deferred to Phase H of v2.0 roadmap; quick wins first.
- **Risk**: `.env.local` was committed to git via `!.env.local` in `.gitignore` — deployed test Clerk keys to Vercel.
- **Decision**: Removed `!.env.local` from `.gitignore`, untracked from git. All env vars must be set in Vercel dashboard.
- **Decision**: `supabaseAdmin.ts` uses lazy Proxy pattern to avoid build-time crashes when env vars are missing.

## Changelog
- **2026-04-22/23 (Phase 13: Report V8 + Image Export + Combinations)**:
    - **Report Editorial Overhaul**: Complete redesign of `FashionResultsView.tsx` into premium dark glassmorphic editorial layout. Bento Box grid (5/7 split), hero portrait, 3-column Style Guide, and analysis date.
    - **Image Export (replacing PDF)**: Installed `html-to-image`. Implemented `toPng()` capture at 2x pixel ratio with `no-capture` class-based button hiding. Removed entire `@media print` CSS block (~50 lines). Button label changed from "PDF" to "Save Image" with loading spinner.
    - **Signature Combinations**: Added `hexToHSL()` color theory math. 3 algorithmically generated outfit combos using hue distance, saturation sorting, and lightness contrast. Fashion-appropriate titles: "The Core Foundation", "Tonal Harmony", "The Editorial Edge".
    - **Engine v2 Default**: Changed `useState<string>("v1")` → `useState<string>("v2")` in `page.tsx`. Removed `isDevMode` guard from `engineVersion` prop — now always sent.
    - **UI Cleanup**: Avoid palette limited to 9 colors. Technical data (confidence, ITA, hue degrees) hidden from main report.
- **2026-03-14 (Phase 9: V7 Report Redesign Started)**:
    - **Bento Box Layout**: Redesigned `FashionResultsView.tsx` into an asymmetrical grid layout. Added a sticky left profile card (Detected Skin Base, Core Stats, Photo).
    - **Right Layout Stack**: Added 4 scrollable sections: 01. Power Palette (Circles), 02. Wardrobe Essentials (Soft Squares), 03. Shades to Avoid (Circles with Strikethrough), 04. Styling Suggestions (Dynamic Text).
    - **Dynamic Backgrounds**: Added dynamic season-based gradients (e.g., warm rose-beige for Autumn/Spring).
    - **Footer Branding**: Added a prominent brand footer with logo/QR Code for the PDF export.
    - **Pending**: User review and minor tweaks before finalizing the PDF print reliability.
- **2026-03-12 (Analytics)**:
    - **Daily Analytics View**: Created `daily_analytics_summary` SQL view in Supabase to track daily metrics: new users, total generations, active generating users, generations by new users on their join day, and daily failure counts.
    - **SQL snippet**:
      ```sql
      CREATE OR REPLACE VIEW public.daily_analytics_summary AS
      WITH daily_users AS (
        SELECT DATE(created_at) as raw_date, COUNT(id) as new_users_count FROM public.profiles GROUP BY DATE(created_at)
      ),
      daily_generations AS (
        SELECT DATE(ar.created_at) as raw_date, COUNT(ar.id) as total_generations, COUNT(DISTINCT s.profile_id) as active_users_count
        FROM public.analysis_results ar JOIN public.subjects s ON ar.subject_id = s.id GROUP BY DATE(ar.created_at)
      ),
      daily_failures AS (
        SELECT DATE(created_at) as raw_date, COUNT(*) as failures_count FROM public.tracking_logs WHERE status = 'failed' GROUP BY DATE(created_at)
      ),
      generations_by_new_users AS (
        SELECT DATE(ar.created_at) as raw_date, COUNT(ar.id) as gens_by_new_users
        FROM public.analysis_results ar JOIN public.subjects s ON ar.subject_id = s.id JOIN public.profiles p ON s.profile_id = p.id
        WHERE DATE(ar.created_at) = DATE(p.created_at) GROUP BY DATE(ar.created_at)
      ),
      all_dates AS (
        SELECT merge_date as dt FROM (
          SELECT raw_date as merge_date FROM daily_users UNION SELECT raw_date FROM daily_generations UNION SELECT raw_date FROM daily_failures
        ) dates WHERE merge_date IS NOT NULL
      ),
      daily_stats AS (
        SELECT d.dt AS report_date, COALESCE(u.new_users_count, 0) AS new_users, COALESCE(g.total_generations, 0) AS total_generations,
               COALESCE(g.active_users_count, 0) AS active_users, COALESCE(nu_gen.gens_by_new_users, 0) AS gens_by_new_users, COALESCE(f.failures_count, 0) AS failures
        FROM all_dates d LEFT JOIN daily_users u ON d.dt = u.raw_date LEFT JOIN daily_generations g ON d.dt = g.raw_date
        LEFT JOIN daily_failures f ON d.dt = f.raw_date LEFT JOIN generations_by_new_users nu_gen ON d.dt = nu_gen.raw_date
      )
      SELECT COALESCE(TO_CHAR(report_date, 'YYYY-MM-DD'), 'GRAND TOTAL') AS "Date", SUM(new_users) AS "New Users", SUM(total_generations) AS "Total Generations", SUM(gens_by_new_users) AS "Gens by New Users", SUM(active_users) AS "Active Users",
             ROUND(CASE WHEN SUM(active_users) > 0 THEN SUM(total_generations)::numeric / SUM(active_users) ELSE 0 END, 2) AS "Gens per Active User",
             ROUND(CASE WHEN SUM(new_users) > 0 THEN SUM(gens_by_new_users)::numeric / SUM(new_users) ELSE 0 END, 2) AS "Gens per New User", SUM(failures) AS "Failures Count"
      FROM daily_stats GROUP BY ROLLUP(report_date) ORDER BY report_date DESC NULLS FIRST;
      ```
- **2026-03-11 (Session 3 — Deployment Debugging)**:
    - **Vercel Deployment Roadblocks & Fixes**:
        1. ❌ `npm install` failed: `react@19.2.1` didn't satisfy `@clerk/nextjs@6.38.2` peer dep `~19.2.3` → **Fix**: bumped to `react@19.2.4`
        2. ❌ Runtime `MIDDLEWARE_INVOCATION_FAILED`: `.gitignore` had `!.env.local` which committed test Clerk keys to git → **Fix**: removed `!.env.local`, ran `git rm --cached`
        3. ❌ Build crash at "Collecting page data": `supabaseAdmin.ts` threw at module load when `SUPABASE_SERVICE_ROLE_KEY` missing → **Fix**: rewrote to Proxy-based lazy initialization
    - **Commits**: `482805b` (react bump), `5afab15` (.env.local removal), `4a744b8` (lazy supabaseAdmin)
    - **Status**: Build passes locally, awaiting Vercel confirmation with all env vars set
    - **Next Session Priorities**:
        1. Report redesign (avoid palette missing, aesthetics, mobile view)
        2. Clothing suggestions in report
        3. Licensing (repo + Replicate model)
- **2026-03-11 (Session 2)**:
    - **Tier Changes**: Free tier limit updated from 5 → 3 generations (`route.ts`, `AnalysisLoader.tsx`). Pro tier set to "Unlimited — Coming Soon" in landing page.
    - **Landing Page Redesign**: Complete rewrite of `LandingPage.tsx` with 8 sections: hero, wrong-vs-right colors, how-it-works 3-step, 4-season cards, pricing (Free/Pro), final CTA, footer. Scroll-reveal animations, warm rose-beige palette, Playfair serif headings. SEO meta tags added to `layout.tsx` (title, description, keywords, OpenGraph, Twitter).
    - **Deployment Readiness Audit**: Full audit of 14 files (auth, DB, Replicate, persistence, history, generation counting). All core flows confirmed working.
    - **Critical Fixes for Prod**:
        - Removed `fs.appendFileSync` from `authHelper.ts` (would crash on Vercel read-only filesystem)
        - Removed deprecated `getAuth(request)` fallback (caused TypeScript build failure — `Request` vs `NextRequest`)
        - Removed dead `base64Image` computation from `analyze/route.ts`
    - **Env Var Checklist**: Documented required/prohibited Vercel env vars (REPLICATE_API_TOKEN, REPLICATE_MODEL_ID, NEXT_PUBLIC_APP_URL required; SKIP_AUTH, DEV_MODE must NOT be set).
- **2026-03-11 (Session 1)**:
    - **Replicate Deployment**: Pushed v2 engine to Replicate via GitHub Actions (commit `c192b31`). Both v1 and v2 engines live and selectable via `model_version` input param.
    - **A/B Test Validated**: Tested both engines on Replicate with same image (Siddharth). Results confirm pipeline split is working:
        - V1 classifier sees WB-corrected stats (a=18.4, b=25.8, C=31.6) — warm signal reduced by ΔE≈6.7
        - V2 classifier sees raw stats (a=22.5, b=31.2, C=38.3) — full warm signal preserved
        - Both classified as Dark Autumn/Neutral for this genuinely neutral subject — expected convergence
        - V2 confidence slightly higher (0.58 vs 0.57) due to wider margins on raw stats
        - V2 relative beard filter removed 12.2% vs V1's 5.65% — correctly filtering more shadow pixels
    - **Dev-Only UI Toggle**: Verified locally — flask icon toggle in top-left, switches between "Engine V1" (gray) and "Engine V2" (emerald green with pulse dot). Hidden in production.
    - **Next Session**: Debug Vercel build failure, redesign landing page sections to match user vision, test with diverse subjects.
- **2026-03-10**:
    - **v2 Engine**: Created `engine_v2.py` with 4 fixes: pipeline split (classify on raw stats), circular hue median, deterministic sampling (seed=42), relative beard filter thresholds.
    - **Version Selector**: Updated `predict.py` with `model_version` input param (`v1`/`v2`). Both engines initialized at setup, routable via Replicate API input.
    - **Dev-Only UI Toggle**: Added engine version toggle pill in `page.tsx` (gated by `NEXT_PUBLIC_DEV_MODE=true`). Flows through `AnalysisLoader.tsx` → `route.ts` → Replicate input. Production-safe: toggle hidden and no `model_version` sent when env var is absent.
    - **A/B Test Harness**: Updated `test_local.py` with `--version v1|v2` flag and `--compare` mode for side-by-side output comparison.
    - **v1 Preserved**: Original `engine.py` completely untouched as production backup.
- **2026-03-09**:
    - **Deep Engine Diagnosis**: Reviewed all 9 pipeline stages of the color analysis engine across `engine.py`, `face_mask.py`, `personal_color_nodes.py`, and `predict.py`.
    - **Research**: Investigated skin tone analysis bias (MIT, Harvard, Princeton studies), CelebAMask-HQ dataset limitations, Gray World WB limitations, and personal color analysis accuracy benchmarks.
    - **Findings**: Identified 4 critical issues (WB→classification conflict, no lighting gate, beard/dark-skin discrimination, segmentation bias), 3 major issues (circular hue stats, unvalidated thresholds, uncalibrated confidence), and 3 minor issues (non-deterministic sampling, dead anchor weight, hex precision loss).
    - **v2.0 Roadmap**: Defined 8-phase improvement plan (A: Pipeline Split → H: Segmentation Upgrade).
- **2026-03-07**:
    - **Secure Storage Migration**: Moved analysis portraits from base64 strings to **Private Supabase Storage**. Implemented **Signed URLs** for Replicate access and history previews.
    - **Duplication Fix**: Resolved "Multiple Analysis Hits" by adding a `useRef` guard to `AnalysisLoader.tsx`.
    - **Auth Bypass Implementation**: Created `NEXT_PUBLIC_SKIP_AUTH` flag and updated `lib/authHelper.ts` to support mock user testing without Clerk.
    - **Polling Fallback**: Restored server-side persistence to the polling route as a fallback for local development where webhooks are disabled.
    - **Webhook Idempotency**: Added strict existence checks by `prediction_id` to prevent race conditions between webhooks and polling.
    - **Model Review**: Documented analysis of model confidence metrics and sensitivity towards Autumn/Spring seasons.
- **2026-02-25**:
    - **Clerk Migration**: Successfully migrated authentication system from Supabase to Clerk.
    - **Next.js 16 Fix**: Renamed `middleware.ts` to `proxy.ts` to support Next.js 16 conventions for Clerk authentication.
    - **SSO Callback Fix**: Implemented hash-based routing and callback listener for seamless SSO logins.
    - **Database Migration**: Removed `profiles_id_fkey` constraint in Supabase to allow Clerk User IDs to be stored in the primary ID column.
    - **Fashion Timeline**: Implemented user-specific generation history view and API with explicit token passing.
- **2026-02-24**:
    - **Fashion Buddy Architecture**: Implemented full database schema for subjects and results persistence.
    - **Free Tier Extension**: Increased try limit to 5 per user.
    - **PDF Overhaul**: Redesigned print layout for a more premium feel.
- **2026-02-23**:
    - **Enhanced Face Detection**: Implemented `lib/faceDetection.ts` using MediaPipe.
    - **Commercialization**: Implemented premium `LandingPage.tsx` and Stripe Checkout integration.
    - **Robustness**: Fixed "Unexpected token <" JSON parsing errors.
- **2025-12-21**:
    - **Supabase Integration**: Installed client, configured env vars, and added logging to `/api/analyze` and `/api/predictions`.
    - **Live Capture**: Added `CameraCapture` component with MediaPipe. Implemented logic for brightness calculation and face presence.
    - **UI Update**: Refactored Home page to feature large "Capture Photo" vs "Upload" actions.
    - **Status**: Live capture workflow has known issues (full screen behavior) to be addressed in next session.
- **2025-12-18**:
    - **Critical Fix**: Implemented **Asynchronous Polling** mechanism for Replicate API.
    - **Framework Upgrade**: Updated Web App to **Next.js 16**.
- **2025-12-14**:
    - **Vercel Deployment**: Configured monorepo setup.
    - **Feature**: PDF Report generation.
