# Hybrid UI, Accessibility & Desktop Rail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved hybrid UI refresh by fixing the settings icon visibility issue, improving control accessibility, and adding a desktop-only right utility rail while preserving the existing heatmap-first workflow.

**Architecture:** Keep one shared app with the same stores, data flow, and core widgets across breakpoints. Introduce a desktop utility rail as a responsive composition change in `App.svelte`, move settings/threshold/legend responsibilities into the right place per breakpoint, and add explicit keyboard handling for the timeline slider through a small tested helper instead of burying key logic inside the Svelte component.

**Tech Stack:** Svelte 5, TypeScript, Vite, Vitest, Playwright/manual screenshot verification

---

## File Map

| File | Change |
|---|---|
| `src/lib/sliderNavigation.ts` | New pure helper for keyboard slider navigation and offset clamping |
| `src/tests/sliderNavigation.test.ts` | New Vitest coverage for slider keyboard behavior |
| `src/lib/components/TimeSlider.svelte` | Wire keyboard support and spacing/readability improvements |
| `src/lib/components/DesktopUtilityRail.svelte` | New desktop-only rail for settings, threshold, legend, and light status context |
| `src/App.svelte` | Introduce responsive desktop shell and rail placement; move settings entry point out of lone footer icon on desktop |
| `src/app.css` | Add desktop shell layout rules and shared breakpoint spacing |
| `src/lib/components/ThresholdFooter.svelte` | Simplify mobile footer, replace icon-only settings affordance with explicit labeled button, suppress footer responsibility on desktop as needed |
| `src/lib/components/SummaryStrip.svelte` | Desktop sizing and spacing polish for summary cards |
| `src/lib/components/AppHeader.svelte` | Desktop spacing/alignment polish to match the new shell |

No store or service changes are required. The redesign is layout and interaction focused.

---

### Task 1: Add tested keyboard navigation helper for the timeline slider

**Files:**
- Create: `src/lib/sliderNavigation.ts`
- Create: `src/tests/sliderNavigation.test.ts`
- Modify: `src/lib/components/TimeSlider.svelte`

- [ ] **Step 1: Write the failing test file**

Create `src/tests/sliderNavigation.test.ts` with focused cases for the keyboard behavior we want on the slider:

```ts
import { describe, expect, it } from 'vitest';
import { nextOffsetFromKey } from '../lib/sliderNavigation';

describe('nextOffsetFromKey', () => {
  it('moves one hour with arrow keys', () => {
    expect(nextOffsetFromKey('ArrowRight', 12, 144)).toBe(13);
    expect(nextOffsetFromKey('ArrowLeft', 12, 144)).toBe(11);
  });

  it('moves by six hours with page keys', () => {
    expect(nextOffsetFromKey('PageDown', 12, 144)).toBe(18);
    expect(nextOffsetFromKey('PageUp', 12, 144)).toBe(6);
  });

  it('jumps to bounds with home/end', () => {
    expect(nextOffsetFromKey('Home', 12, 144)).toBe(0);
    expect(nextOffsetFromKey('End', 12, 144)).toBe(144);
  });

  it('returns null for unsupported keys', () => {
    expect(nextOffsetFromKey('Enter', 12, 144)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/tests/sliderNavigation.test.ts`

Expected: FAIL because `src/lib/sliderNavigation.ts` does not exist yet.

- [ ] **Step 3: Implement the helper**

Create `src/lib/sliderNavigation.ts`:

```ts
function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function nextOffsetFromKey(
  key: string,
  current: number,
  max: number
): number | null {
  switch (key) {
    case 'ArrowLeft':
      return clamp(current - 1, max);
    case 'ArrowRight':
      return clamp(current + 1, max);
    case 'PageUp':
      return clamp(current - 6, max);
    case 'PageDown':
      return clamp(current + 6, max);
    case 'Home':
      return 0;
    case 'End':
      return max;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Wire keyboard support into `TimeSlider.svelte`**

Import the helper and add key handling on the slider root:

```ts
import { nextOffsetFromKey } from '../sliderNavigation';

