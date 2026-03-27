# Icon Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the web and Android icon assets from the approved Drone Blast logo artwork and make regeneration repeatable.

**Architecture:** Add a single artwork module that returns the SVG source for the full-logo mark, then update the asset generator to render every required web and Android output from that SVG. Keep Android XML resources aligned with the same dark background color so adaptive icons and splash screens stay consistent.

**Tech Stack:** Node.js, Sharp, Vitest, Capacitor Android resources

---

### Task 1: Add shared artwork source and test

**Files:**
- Create: `scripts/icon-artwork.mjs`
- Create: `src/tests/iconArtwork.test.ts`

- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run the test to verify it fails**
- [ ] **Step 3: Add the shared SVG artwork module**
- [ ] **Step 4: Run the test to verify it passes**

### Task 2: Regenerate web and Android assets from the shared artwork

**Files:**
- Modify: `scripts/gen-icons.mjs`
- Modify: `public/favicon.svg`
- Modify: `public/icons/favicon-64.png`
- Modify: `public/icons/icon-192.png`
- Modify: `public/icons/icon-512.png`
- Modify: `android/app/src/main/res/mipmap-*/ic_launcher*.png`
- Modify: `android/app/src/main/res/drawable*/splash.png`
- Modify: `android/app/src/main/res/drawable/ic_launcher_background.xml`
- Modify: `android/app/src/main/res/values/ic_launcher_background.xml`

- [ ] **Step 1: Update the generator to emit the full asset set**
- [ ] **Step 2: Run the generator to rebuild the binary assets**
- [ ] **Step 3: Verify the expected files were updated and dimensions still match**

### Task 3: Validate the result

**Files:**
- Verify only

- [ ] **Step 1: Run the focused artwork test**
- [ ] **Step 2: Run project checks relevant to the changed code**
- [ ] **Step 3: Inspect git diff for the expected resource changes**
