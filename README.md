# Citizen Charter Builder

A browser-based Citizen's Charter authoring and publishing tool with only two sidebar entries: **Builder** and **PDF Converter**.

## Pages
- [Builder](https://crmry.github.io/CCBuilder/)
- [PDF Converter](https://crmry.github.io/CCBuilder/converter/) (after Pages Actions deployment)
- [Builder mirror](https://crmry.github.io/CCBuilder/main.html)

## Builder
The Builder's existing functionality remains intact: CKEditor, requirements and process steps, save/open JSON, and browser Print / Save as PDF. Its official PDF layout is **A4 portrait** with **top 1.5 in, right 0.5 in, bottom 1 in, left 1 in**. No export/margin code is changed.

## Citizen Charter Readiness Check

### Online and standard-form requirements

Copy counts apply to **paper supporting documents** (e.g., a Valid ID or certificate). The Readiness Check now recognizes a named **online form** or **standard office-issued form, slip, or template** and permits its Checklist entry without a fixed number of originals or photocopies, provided that **Where to Secure** identifies the issuing office, desk, website, or portal. This applies to examples such as **Job Order Request Form** obtained from `forms.clmmrh.org` and **Requisition and Issuance Slip** from the **Materials Management Section**.

An explicit instruction for physical or printed copies still requires their quantity and copy type. Ordinary documentary requirements, such as **Valid ID**, continue to require copy details. A source is always required; recognizing an online or standard form does not waive **Where to Secure**.

These rules check completeness of the entry and are not a substitute for verifying the office's actual procedure or prescribed number of copies. Requirements are not reworded or changed automatically.



### Approved plantilla position reference

### Suggested plantilla title corrections

When one or more **Person Responsible** entries use a near-match for an approved title, CCMain lists **each** unmatched title and offers a **Use suggested title** action (labelled **Apply: [approved title]**) beside the error in the Readiness dialog and inline field warning. If at least two safe matches are present, **Apply all suggested titles** explicitly accepts those suggestions together. Nothing is silently rewritten merely by running validation, opening a draft, or downloading a document.

Corrections operate only on the specific matching title text in the relevant CKEditor Person Responsible cell. They retain other plantilla positions, office names, HTML tags, line breaks and formatting, and do not alter the user's original JSON file on disk. After applying, the checker recomputes the remaining issues. Unrecognized entries without sufficiently close approved titles continue to require manual correction. The source catalogue and grading distinctions are unchanged.


The **Person Responsible** check uses the **130-title plantilla list supplied for this CCMain project**, embedded in `assets/plantilla-positions.js`. The list is bundled locally and does not contact an external server. The system compares each entered title against the reference using case-insensitive and whitespace-tolerant matching, while preserving the actual position title and grade. It accepts multiple titles followed by the responsible office/section/unit; office names are not compared against the list.

Unrecognized titles are flagged with the original text and, when a close match is found, a suggested title. No title or office is automatically overwritten. For example, **Nurse Attendant II** is not in the supplied list; **Nursing Attendant II** is. The supplied list includes both **Seamstress** and **Seamtress**, and these spellings are retained until the authoritative source is revised.

**Source governance:** the user-supplied list is the validation reference, not independent proof that a job title is an authorized government position or that personnel hold that position. Updates to the agency's actual plantilla should also update the bundled list and its tests. An unavailable reference prevents a clean readiness result rather than silently treating an unverified title as valid.


### CKEditor numbered-list continuity

The Readiness Check recognizes that CKEditor's ordered-list toolbar can show a number (for example, **1.**) without storing that number as literal text in the exported rich-text HTML. If the first filled Client Step has no explicit numeric prefix or numbered agency sub-action, the validator uses the **order of nonblank Client Step groups** to determine the active client-step number. Blank Client Steps are accepted for Agency Actions such as **1.2**, **1.3** and **1.4** when they continue the active group. Entering the next nonblank client action begins **Client Step 2**, and later **2.x** actions can continue it.

This does not waive the requirement to enter a first Client Step, and unrelated agency-action groups are still flagged. The earlier optional plantilla-correction replacement regex was also repaired; it remains opt-in, preserving the office and other titles.

### Client Step continuations and responsible plantilla positions

A single numbered **Client Step** may span multiple **Agency Actions**. Enter the client step on the first row (for example **1. Submit request**) and leave Client Steps blank on the continuation rows (**1.2**, **1.3**, **1.4**, etc.). The parser also recognizes compact text such as `1.2Assess` and rich text split around the action number. A blank initial Client Step or an action from a different major step still needs correction. Duplicate/skipped agency sub-action numbers are flagged **under Agency Actions**, not under the intentionally blank Client Steps. When the client takes a new action (e.g. **2. Answer the Client Experience Survey Form**), enter a new Client Step.

**Person Responsible** accepts multiple official plantilla positions in one cell, including a line-by-line list followed by the shared office (for example **Nurse Attendant II**, **Administrative Aide IV**, and **IMISS Office**). The checker still warns about missing offices and names without recognizable position titles. Automated matching is not an authoritative plantilla registry; confirm actual positions with the agency's approved plantilla records.


### JSON Open reliability (November 6, 2026)

**Open** now uses a single Builder-owned file handler instead of competing legacy/import-inspector handlers. It accepts complete saved charters and structurally valid but incomplete drafts; draft imports show precise JSON field/value explanations and must explicitly be opened for correction. Normalization supports previous backups using `requirement`/`whereToSecure`, `fees`/`time`/`person`, `whoMayAvail`, and `transactionTypes`. Missing text entries remain empty for the user to correct—never silently filled as compliant. Corrupt JSON and incompatible objects are rejected without overwriting the active form. The file picker is reset after each attempt so users can retry the same file. On-screen validation and PDF/JSON final-output blocking remain intact.

Run `node tests/json-open-regression.test.cjs` to verify direct and correction-only imports.


The Builder has a **Check Readiness** action. Each issue identifies its **exact input or table cell**, with a **Go to field** button that scrolls to and focuses the visible editor. Invalid fields are highlighted, with correction text beside the actual entry. A compact **Review issues** control remains accessible while errors exist and disappears after correction. **Save** (JSON) and **Preview / Save as PDF** run the same check before producing any final output. **Open** immediately rejects malformed or unrelated JSON files. For recognizable but incomplete Citizen Charter JSON, a dedicated import review identifies the exact JSON property (for example `processOverview[1].personResponsible`) and displays its current stored value and expected correction. The user may choose **Open for correction** to load it as an editable draft; this does not bypass the checks on Save or PDF export. The current form is not replaced unless the user selects that action (and confirms when the form already has entries).

Checked items include service details, classification, transaction type, eligibility, requirement documents and copy details (or explicit **None**), process-step actions, fees and processing time, responsible-person designation and office, and totals. For a free service enter **None** in each applicable Fees cell **and** Total Fees. A blank fee is not silently treated as free.

**Important:** Automated checks can screen for missing entries and likely personal names but **cannot confirm** that a position is an authorized plantilla item without an approved agency position list. Staff must verify position titles and substantive accuracy against their office's authoritative records. The application remains on-device, and the check does not send data to a server.

Unfinished work remains editable in the page and temporarily backed up for the current browser session. **Incomplete JSON may be opened only for correction; it may not be exported as a completed file.** Complete the validation before closing the browser if a file is needed. Run automated validation regression checks with `node tests/readiness-validation.test.cjs` and import diagnostics checks with `node tests/import-json-inspector.test.cjs`.

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

## DOCX-to-PDF formatting safeguards (converter build 2026-11-04.7)

In **Apply CCBuilder A4 standard** mode, the browser fallback now omits pages with no detectable visible pixels, places the rendered content without stretching inside an A4 page with top 1.5 in, right 0.5 in, bottom 1 in and left 1 in, and reports the number of skipped blank pages after conversion. **Preserve original Word layout** does not remove blank pages or enforce the CCBuilder margins. Blank detection uses a white-page raster scan: it does not attempt to reflow large tables across pages or remove pages containing footers or other visible marks.

These safeguards apply to **DOCX files converted by CCBuilder**. The converter currently does **not** accept existing PDFs for repair, and the separate Citizen Charter Builder print preview uses its own vector-print CSS `@page` settings. PDFs previously exported by Microsoft Word must be re-exported from their DOCX originals to benefit from the browser conversion safeguards; a separate PDF repair feature would be needed to modify already-existing PDFs in the website.

Browser-generated fallback PDFs are image-based, may shrink overly dense content, and still require page-by-page visual validation for official Citizen's Charter forms.

## Converter build 2026-11-04.8: prevent whole-document shrink-to-fit

The browser fallback previously fitted every rendered section's **entire height** into one A4 printable rectangle, which could squeeze several pages of tables into a single unreadably tiny page. Standard A4 mode now computes scale **from the printable width only** and slices excess height into successive A4 sheets. A short scan for a nearly blank horizontal gap attempts to avoid splitting letters where possible. Each output page retains the margins top 38.1 mm, left 25.4 mm, right 12.7 mm, bottom 25.4 mm; truly blank rendered pages are skipped. The original DOCX is not modified. This raster fallback may still split table rows or repeat neither headers nor footers at artificial splits; verify complex Citizen's Charter documents after download. LibreOffice remains preferable when its assets are deployed successfully.

## Converter build 2026-11-04.9: table-aware page boundaries

The browser DOCX fallback uses the bounding boxes of rendered Word table rows and nearby paragraphs to choose a safe A4 page break. It prefers placing the next row on the following page rather than cutting the middle of a row. Rows taller than a printable page cannot always be kept intact; the PDF result reports unavoidable forced splits for manual review. Image-based fallback may still differ from native Word table pagination and will not repeat table headers at artificial breaks. Continue to use LibreOffice when the full runtime is published and verify official PDFs visually.

## Conversion progress overlay (build 2026-11-04.10)

During DOCX conversion, the PDF workspace now displays a full-screen, opaque and accessible **Converting document...** overlay with an animated spinner and live progress text (rendering pages/finalizing). This deliberately conceals the temporary HTML rendering required by docx-preview and disables interaction during conversion. The overlay is dismissed in the conversion routine's `finally` block on both success and failure. Rendering remains local; no extra document upload or storage is introduced. CSS keeps the temporary render host measurable so html2canvas can capture it, rather than using `display:none` or `visibility:hidden` (which can result in empty PDFs).

## Batch selection and cancellation (build 2026-11-04.12)

The PDF Converter now displays **Remove ×** beside each queued DOCX, provides **Add More Files** and **Clear All** controls, and asks for confirmation listing the selected filenames before starting conversion. Remove/Clear All only releases browser-side references; original files on the computer are never altered.

A **Cancel Conversion** action appears on the progress overlay. The browser PDF fallback checks cancellation between rendered pages and between output slices; a single synchronous docx-preview/html2canvas operation cannot be interrupted mid-operation, so the cancellation becomes effective at the next safe checkpoint. LibreOffice conversions are similarly discarded after the current conversion returns, and unstarted batch items are skipped. PDFs already completed before cancellation stay downloadable; newly incomplete results are not published. The cancel button shows that finishing the current rendering step may be necessary. No server upload or persistent document storage is introduced.
