# Citizen Charter Builder

A browser-based Citizen's Charter authoring and publishing tool with only two sidebar entries: **Builder** and **PDF Converter**.

## Pages
- [Builder](https://crmry.github.io/CCBuilder/)
- [PDF Converter](https://crmry.github.io/CCBuilder/converter/) (after Pages Actions deployment)
- [Builder mirror](https://crmry.github.io/CCBuilder/main.html)

## Builder
The Builder's existing functionality remains intact: CKEditor, requirements and process steps, save/open JSON, and browser Print / Save as PDF. Its official PDF layout is **A4 portrait** with **top 1.5 in, right 0.5 in, bottom 1 in, left 1 in**. No export/margin code is changed.

## PDF Converter
Drag & drop or select up to 20 DOCX files (50 MB each), press **Convert to PDF**, and download the PDFs individually or all at once. The browser may request permission for multiple downloads.

Documents are processed locally with LibreOffice WebAssembly in a Web Worker: no upload, account or server storage. Converted files are kept in browser memory only until cleared or the page is closed. The first visit downloads ~30 MB of runtime, then caches it. It requires a modern desktop-class browser and approximately 1 GB of memory. Password-protected documents aren't supported.

**Formatting:** Word documents retain their own page dimensions and margin settings to the extent that LibreOffice can render them; the Builder's separate 1.5-inch top margin does not override uploaded DOCX files.

### GitHub Pages deployment
1. Merge the feature PR once reviewed.
2. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions** as the publishing source.
3. The workflow [pages.yml](.github/workflows/pages.yml) builds the static site using a pinned upstream [serverless-office-converter](https://github.com/Skitionek/serverless-office-converter) revision. The engine binaries are not committed in this repo.
4. Confirm the Pages action succeeded, then visit `/CCBuilder/converter/` in a desktop browser and test DOCX→PDF.

Pull requests build the artifact but never deploy. The `converter/sw.js` service worker has subdirectory scope so the Builder and its CKEditor external assets are unaffected by cross-origin isolation.

The LibreOffice runtime is MPL-2.0 and the xz decoder is MIT; review the upstream project's own wrapper licensing before redistributing.

## Local usage
The Builder can run from a local static server. To test the converter locally, first place the pinned upstream `web/office-converter/` into `converter/office-converter/`, then serve over HTTP (not `file://`) so its scoped service worker can run.
