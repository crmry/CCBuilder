/*
 * CCBuilder standard page layout in DOCX OOXML:
 * A4 portrait 11906 x 16838 twips.
 * Margins: top 2160, right 720, bottom 1440, left 1440 twips.
 * The source file is never modified. Sections are normalized before conversion.
 */
(() => {
    const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const A4 = { w: '11906', h: '16838' };
    const MARGINS = { top: '2160', right: '720', bottom: '1440', left: '1440', gutter: '0' };

    const firstChild = (parent, name) => Array.from(parent.children)
        .find(element => element.namespaceURI === WORD_NS && element.localName === name);

    function addSectionSetting(xml, section, name) {
        let node = firstChild(section, name);
        if (node) return node;
        const prefix = section.lookupPrefix(WORD_NS) || 'w';
        node = xml.createElementNS(WORD_NS, prefix + ':' + name);
        const after = ['paperSrc', 'pgBorders', 'lnNumType', 'pgNumType', 'cols', 'formProt',
            'vAlign', 'noEndnote', 'titlePg', 'textDirection', 'bidi', 'rtlGutter',
            'docGrid', 'printerSettings', 'sectPrChange'];
        const index = name === 'pgSz' ? -1 : -2;
        let next = null;
        for (const child of Array.from(section.children)) {
            if (child.namespaceURI === WORD_NS &&
                (after.includes(child.localName) || (name === 'pgSz' && child.localName === 'pgMar'))) {
                next = child; break;
            }
        }
        section.insertBefore(node, next);
        return node;
    }

    function fixPageSettings(xml) {
        const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
        if (!body) throw new Error('This DOCX has no valid Word document body.');
        const sections = Array.from(body.getElementsByTagNameNS(WORD_NS, 'sectPr'));
        if (!sections.length) {
            const prefix = body.lookupPrefix(WORD_NS) || 'w';
            const section = xml.createElementNS(WORD_NS, prefix + ':sectPr');
            body.appendChild(section);
            sections.push(section);
        }
        for (const section of sections) {
            const pgSz = addSectionSetting(xml, section, 'pgSz');
            for (const [key, value] of Object.entries(A4))
                pgSz.setAttributeNS(WORD_NS, 'w:' + key, value);
            pgSz.setAttributeNS(WORD_NS, 'w:orient', 'portrait');

            const pgMar = addSectionSetting(xml, section, 'pgMar');
            for (const [key, value] of Object.entries(MARGINS))
                pgMar.setAttributeNS(WORD_NS, 'w:' + key, value);
        }
    }

    window.CCNormalizeDocxToA4 = async file => {
        // JSZip is also bundled for docx-preview. Use it when fflate fails to load
        // (e.g. an older or partially updated GitHub Pages service-worker cache).
        let zipped;
        if (window.fflate) {
            const bytes = new Uint8Array(await file.arrayBuffer());
            const parts = await new Promise((resolve, reject) =>
                window.fflate.unzip(bytes, (error, contents) => error ? reject(error) : resolve(contents)));
            const original = parts['word/document.xml'];
            if (!original || !parts['[Content_Types].xml']) throw new Error('This is not a valid DOCX file.');
            const parser = new DOMParser();
            const xml = parser.parseFromString(window.fflate.strFromU8(original), 'application/xml');
            if (xml.getElementsByTagName('parsererror').length)
                throw new Error('The Word file has invalid document XML.');
            fixPageSettings(xml);
            parts['word/document.xml'] = window.fflate.strToU8(new XMLSerializer().serializeToString(xml));
            zipped = await new Promise((resolve, reject) =>
                window.fflate.zip(parts, { level: 6 }, (error, output) => error ? reject(error) : resolve(output)));
        } else {
            // Load locally from the deployed Pages artifact, never a document-upload service.
            if (!window.JSZip) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = './vendor/jszip.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('DOCX ZIP libraries missing from deployed site. Check GitHub Pages deployment.'));
                    document.head.appendChild(script);
                });
            }
            if (!window.JSZip) throw new Error('DOCX ZIP library not initialized.');
            const zip = await window.JSZip.loadAsync(file);
            if (!zip.file('word/document.xml') || !zip.file('[Content_Types].xml'))
                throw new Error('This is not a valid DOCX file.');
            const parser = new DOMParser();
            const xml = parser.parseFromString(await zip.file('word/document.xml').async('string'),'application/xml');
            if (xml.getElementsByTagName('parsererror').length)
                throw new Error('The Word file has invalid document XML.');
            fixPageSettings(xml);
            zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
            zipped = await zip.generateAsync({type:'uint8array',compression:'DEFLATE',compressionOptions:{level:6}});
        }
        return new File([zipped], file.name, {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            lastModified: file.lastModified
        });
    };
})();
