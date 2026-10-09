# Workspace drawing integration and cleanup verification

The current working tree of `D:/OneDrive/Tài liệu/ChatGPT/vẽ Hình` is copied to `public/ve-hinh/`. Its interface, document model and SVG renderer are preserved. Only asset URLs, namespaced AI calls and the incorrect KaTeX script integrity digest were adapted. The original checkout was not modified.

## Implemented

- Workspace → Vẽ hình loads a same-origin iframe, mounted on first use and kept mounted while switching tools.
- Drawing fills the entire region below the existing topbar. Desktop sidebar opening reserves 256px and closing restores the full width; mobile sidebar retains the existing overlay behavior. The outer card, padding and footer do not consume drawing space.
- `/api/ve-hinh?action=config|reconstruct` is mounted locally and configured as a serverless entrypoint. The original provider adapter, input/schema validation, review-before-apply and manual Codex import remain. Authenticated calls reuse the parent app's Firebase auth fetch, and provider requests use the existing approval guard.
- Optional server-only settings: `DRAWING_AI_ENDPOINT`, `DRAWING_AI_MODEL`, `DRAWING_AI_API_KEY`; original `AI_*` names remain compatible. No provider is currently configured (`configured: false`), so live AI reconstruction was not tested.
- Google Sync Hub UI, Drive/Docs/session adapters, AI Work endpoint/workflow, dedicated tests/design documents and 5 direct dependencies were removed. Firebase login, Google sign-in and other Gemini/MarkItDown functionality remain.
- One-off root patch/debug scripts and logs were moved to ignored `scratch/cleanup-2026-10-08/` to preserve their existing uncommitted contents. Ignored staging copies are excluded from TypeScript.
- Active paid Pro uses the existing expiry-aware `activePlan` value to show “Gói đăng ký”; it opens the existing pricing page showing the current plan and expiry. Expired Pro keeps the upgrade behavior.
- Mascot prevents native anchor dragging, captures the originating pointer, releases on up/cancel/lost capture and unmount, and blocks both Zalo links while dragging and for 2000ms afterward. Each drag movement resets the deadline. Pointer-up does not navigate.

## Verified

- `npm run build`: passed, including bundled Node server and static drawing assets. Existing large-chunk warning remains.
- `npm run lint`: passed.
- `node --import tsx --test tests/drawing.test.ts tests/latex-content.test.ts tests/word-export.test.ts`: 36 passed, 0 failed.
- Original drawing repository `npm test`: 67 passed, 0 failed. Core model/render modules were copied without changes.
- `git diff --check`: passed.
- Dev process remains running in session 61396; live GET `/` returned HTTP 200 and drawing config returned JSON `{ "configured": false }`.
- Playwright CLI: create and drag points, Undo/Redo, save/open JSON, download SVG/PNG, preserve drawing across navigation, switch all four modes, absent Sync Hub menu.
- Actual iframe bounds: 1440×900 viewport → `(0,74,1440,826)`; desktop sidebar open → `(256,74,1184,826)`; 390×844 viewport → `(0,66,390,778)`.
- Playwright CLI: active Pro label and plan/expiry view; expired Pro upgrade label.
- Playwright CLI: desktop mascot dragging, immediate click blocked, repeated drag resets cooldown, one valid popup after 2 seconds. Zalo destination was intercepted locally rather than contacting Zalo.
- Chromium touch emulation: touch drag, pointer cancel, immediate click blocked, subsequent mouse drag succeeds after capture release.
- Latest drawing browser run had no page errors and no new console errors after fixing the source's incorrect KaTeX integrity digest. Earlier failure logs are retained by the CLI.

## Reproduce browser checks

Open a CLI session and run these in sequence:

```powershell
npx --yes --package @playwright/cli playwright-cli -s=word2latex open http://localhost:3000 --browser chrome
npx --yes --package @playwright/cli playwright-cli -s=word2latex run-code --filename=tests/browser/verify-drawing.js
npx --yes --package @playwright/cli playwright-cli -s=word2latex run-code --filename=tests/browser/verify-pet.js
npx --yes --package @playwright/cli playwright-cli -s=word2latex run-code --filename=tests/browser/verify-subscription.js
npx --yes --package @playwright/cli playwright-cli -s=word2latex run-code --filename=tests/browser/verify-pet-touch.js
```

Browser checks use an isolated account fixture and disable App subscriptions only in the browser-served module; production auth code and real subscription data are unchanged. They verify the actual React markup, event handlers and drawing app, but do not prove real Google/Firebase login or authenticated live AI requests. Physical phone/camera behavior is unverified. No push or deployment was performed.

Screenshots: `scratch/drawing-desktop.png`, `scratch/drawing-sidebar.png`, `scratch/drawing-mobile.png`, `scratch/subscription-pro.png`.
