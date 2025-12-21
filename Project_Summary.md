# Project Summary: Personal Color Test (PCT)

**Current Status:** Phase 6: Live Capture Experience (In Progress - Debugging)
**Last Updated:** 2025-12-21

## Deployment Status
- **Replicate**: 
    - **Deployed Success**: Model hosted at `r8.im/abhijit-sai/personal-color-test`.
    - **Infrastructure**: Upgraded to **Nvidia L40S** GPU.
    - **Method**: GitHub Actions manual push.
- **Web App**:
    - **Status**: Functional "High-Fashion" UI active (`FashionResultsView`).
    - **Hosting**: Deployed to Vercel (Source: `web-app` root directory).
    - **Integration**: Connected & Verified.

## Overview
This project aims to build an AI-powered Personal Color Analysis system.
Phases 1-4 (Engine, Web Integration, UI Polish, Performance) are complete.
**Phase 5 (Supabase)** is complete, providing a database for company profiles and logging all analysis runs.
**Phase 6 (Live Capture)** is partially implemented. The camera component `CameraCapture` uses MediaPipe for face detection and lighting checks, but the user experience workflow needs refinement (specifically the full-screen capture flow).

## Feature Set
### Phase 1: Replicate Model (Done)
- **Input:** Single image (face selfie).
- **Core Logic:** Face parsing, Skin stats, Seasonal classification, Color deck generation.
- **Output:** JSON with Skin hex, Season, Best Colors, Neutrals, Avoid Colors.

### Phase 2: Web App V1 (Done)
- **Framework**: Next.js 16 + Tailwind CSS 4.
- **UI**: "High-Fashion" Editorial Design.
- **Feature**: Drag & Drop Upload, Replicate API integration.

### Phase 3: UI Polish & Features (Done)
- **Mobile Experience**: Bottom-aligned "sheet" results, in-card avatar.
- **Desktop Experience**: Split-screen (Image Left / Results Right).
- **Report**: Print-to-PDF functionality.

### Phase 4: Performance & Robustness (Done)
- **Async Polling**: Fixes Vercel 504 timeouts.
- **Error Handling**: Consolidated error messages.

### Phase 5: Supabase & Tracking (Done)
- **Backend Database**: Integrated Supabase.
- **Tracking**: Logs every analysis run (status, model version, prediction ID) to `tracking_logs` table.
- **Schema**: `companies` table created for future login features.

### Phase 6: Live Capture (In Progress)
- **Library**: Google MediaPipe `tasks-vision` for client-side face detection.
- **Component**: `CameraCapture` provides real-time feedback (Lighting score, Face detection).
- **Workflow**: 
    - Full-screen camera overlay layout.
    - Needs debugging: Flow transitions and mobile responsiveness.

## Roadmap
- [x] Phase 1: Engine & Deployment.
- [x] Phase 2: Web App Basic Integration.
- [x] Phase 3: UI Polish.
- [x] Phase 4: Performance Tuning.
- [x] Phase 5: Supabase & Tracking.
- [/] Phase 6: Live Capture Experience & Full-screen Workflow.
- [ ] Phase 7: Authentication & Company Profiles.

## Changelog
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
