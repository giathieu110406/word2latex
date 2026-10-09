# Drawing edge selection, grid and compact controls — 2026-10-09

The original SVG aspect ratio leaves letterboxed space when the canvas differs from 1000×660. Region coordinates were clamped to that fixed viewBox, so a 1524px-wide canvas could only show a selection about 1078px wide, leaving roughly 223px unreachable on each side. The grid rectangle was limited to the same fixed extent.

## Changes

- Preserve uniform SVG scaling, allow geometry to render into the letterboxed portions, and clip at the actual canvas boundary. Region selection clamps to physical canvas bounds before converting through the SVG matrix.
- Native repeating CSS dots cover the full geometric canvas. Their origin follows the model origin, pan and SVG transform; spacing preserves the original default grid density and follows zoom. ResizeObserver redraws after changes to either sidebar or viewport, and ignores hidden canvases.
- SVG export uses the complete visible canvas bounds. PNG height follows the actual aspect ratio, preserving geometry and transparency.
- Move Mở/Lưu JSON/Xuất hình below the canvas, compact the internal titlebar, and reduce the desktop tools sidebar from 320px to 260px. Retain all tools, properties, templates and AI controls.
- Put zoom controls in the existing canvas toolbar, leaving the board corners unobstructed. Align desktop file actions left; reserve space beside mobile file actions for the existing mascot.
- Original drawing source repository is unchanged; this updates the integrated copy only. Previous subscription, mascot and Sync Hub changes remain intact.

## Verification

- Reproduced failing edge selection before the fix; the regression now passes.
- Playwright CLI standalone canvas: 1600×900, 600×1000, 2200×850 and 390×844. Create points near all four corners, select across all four edges, resize, pan, zoom and check file buttons below the board.
- Grid spacing grows by 1.2 when zooming 100% → 120%; grid origin moves with pan. No page errors in the completed edge test.
- Embedded canvas: 9 desktop/mobile configurations with both inner and outer sidebars. Selection reaches the full visible board in each case. Mobile sidebars keep their existing overlay behavior and are closed before drawing interaction.
- Existing integration regression passes: point creation/drag, Undo/Redo, JSON save/reopen, SVG/PNG downloads, preserved drawing across tool navigation, full iframe height and absent Sync Hub.
- The actual Mở button opened the file chooser and successfully reopened the saved JSON through Playwright CLI upload.
- Exported mobile SVG has expanded bounds `0 -450.76922607421875 1000 1561.5385131835938`; the corresponding PNG is 2000×3123. Grid/background are omitted from exports.
- Two focused drawing API/export tests pass. TypeScript, JavaScript syntax checks and `git diff --check` pass. Final production build passes with the existing large-chunk warning.
- Dev GET `http://localhost:3000/` returns HTTP 200; the dev process remains running.

Run `verify-drawing-edges.js` standalone, or run `verify-drawing.js` followed by `verify-embedded-edges.js`, using `playwright-cli -s=word2latex run-code --filename=tests/browser/<file>`.

Screenshots: `scratch/drawing-finished-desktop.png`, `scratch/drawing-finished-mobile.png`, `scratch/drawing-edges-desktop.png`, `scratch/drawing-edges-mobile.png`.

Embedded tests use the existing isolated browser account fixture, with App subscriptions disabled only in the browser-served module. No real entitlement or production auth code is changed. Mobile is Chromium emulation, not physical-device verification. Live AI reconstruction remains unconfigured. No push or deployment was performed.