function onTrackKeydown(e: KeyboardEvent) {
  const next = nextOffsetFromKey(e.key, hourOffset, MAX_OFFSET);
  if (next === null) return;
  e.preventDefault();
  onChange(next);
}
```

Then attach:

```svelte
on:keydown={onTrackKeydown}
aria-label="Forecast timeline"
```

- [ ] **Step 5: Re-run the focused test**

Run: `npm test -- src/tests/sliderNavigation.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the full existing test suite**

Run: `npm test`

Expected: all existing tests plus the new slider navigation test pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/sliderNavigation.ts src/tests/sliderNavigation.test.ts src/lib/components/TimeSlider.svelte
git commit -m "feat: add accessible keyboard navigation for time slider"
```

---

### Task 2: Add the desktop utility rail component

**Files:**
- Create: `src/lib/components/DesktopUtilityRail.svelte`
- Modify: `src/App.svelte`

- [ ] **Step 1: Create the new rail component**

Create `src/lib/components/DesktopUtilityRail.svelte` with explicit props:

```ts
export let thresholdKmh: number;
export let unit: WindUnit;
export let onSettings: () => void;
```

The component should render:

- labeled settings button (`Settings & Units`)
- threshold readout
- legend chips with text labels
- optional small support/status block placeholder that can be filled from existing app state later

Do not add new data dependencies beyond what already exists in `App.svelte`.

- [ ] **Step 2: Keep the settings control accessible**

Inside the rail component, use a real button:

```svelte
<button class="settings-btn" on:click={onSettings} aria-label="Open settings">
  <span class="gear" aria-hidden="true">⚙</span>
  <span>Settings & Units</span>
</button>
```

The gear is decorative; the text carries the accessible meaning.

- [ ] **Step 3: Add the rail to `App.svelte` behind a desktop shell**

Import the component and place it next to the main content lane only in the loaded state:

```svelte
<div class="desktop-shell">
  <div class="main-column">
    <!-- existing main UI pieces -->
  </div>
  <DesktopUtilityRail ... />
</div>
```

Do not duplicate any business logic inside the rail.

- [ ] **Step 4: Run type/check validation**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/DesktopUtilityRail.svelte src/App.svelte
git commit -m "feat: add desktop utility rail"
```

---

### Task 3: Convert the app shell to responsive desktop composition

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/app.css`

- [ ] **Step 1: Replace the flat loaded-state stack with explicit layout wrappers**

In `src/App.svelte`, group the loaded-state UI into:

```svelte
<div class="desktop-shell">
  <div class="main-column">
    <AppHeader ... />
    <SummaryStrip ... />
    <div class="chart-area">
      <HeatmapCanvas ... />
    </div>
    <TimeSlider ... />
    <ThresholdFooter ... />
  </div>

  <DesktopUtilityRail ... />
