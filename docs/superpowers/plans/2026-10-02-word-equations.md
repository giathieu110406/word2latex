# Editable Word Copy and Export Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task by task. User authorized immediate inline execution without additional questions.

**Goal:** Preserve editable equations in copy and real .docx exports for both LaTeX and QBuild.

**Architecture:** A shared Word module converts normalized MathML into OMML. It serializes the already prepared preview into DOCX and mutually exclusive Office/non-Office clipboard HTML. App handlers retain quotas and UI state.

**Tech Stack:** TypeScript, KaTeX, mathml2omml, JSZip, browser DOM/Clipboard API; Node test runner with tsx and xmldom for DOM fixtures.

**Spec:** docs/superpowers/specs/2026-10-02-word-equations-design.md

## Global Constraints
- No equation images; native editable equations only.
- Target Word 2013, 2016, Microsoft 365; native compatibility remains a manual verification requirement.
- Preserve dirty workspace changes and existing font/quota/QBuild behavior.
- Fail explicitly on invalid/unsupported equations and unsupported content; never silently omit it.
- No deployment or unrelated commits.

## Review Focus
1. Multi-character vector accents must remain above their entire base, including zero.
2. Vietnamese text and XML special characters must survive conversion and escaping.
3. Nested table/math structures and separate fraction arguments must not be flattened or merged.
4. Failed clipboard operations must clean listeners/temporary DOM and restore selection/focus without increasing quotas.
5. QBuild option columns/header/answers must remain table-based and text must retain source order.

### Task 1: Shared equation conversion
**Files:** Create src/utils/word-export.ts, tests/word-export.test.ts; update package.json and package-lock.json for direct dependencies only.
**Interfaces:** `mathmlToOfficeMath(mathml: string): string`, `prepareWordEquations(root: HTMLElement): void` stores native OMML alongside normalized MathML on a cloned preview.
- [x] Write regression tests for vectors DA/DC/DB/0, fraction arguments, roots/scripts, Vietnamese accents, matrices and invalid commands.
- [x] Run `node --import tsx --test tests/word-export.test.ts`; confirm missing implementation fails.
- [x] Implement conversion with strict KaTeX validation and conservative MathML normalization; reject unsupported tags and invalid OMML.
- [x] Run the same tests; confirm all conversion assertions pass.

### Task 2: DOCX and clipboard outputs
**Files:** Extend src/utils/word-export.ts and tests/word-export.test.ts.
**Interfaces:** `buildWordDocx(root: HTMLElement, font: string): Promise<Blob>`, `buildWordClipboard(root: HTMLElement, font: string): {html: string; text: string}`, `copyWordContent(payload): Promise<void>`, `downloadWordDocument(root, font, filename): Promise<void>`.
- [x] Add failing tests for DOCX ZIP parts, native equations without media, paragraph/text styles, QBuild tables/column widths, A4/margins, safe escaping, LaTeX plain fallback and exclusive HTML math branches.
- [x] Implement WordprocessingML serializer with paragraph/block boundaries, inline formatting, alignment, table widths/borders/shading, hyperlink text and explicit unsupported-content errors. Use JSZip for OPC package parts and relationships.
- [x] Implement clipboard writing of both MIME types with modern API then copy-event fallback, strict success checks and finally cleanup/selection restoration.
- [x] Run package/clipboard tests and inspect generated document.xml for native m:acc/m:f and correct element order.

### Task 3: Wire both features
**Files:** Modify src/App.tsx, src/components/QBuilder.tsx and src/components/LatexConverter.tsx only where export/copy wording or behavior changes.
**Consumes:** Shared interfaces from Tasks 1–2, existing injectInlineStyles clone preparation.
- [x] Add integration assertions that all four handlers use shared outputs; downloads end in .docx and failure paths do not fall back to raw preview copy.
- [x] Replace duplicated clipboard/download code while retaining guards, font settings and quota increments after success only.
- [x] Prepare equations before styling/QBuild layout conversion so regenerated HTML retains equation metadata.
- [x] Update QBuild .doc labels/help and copy failure messages; do not promise native compatibility already verified.
- [x] Run `npm run lint`, `npm run build`, regression suite and `git diff --check`. Distinguish pre-existing failures if present.

### Task 4: Browser check and review
**Files:** Add docs/superpowers/word-compatibility-checklist.md; tests emit a fixture DOCX into ignored test output.
- [x] Use browser automation to verify clipboard payload math structures, download MIME/ZIP, repeated copies, rejection cleanup and preview immutability.
- [x] Review only task changes, fix important findings and rerun relevant checks.
- [x] Save native Word 2013/2016/365 steps and report exactly what was/was not verified.

## Execution Ledger
- Plan self-review: shared interface names consistent; all five review conditions assigned above.
- Ruling: work inline in existing dirty checkout; new worktree would omit current uncommitted UI edits. No git history mutations.
- Task 1 complete: shared strict KaTeX/MathML normalization and OMML conversion; native vector accents, separated arguments and Vietnamese text verified.
- Task 2 complete: real DOCX ZIP and exclusive clipboard branches; modern API and synchronous fallback both covered. Selection/focus/listener cleanup tested.
- Task 3 complete: all four handlers use shared helpers, QBuild and converter labels use .docx, quotas remain after successful operation only. Removed obsolete HTML-disguised-as-DOC helper.
- Task 4 automated verification complete: 12/12 tests, scoped TypeScript check and production build passed. Browser copy/paste confirmed HTML native accents plus source LaTeX; generated ZIP magic/MIME and preview immutability checked. Browser download action returned DOWNLOAD_OK, but the download observer timed out, so persisted browser download path is unverified. A verified test-generated DOCX is saved under scratch/word-export.
- Fresh reviewer found under/overbar conversion errors and Vietnamese boundary whitespace loss. Both reproduced with failing tests, repaired, and suite passed. Actual QBuild option/display-equation transformation is also tested.
- Ruling: preserve mtext boundaries via placeholders because upstream trims tokens; repair library bar/group-character output before serialization. Unsupported structures stop with an error rather than flattening. Cost: rare unsupported formulas/content require further converter support.
- Baseline project lint still fails in MarkitdownWorkflowClient (workflow.client) and older tests missing vitest/testing-library dependencies. No errors in changed Word module/tests; these unrelated issues were present before edits.
- Native Word 2013/2016/365 checks remain unverified and are documented in docs/superpowers/word-compatibility-checklist.md. No deployment was performed.
