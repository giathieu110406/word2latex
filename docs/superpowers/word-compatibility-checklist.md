# Native Word compatibility checks

## Automated verification
- Run `npm run test:word` to regenerate `scratch/word-export/word-compatibility.docx`.
- Tests inspect actual ZIP parts, XML namespaces, equation arguments and accents, Vietnamese text boundaries, paragraph formatting, QBuild's real option/answer transformation and clipboard cleanup.
- Browser verification uses the shared production module. Copy/paste confirmed both HTML with native vector accents and plain text with original LaTeX. No equation image is produced.
- Well-formed XML and browser success do **not** prove native Word import or full OOXML schema compliance.

## Matrix to run on actual user machines
Record Word version/build under File → Account → About Word, Windows version, browser/version and whether destination is .docx or Compatibility Mode.

For Word 2013, Word 2016 and Microsoft 365:
1. Open `word-compatibility.docx`; no repair/conversion warning should appear.
2. Click DA/DC/DB accents and fractions: Word must offer Equation controls; arrows must span the full two-letter base.
3. Check root index, subscripts/superscripts, matrix cells, Vietnamese accents/spaces and over/underbars.
4. Export a QBuild exam with one/two/four option columns, institutional/centered headers, question numbering and answers on/off. Check content order, table boundaries and shaded answers.
5. Copy the same formula through the web's Copy button into a new .docx using Keep Source Formatting. Repeat twice and compare with opening the exported DOCX.
6. Copy from the exported DOCX into an existing Word file. Test Compatibility Mode separately; save a copy as .docx before comparing.
7. Confirm document and formulas remain editable, without equation pictures.

## Expected limitations
- Text-only paste deliberately preserves original LaTeX delimiters instead of flattening vectors to `DA→`. It does not automatically become an Equation.
- Word's destination style and importer can still affect direct browser paste. Use the native DOCX path for troubleshooting; never silently substitute images.
- Invalid LaTeX or mathematical structures the converter cannot safely represent stop the operation with the source formula in the error. Examples include unsupported glyph/phantom/padded structures.
- Original embedded images, SVG, canvas, media and vertical table merges currently stop export explicitly; they are not silently omitted or used as equation fallbacks.
- Hyperlink text is preserved; the DOCX serializer currently emits it as editable text rather than an active hyperlink.
- Native Word 2013/2016/365 rendering has not been verified in this session.

## Dependencies
- `mathml2omml@0.4.0` (LGPL-3.0-or-later) converts supported MathML; our wrapper repairs known bar/group-character structures and protects text whitespace/XML escaping. Upstream license is in the installed package.
- `jszip@3.10.1` packages OOXML parts. It was already a transitive runtime dependency and is now explicit.
- `jsdom`/`@types/jsdom` are development-only DOM test dependencies.
