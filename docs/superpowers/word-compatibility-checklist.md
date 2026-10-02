# Native Word compatibility checks

## Automated verification
- Run `npm run test:word` to regenerate `scratch/word-export/word-compatibility.docx`.
- Tests inspect actual ZIP parts, XML namespaces, equation arguments and accents, Vietnamese text boundaries, paragraph formatting, QBuild's real option/answer transformation and clipboard cleanup.
- Browser verification uses the shared production module. Clipboard inspection confirms one native OMML branch (the Office HTML namespace), correctly cased XML tags and plain text with original LaTeX. No equation image is produced. This confirms clipboard contents, not Word's paste result.
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
- The shared converter emits native OMML directly from normalized KaTeX MathML. It uses explicit Cambria Math runs, valid style/script enums, growing delimiters and populated n-ary arguments. The former `mathml2omml` dependency was removed after user screenshots demonstrated malformed styles, fixed-size fences and empty operands in its output.
- `jszip@3.10.1` packages OOXML parts. It was already a transitive runtime dependency and is now explicit.
- `jsdom`/`@types/jsdom` are development-only DOM test dependencies.

## Follow-up from actual Word screenshots
- The earlier clipboard success only established that HTML was written. The user demonstrated flattened pasted formulas and malformed DOCX glyphs/layout.
- Replaced the converter and removed the conditional MathML fallback. Regression tests cover font-family extraction, math style/script enums, explicit math fonts, full and one-sided delimiters, n-ary operands, independent versus nested sums, braces, labeled arrows and deliberate spacing.
- Downloaded the same 20-question source through Chrome: 30 native equations. The old DOCX had 6 empty n-ary operands, no growing delimiters and invalid style values; the replacement output removes these structural defects.
- Direct Word paste/rendering of the replacement remains unverified. No Word document-control session or native app-control capability was available; never infer native compatibility from clipboard XML alone.
