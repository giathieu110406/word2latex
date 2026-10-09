# Ponytail audit — 2026-10-08

- delete: Google Sync Hub UI, Drive Picker/session/Docs adapters, AI Work workflow and endpoint branch. The feature is explicitly removed; keep Firebase authentication, Gemini conversion and QBuilder.
- delete: Sync Hub-specific tests/specs/plans and Google Picker OAuth configuration. They describe the removed feature.
- delete: Direct dependencies `@react-oauth/google`, `@types/gapi`, `@types/gapi.client.docs`, `@types/gapi.client.drive`, and `@vercel/functions` after verifying no remaining application imports. Workflow remains required by MarkItDown.
- delete: One-off root `add_admin_route.cjs`, `fix_*.cjs`, `update_admin_payments.cjs`, and `test_katex.cjs` are manual patch/debug scripts, unreferenced by package scripts or application imports. Preserve their existing uncommitted contents in ignored `scratch/cleanup-2026-10-08/` rather than discard them.
- delete: Firebase emulator/debug logs are generated output; preserve them in the same ignored archive.

No unrelated architecture or dependencies are changed. Keep the user's text file, existing pet plan, environment secrets, and source drawing checkout untouched. The drawing application is copied from its current working tree, including its latest edits.

- delete: Unimported `src/components/MarkitdownWorkflowClient.tsx` calls a nonexistent `workflow.client` API. It is unused by the actual MarkItDown UI; remove this dead adapter.
- delete: `test/backend.test.ts` and `test/markitdown-workflow.test.ts` only assert imported objects are defined, have no behavioral coverage, and require an uninstalled Vitest framework. Remove these empty checks; retain the real workflow and conversion tests.
- shrink: Exclude ignored `scratch/` and generated `dist/` from TypeScript checks so obsolete staging copies and archived scripts do not become application source.

Applied cleanup removed 21 tracked obsolete files (1,109 lines in those files), removed additional feature branches/imports/configuration, and dropped 5 direct dependencies. Eleven existing patch/debug artifacts were preserved in the ignored archive. This count excludes the newly integrated drawing application and regression checks.

Validation: build, TypeScript and 36 repository tests passed; Playwright CLI verified drawing, subscription header and mascot mouse/touch behavior. See `docs/verification-2026-10-08-drawing.md` for exact coverage and limitations.

net: -1109 lines in removed files, -5 direct dependencies (cleanup scope).
