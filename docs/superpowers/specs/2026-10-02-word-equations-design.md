# Editable Word equations

## Scope and intent
LaTeX converter and QBuild must copy and export editable equations for Word 2013, 2016 and Microsoft 365. Never rasterize equations or silently flatten structured equations into ordinary text. Preserve existing quotas, font choices, QBuild question numbering, option columns, answers and user edits.

## Current failure
Both downloads are HTML disguised as .doc. Both copy handlers send MathML embedded in HTML and use preview innerText as the plain-text alternative, losing equation structure when the receiver flattens it. The preview renderer and Word importer are different engines. Successful clipboard writes cannot confirm successful Word import.

## Design
Use KaTeX Presentation MathML as the shared intermediate, normalize accents and text conservatively, then convert to OMML using mathml2omml. Validate supported nodes before conversion and XML after conversion. Unknown structures or KaTeX errors must abort with an actionable message naming the source equation. Keep full mathematical arguments separated (never merge numerator and denominator text).

Export an actual OPC .docx ZIP using JSZip, already installed transitively, now declared directly. Serialize prepared preview HTML into WordprocessingML paragraphs, styled text, tables and native inline/display OMML. Preserve QBuild's existing preparation of option grids and answer tables. Reject unsupported content instead of dropping it. Equations never become media. Ordinary user-supplied images are a separate concern; preserve them when possible or reject explicitly, never silently omit.

For clipboard, generate Office HTML with a conditional OMML branch for desktop Word and a mutually exclusive MathML branch for other consumers. Use source LaTeX delimiters in text/plain, never preview innerText. Write HTML and plain text together using the Clipboard API; retain a carefully cleaned-up copy-event fallback for browsers lacking support/permission. Preserve prior selection/focus. Report failure without recommending raw preview copy. All four handlers call shared helpers and count usage only after success.

## Limits and validation
Automated checks prove XML structure, DOCX packaging and browser clipboard behavior, not native Word import. Test the supplied vector case, nested fractions/scripts, matrices, accents, Vietnamese text, unsupported syntax, tables, clipboard failure and selection cleanup. Produce a manual validation fixture/checklist for Word 2013/2016/365, including paste into new .docx and compatibility-mode documents. Do not claim universal compatibility without these native checks.

## Execution authorization
User explicitly requested a thorough plan followed by implementation without another question. Implement inline in the dirty current workspace to include and preserve existing edits; do not reset, stash, commit unrelated work or publish. User instructions override additional skill approval gates.
