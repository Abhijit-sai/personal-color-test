# Project Summary: Personal Color Test (PCT)

**Current Status:** Phase 12: Engine v2 Implemented (A/B Testing Ready)
**Last Updated:** 2026-03-10

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
This project is now a full-featured "Fashion Buddy" platform. Users can create profiles via Clerk, track their results timeline, and receive 12-season analysis with PDF reports. A deep technical diagnosis of the core analysis engine has been completed, identifying critical issues and defining the v2.0 improvement roadmap.

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

## Known Risks & Decisions
- **Risk**: Undertone misclassification for warm-to-neutral skin tones due to white-balance-then-classify pipeline design.
- **Decision**: v2.0 will classify on raw stats and score palettes on corrected stats (pipeline split).
- **Risk**: Segmentation model (FaceParseNet50/CelebAMask-HQ) has documented bias toward lighter skin tones.
- **Decision**: Segmentation upgrade (BiSeNet V2 or similar) deferred to Phase H of v2.0 roadmap; quick wins first.

## Changelog
- **2026-03-11 (Session 2)**:
    - **Tier Changes**: Free tier limit updated from 5 → 3 generations (`route.ts`, `AnalysisLoader.tsx`). Pro tier set to "Unlimited — Coming Soon" in landing page.
    - **Landing Page Redesign**: Complete rewrite of `LandingPage.tsx` with 8 sections: hero, wrong-vs-right colors, how-it-works 3-step, 4-season cards, pricing (Free/Pro), final CTA, footer. Scroll-reveal animations, warm rose-beige palette, Playfair serif headings. SEO meta tags added to `layout.tsx` (title, description, keywords, OpenGraph, Twitter).
    - **Deployment Readiness Audit**: Full audit of 14 files (auth, DB, Replicate, persistence, history, generation counting). All core flows confirmed working.
    - **Critical Fixes for Prod**:
        - Removed `fs.appendFileSync` from `authHelper.ts` (would crash on Vercel read-only filesystem)
        - Removed deprecated `getAuth(request)` fallback (caused TypeScript build failure — `Request` vs `NextRequest`)
        - Removed dead `base64Image` computation from `analyze/route.ts`
    - **Build Status**: `npm run build` passes locally (exit code 0, all 6 routes compile). **Vercel build failed** — needs investigation next session.
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
