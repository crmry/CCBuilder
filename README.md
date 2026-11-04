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

Documents are processed locally with LibreOffice WebAssembly in a Web Worker, or (when LibreOffice cannot start) with a bundled DOCX preview + canvas/PDF fallback: no document upload, account or server storage. Converted files are kept in browser memory only until cleared or the page is closed. The first visit downloads ~30 MB of runtime, then caches it. It requires a modern desktop-class browser and approximately 1 GB of memory. Password-protected documents aren't supported.

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

## Unified workspace and A4 normalization

Builder and PDF Converter retain the same collapsible sidebar and navigate in the **same browser tab**. `/` opens `main.html` directly, while `/converter/` opens the PDF converter. The prior embedded Builder iframe was removed after cross-origin isolation (needed by LibreOffice) prevented it from loading. Changing between pages reloads the page; save any unsaved Builder edits before navigating.

The converter includes two page-layout options:

- **Apply CCBuilder A4 standard** (default): rewrites the page-size and page-margin settings for all sections of a temporary DOCX copy before passing that copy to the LibreOffice WebAssembly engine. A4 portrait, top 1.5 in, right 0.5 in, bottom 1 in, left 1 in. The original Word document remains untouched.
- **Preserve original Word layout**: sends the original DOCX directly to the converter without changing its page settings.

This conversion is **best-effort**: complex tables and page breaks can reflow when margins are changed, and PDF fidelity depends on installed fonts and LibreOffice. Review each generated PDF. The ZIP edit is performed client-side via [fflate](https://github.com/101arrowz/fflate), bundled and served from the same GitHub Pages origin (MIT).

### Collapsible sidebar

The shared sidebar starts as a narrow icon rail on desktop. Hover over it to reveal **Builder** and **PDF Converter**, or click the hamburger icon to pin it open. Click again to unpin and return to the compact layout. Pinned state is remembered for the current browser tab. When pinned, the workspace content shifts to make room; a temporary hover preview overlays the content without changing form state. On mobile, the hamburger opens a dismissible navigation drawer (tap outside or press Escape to close). Neither action navigates away or reloads the Builder.

## PDF conversion engine failover

Select **Automatic** (default), **LibreOffice only**, or **Browser renderer only** in the PDF Converter. Automatic attempts LibreOffice first and switches to the browser fallback if its worker fails or times out. LibreOffice runs from pinned upstream assets deployed alongside the site; the converter probes worker/manifest availability and provides improved worker-error diagnostics. An existing service worker is also updated on load to reduce stale assets.

The fallback uses locally bundled [docx-preview](https://github.com/VolodymyrBaydalka/docxjs), JSZip, and html2canvas, plus the local PDF writer. It renders the DOCX into off-screen HTML, captures each rendered page, and produces an **image-based PDF**. This is not equivalent to Word or LibreOffice pagination: automatic page breaks, long tables, fonts, text search, selectable text, accessibility, and section layout may be less accurate. For official records, review PDFs before use. A4 normalization (1.5-inch top, 0.5-inch right, 1-inch bottom, 1-inch left) modifies only a temporary copy; "Preserve original" keeps the Word document's page settings where possible.

The fallback is offered even when cross-origin isolation cannot be enabled or LibreOffice import fails. The PDF renderer needs adequate browser memory, especially for multi-page reports. No browser-only engine can guarantee identical output to Microsoft Word for arbitrary DOCX files.

### Standalone browser PDF output (November 2026)
The fallback no longer depends on jsPDF (which previously failed to load on GitHub Pages). It encodes page JPEGs into a minimal PDF file locally using browser Blob and typed arrays. The PDF remains image-based and is not text-searchable; check page layout before official use.

## A4 browser-fallback content placement (November 4, 2026)

For **Apply CCBuilder A4 standard**, the browser fallback now detects the rendered visible page content (including headers and footers), removes blank whitespace around it, and places it **without distortion** inside the A4 printable rectangle: 38.1 mm from top, 25.4 mm from left, 12.7 mm from right and 25.4 mm from bottom. The image-based renderer can shrink contents to fit and cannot guarantee Word's exact pagination. This bounds enforcement is specific to the fallback; the higher-fidelity LibreOffice path uses OOXML margin normalization instead. **Preserve original Word layout** retains full rendered pages rather than enforcing CCBuilder margins.

### GitHub Pages vendor asset fix (November 4, 2026)
The browser fallback's required files now live directly under `converter/vendor/` in the repository: `jszip.min.js` (JSZip, MIT/GPLv3), `docx-preview.min.js` (docxjs, MIT), and `html2canvas.min.js` (html2canvas 1.4.1, MIT). This fixes missing vendor files when GitHub Pages publishes from the branch instead of running the custom Actions assembly workflow. The build workflow can still replace these with pinned npm-distributed builds. Browser fallback v5 uses cache-busted asset URLs. The office-converter WebAssembly runtime still requires the GitHub Actions assembly workflow, so branch-only publishing should use the browser fallback engine. Check the deployed paths `/CCBuilder/converter/vendor/jszip.min.js`, `/CCBuilder/converter/vendor/docx-preview.min.js`, and `/CCBuilder/converter/vendor/html2canvas.min.js` if conversion reports missing scripts.

## Hybrid temporary runtime caching (November 4, 2026)

The converter's **scoped service worker** now works in two environments:

- **GitHub Actions Pages build:** the workflow publishes the complete pinned LibreOffice WebAssembly runtime, and the upstream service worker handles compressed WASM downloads and versioned `lo-assets-*` Cache Storage. Only runtime binaries are persisted; uploaded documents are not stored there.
- **Branch-only Pages build:** when `office-converter/service-worker.js` is missing, the worker falls back to caching only the locally committed browser dependencies under `ccbuilder-browser-runtime-20261104-v1`. Older fallback runtime cache versions are removed during activation. Missing LibreOffice entrypoints are detected without trying to start the engine.

Uploaded DOCX files, intermediate conversion buffers, generated PDF blobs and download URLs remain in the page's memory; `Clear Files` and navigation away release application references and object URLs. Browsers reclaim memory; literal disk/OS temporary-file erasure and physical secure deletion cannot be guaranteed, and browser-managed runtime caches intentionally remain after closing the tab to speed later use. No DOCX/PDF is written to Cache Storage.

**The 404 for `office-converter/engine-worker.js` cannot be fixed by caching alone.** To enable LibreOffice, configure repository Settings → Pages → Source = **GitHub Actions**, and run `.github/workflows/pages.yml` on `main`. If only branch publishing is enabled, the browser renderer remains functional without LibreOffice.
