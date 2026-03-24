# Hybrid UI, Accessibility & Desktop Rail — Design Specification

**Date:** 2026-03-23
**Scope:** Hybrid UI refresh, icon visibility fix, accessibility improvements, desktop-specific utility rail

---

## Overview

This design blends the strongest parts of two explored directions:

1. **Preserve the current product rhythm** — Drone Blast remains a one-screen, heatmap-first flight decision tool.
2. **Promote controls into first-class UI** — the current low-visibility settings gear is replaced with an obvious, touch-sized, labeled control.
3. **Make desktop intentional** — desktop uses a two-column layout with a right utility rail instead of behaving like a stretched mobile screen.

The app keeps the same data model, core widgets, and interaction model across breakpoints. The redesign is a responsive composition change, not a product restructure.

---

## 1. Hybrid Visual Direction

### Core principle

Use the familiar dark field-tool visual language from the current UI, but borrow the stronger framing and control visibility of the more structured instrument-panel concept.

### Result

- Summary cards remain at the top and keep the current quick-scan role.
- The heatmap remains the dominant visual surface.
- The timeline slider remains directly below the chart and continues to control the same windowing behavior.
- Visual polish focuses on spacing, grouping, control affordance, and readability instead of adding decorative chrome.

This keeps Drone Blast recognizable while addressing the current “utility leftovers” feel in the control layer.

---

## 2. Settings Icon Visibility Fix

### Current issue

The existing footer gear is too small, too low-contrast, and too visually merged with surrounding footer content. On mobile it reads as decoration instead of a primary control; on desktop it becomes even less justified because it floats as a lone glyph in a wide layout.

### Change

Replace the icon-only affordance with a **labeled settings control** that has:

- a visible button boundary
- a minimum 44 px hit area
- strong contrast in both themes
- an accessible name that does not rely on the glyph
- visual separation from legend content

### Placement by breakpoint

- **Mobile/tablet:** compact but explicit settings button, still within the primary control flow
- **Desktop:** settings moves into the right utility rail as a primary labeled action

The footer should no longer be responsible for carrying the main settings affordance.

---

## 3. Mobile / Narrow Layout

### Structure

On smaller widths, keep the single-column layout:

1. Header
2. Summary strip
3. Heatmap
4. Timeline slider
5. Footer / supporting meta

### Improvements

- Keep the hybrid visual language but avoid turning the screen into a crowded dashboard.
- Increase spacing around slider labels and footer content.
- Convert loose legend text into compact chips or clearer grouped labels.
- Make the settings affordance explicit and touch-friendly instead of icon-only.

The narrow layout remains compact, fast to scan, and finger-first.

---

## 4. Desktop Layout — Right Utility Rail

### Breakpoint behavior

At desktop widths, switch from a single-column stack to a **two-column shell**:

- **Main column:** header, summary, heatmap, timeline
- **Right utility rail:** settings, threshold, legend, small support/status blocks

### Goals

- keep the heatmap visually central
- use the extra width for persistent controls and context
- reduce footer clutter in the main content lane
- make desktop feel purpose-built rather than enlarged mobile UI

### Rail contents

The rail should hold:

- the labeled settings action
- threshold readout and threshold-related controls
- the legend
- optional lightweight secondary status/context blocks

The rail is a utility column, not a second application surface. It should stay concise and support the main chart rather than compete with it.

### Width discipline

On very wide screens:

- keep the main column at a readable max width
- keep the rail visually attached to the chart area
- avoid giant empty gaps between content areas

---

## 5. Accessibility Requirements

### Controls

- Replace icon-only primary actions with labeled controls where appropriate
- Maintain at least 44 px interactive targets for touch-relevant controls
- Ensure visible focus states for keyboard users
- Ensure settings has a proper accessible name independent of the gear glyph

### Visual communication

- Do not rely on color alone for status interpretation
- Preserve text labels for summary and legend states
- Improve contrast for muted metadata where needed, especially in footer/control areas

### Interaction

- Slider interaction must remain usable beyond pointer drag alone
- Desktop controls in the rail must be keyboard reachable in a sensible order

---

## 6. Implementation Strategy

### Approach

Implement this as **responsive composition using existing components**, not separate mobile and desktop products.

### Practical effect

- reuse the current data stores and logic
- preserve heatmap and slider behavior
- reposition or restyle UI blocks at desktop breakpoints
- introduce desktop-only shell/rail structure in `App.svelte` and supporting component layout

This minimizes behavioral drift and keeps maintenance manageable.

---

## 7. Expected File Areas

Likely files involved:

| File | Responsibility |
|---|---|
| `src/App.svelte` | responsive desktop shell, right rail placement, overall composition |
| `src/app.css` | global responsive layout rules, breakpoint sizing, spacing |
| `src/lib/components/ThresholdFooter.svelte` | mobile footer simplification or desktop suppression |
| `src/lib/components/SettingsSheet.svelte` | no structural redesign required, but button entry point changes |
| `src/lib/components/TimeSlider.svelte` | spacing, label readability, keyboard/accessibility pass |
| `src/lib/components/AppHeader.svelte` | desktop spacing and alignment adjustments |
| `src/lib/components/SummaryStrip.svelte` | desktop layout polish if needed |

Depending on implementation, a small dedicated rail component may be introduced if that keeps responsibilities clearer.

---

## 8. Testing & Verification

### Manual UI verification

- Mobile remains single-column and compact
- Desktop switches to a two-column layout with a right utility rail
- Settings is clearly visible and easily tappable/clickable in both mobile and desktop layouts
- Heatmap remains the primary focal element
- Desktop does not feel like a stretched phone screen

### Breakpoints

Verify at minimum:

- ~390 px mobile width
- ~768 px tablet width
- ~1024 px desktop width
- ~1280 px desktop width
- ~1440 px desktop width

### Accessibility

- focus states are visible
- settings control has a valid accessible name
- legend/status meaning is not color-only
- contrast remains acceptable in both themes

### Tooling

- Use Playwright screenshots for before/after mobile and desktop validation
- Run existing project checks/tests after implementation

---

## Non-Goals

- no routing changes
- no store/data model redesign
- no new multi-panel analytics experience
- no divergence in core behavior between mobile and desktop

The redesign is about layout quality, control clarity, and accessibility, not expanding scope.