</div>
```

The rail should be present in markup for the loaded state only, not for loading/error/full-screen message states.

- [ ] **Step 2: Add desktop breakpoint rules in `src/app.css`**

Add rules for:

- `.desktop-shell`
- `.main-column`
- `.desktop-rail`

Suggested structure:

```css
.desktop-shell {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

@media (min-width: 1024px) {
  .desktop-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
    padding: 16px;
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
  }

  .main-column {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
}
```

Keep the main content readable on wide screens; do not let the rail drift too far away.

- [ ] **Step 3: Hide or reduce the desktop footer responsibility**

Use breakpoint-specific CSS so the footer in the main column does not duplicate what the rail already shows on desktop.

That can mean either:

- hiding the footer entirely on desktop, or
- keeping a reduced footer with only secondary info

The rail owns settings/threshold/legend on desktop.

- [ ] **Step 4: Run checks**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.svelte src/app.css
git commit -m "feat: add responsive desktop shell layout"
```

---

### Task 4: Replace the icon-only footer control on mobile and clean up supporting UI

**Files:**
- Modify: `src/lib/components/ThresholdFooter.svelte`
- Modify: `src/lib/components/SummaryStrip.svelte`
- Modify: `src/lib/components/AppHeader.svelte`

- [ ] **Step 1: Rework `ThresholdFooter.svelte` to use an explicit mobile settings button**

Replace the loose gear button with a labeled mobile control:

```svelte
<button class="settings-btn" on:click={onSettings} aria-label="Open settings">
  <span class="gear" aria-hidden="true">⚙</span>
  <span>Settings</span>
</button>
```

Keep the footer compact, but make the button visually distinct from the legend.

- [ ] **Step 2: Convert legend items into clearer grouped chips**

Within `ThresholdFooter.svelte`, replace the current dot + loose text sequence with grouped elements so they read as units and wrap cleanly on narrow screens.

Example shape:

```svelte
<span class="legend-chip ok">OK</span>
<span class="legend-chip warn">±20%</span>
<span class="legend-chip danger">No-fly</span>
```

- [ ] **Step 3: Add desktop polish to `SummaryStrip.svelte`**

Adjust card padding, label sizing, and gaps so desktop cards feel deliberate instead of like enlarged mobile blocks. Keep the same information architecture and status semantics.

- [ ] **Step 4: Add desktop header spacing polish in `AppHeader.svelte`**

Improve padding, alignment, and text sizing at desktop widths only. Do not add new controls to the header; the rail owns that responsibility.

- [ ] **Step 5: Run checks**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 6: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/ThresholdFooter.svelte src/lib/components/SummaryStrip.svelte src/lib/components/AppHeader.svelte
git commit -m "feat: improve settings visibility and supporting ui polish"
```

---

### Task 5: Refine slider spacing/readability and desktop/mobile visual fit

**Files:**
- Modify: `src/lib/components/TimeSlider.svelte`
- Modify: `src/app.css`

- [ ] **Step 1: Improve slider text spacing and hierarchy**

In `src/lib/components/TimeSlider.svelte`, increase spacing around:

- top-row hint/current label
- day tick labels
- track area

Keep the current gradient track and thumb behavior.

- [ ] **Step 2: Improve desktop legibility**

At desktop widths, increase the slider label font sizes and ensure the component width tracks the main column instead of spanning the full browser width.

- [ ] **Step 3: Preserve mobile density**

Do not let desktop spacing rules bloat the mobile layout. Keep narrow-screen text concise and compact.

- [ ] **Step 4: Run checks**

Run: `npm run check`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/TimeSlider.svelte src/app.css
git commit -m "feat: polish timeline slider spacing across breakpoints"
```

---

### Task 6: Verify the responsive redesign end-to-end

**Files:**
- No code changes required unless verification exposes issues

- [ ] **Step 1: Run type and test validation**

Run:

```bash
npm run check
npm test
```

Expected: both PASS.

- [ ] **Step 2: Run the app and capture desktop/mobile evidence**

Run the local app, then capture screenshots for at least:

- mobile around `390x844`
- desktop around `1280x900`
- desktop around `1440x900`

Use Playwright/manual verification to confirm:

- mobile remains single-column
- desktop uses the right utility rail
- settings is visible and labeled in both layouts
- footer no longer carries the lone icon problem
- heatmap remains the primary visual surface

- [ ] **Step 3: Fix any issues found during verification**

If screenshots or interaction checks expose regressions, fix them before finalizing.

- [ ] **Step 4: Final commit**

```bash
git add src/App.svelte src/app.css src/lib/components/DesktopUtilityRail.svelte src/lib/components/ThresholdFooter.svelte src/lib/components/SummaryStrip.svelte src/lib/components/AppHeader.svelte src/lib/components/TimeSlider.svelte src/lib/sliderNavigation.ts src/tests/sliderNavigation.test.ts
git commit -m "feat: implement hybrid ui with accessible desktop rail"
```
