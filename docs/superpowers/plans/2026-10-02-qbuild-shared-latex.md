# Qbuild shared Convert LaTeX pipeline

> Implement inline using superpowers:executing-plans, with regression tests before changes.

Goal: Qbuild question, options, detailed answers and smart paste use the same text/math processing as Convert.
Architecture: Extract Convert renderer and its pure helpers into src/utils/latex-content.ts; both views call it. Preserve question storage, native Word export and mobile pricing behavior.

- [x] Reproduce multiline and nested-environment failures against existing Qbuild renderer.
- [x] Extract one shared renderer from Convert; protect complete nested math environments and code blocks. Preserve original LaTeX in data attributes for Word.
- [x] Use shared processing for question and answer paste, bypass automatic AI splitting just as Convert does. Keep explicit smart-paste splitting/review.
- [x] Protect math during option parsing and smart question/answer splitting; no rewriting mathematical meaning.
- [x] Verify regression tests, existing Word tests, build, and browser Qbuild question/solution preview; publish to GitHub.

No new dependencies. No equation images. Keep AI review and question types intact.

Verification: 35 tests pass (LaTeX and existing Word suite); targeted TypeScript passes; build passes. Browser: Qbuild question/solution paste preserves multiline and nested formulas, preview has zero KaTeX errors; smart-paste input retains original source. Independent final review passed. Full repo lint still reports the existing workflow client error and older scratch fixtures; no new source-file type errors.
