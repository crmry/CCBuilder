// Load the optional WebAssembly engine during initialization so failures are shown in the UI.
// A static import failure used to leave the page stuck at 'Preparing converter...'.

const $ = id => document.getElementById(id);
const zone=$('drop-zone'), input=$('file-input'), convert=$('convert-button'), clear=$('clear-button');
const downloadAll=$('download-all-button'), note=$('download-note');
const status=$('engine-status'), section=$('files-section'), list=$('file-list');
const overlay=$('convert-overlay'), overlayText=$('convert-overlay-text');
const addMore=$('add-more-button'), cancelButton=$('cancel-conversion-button'), overlayNote=$('convert-overlay-note');
let cancelRequested=false;
const LIMIT_COUNT=20, LIMIT_BYTES=50*1024*1024;
const engineMode=$('engine-mode'), engineHint=$('engine-hint');
const OFFICE_TIMEOUT_MS=150000;
let officeFailure=null;
let browserFallback=null;
let files=[], results=[], urls=[], engine=null, ready=true, working=false;

function announce(message, error=false) {
    status.textContent=message;
    status.classList.toggle('is-error',error);
    if(working && overlayText) overlayText.textContent=message;
}
function busyOverlay(active, message='Preparing document locally...') {
    if(overlay) overlay.hidden=!active;
    document.body.classList.toggle('cc-is-busy',active);
    if(overlayText) overlayText.textContent=message;
}
function controls() {
    if(engineMode)engineMode.disabled=working;
    convert.disabled=!ready || working || files.length===0;
    clear.disabled=working || (!files.length && !results.length);
    if(addMore)addMore.disabled=working || !ready || files.length>=LIMIT_COUNT;
    if(cancelButton)cancelButton.disabled=!working || cancelRequested;
    zone.setAttribute('aria-disabled', String(!ready || working));
}
function size(bytes) {
    return bytes < 1048576 ? (bytes/1024).toFixed(1)+' KB' : (bytes/1048576).toFixed(1)+' MB';
}
function row(name, message, error=false, output=null, removeIndex=null) {
    const li=document.createElement('li'); li.className='cc-file-row';
    const div=document.createElement('div');
    const title=document.createElement('div'); title.className='cc-file-name'; title.textContent=name;
    const meta=document.createElement('div'); meta.className='cc-file-meta'+(error?' is-error':''); meta.textContent=message;
    div.append(title,meta); li.append(div);
    if(output) {
        const a=document.createElement('a'); a.className='cc-download-link';
        a.textContent='Download PDF'; a.href=output.url; a.download=output.name; li.append(a);
    }
    if(removeIndex!==null){
        const button=document.createElement('button');
        button.type='button'; button.className='cc-remove-file';
        button.textContent='Remove ×'; button.setAttribute('aria-label','Remove '+name);
        button.addEventListener('click',()=>removeFile(removeIndex));
        li.append(button);
    }
    list.append(li);
}
function removeFile(index){
    if(working || index<0 || index>=files.length)return;
    const [removed]=files.splice(index,1);
    release(); render();
    announce(removed.name+' removed from the selection. The original DOCX was not changed.');
}
function release() {
    urls.forEach(URL.revokeObjectURL); urls=[]; results=[];
}
function render() {
    list.replaceChildren();
    files.forEach((f,i)=>row(f.name,size(f.size)+' · Ready to convert',false,null,i));
    section.hidden=files.length===0; downloadAll.hidden=true; note.hidden=true; controls();
}
function add(incoming) {
    if(!ready || working) return;
    let ignored=0;
    for(const f of Array.from(incoming)) {
        if(!f.name.toLowerCase().endsWith('.docx') || f.name.startsWith('~$') || f.size===0 || f.size>LIMIT_BYTES || files.length>=LIMIT_COUNT) { ignored++; continue; }
        if(files.some(g=>g.name===f.name && g.size===f.size && g.lastModified===f.lastModified)) continue;
        files.push(f);
    }
    release(); render();
    if(ignored) announce(ignored+' file(s) skipped. DOCX only, 50 MB maximum and 20 files per batch.',true);
    else announce(files.length ? files.length+' Word file(s) selected. Click Convert to PDF.' : 'No new files selected.');
}
function uniqueName(name, used) {
    const stem=name.replace(/\.docx$/i,'')||'document'; let candidate=stem+'.pdf', n=2;
    while(used.has(candidate.toLowerCase())) candidate=stem+' ('+(n++)+').pdf';
    used.add(candidate.toLowerCase()); return candidate;
}
async function loadFallback(){
    if(!browserFallback)browserFallback=import('./browser-fallback-v10.js?build=30ca45c');
    return browserFallback;
}
function setEngineHint(message){if(engineHint)engineHint.textContent=message;}
async function convertOffice(source){
    if(cancelRequested)throw new DOMException('Conversion canceled','AbortError');
    if(!engine) throw Error(officeFailure || 'LibreOffice is not available.');
    let timer;
    try {
        const work=engine.convertFile(source,'pdf');
        return await Promise.race([work,new Promise((_,reject)=>{
            timer=setTimeout(()=>reject(Error('LibreOffice engine did not start or respond within 150 seconds.')),OFFICE_TIMEOUT_MS);
        })]);
    } catch(e) {
        // Release a hung WASM worker before trying the HTML renderer.
        engine.stop?.('LibreOffice timed out or failed.');
        throw e;
    } finally { clearTimeout(timer); }
}
async function convertDocument(source,standard){
    const selected=engineMode?.value || 'auto';
    if(selected==='browser'){
        const fallback=await loadFallback();
        return fallback.convertWithBrowser(source,{standard,onProgress:message=>announce(message),shouldCancel:()=>cancelRequested});
    }
    try {
        const result=await convertOffice(source);
        if(cancelRequested)throw new DOMException('Conversion canceled','AbortError');
        return {...result,engine:'libreoffice'};
    } catch(error) {
        if(cancelRequested || error?.name==='AbortError')throw error;
        officeFailure=error?.message || String(error);
        console.warn('LibreOffice conversion failed',error);
        if(selected==='libreoffice')throw error;
        announce('LibreOffice failed ('+officeFailure+'). Using browser fallback...');
        setEngineHint('The recommended method automatically switched to basic conversion.');
        const fallback=await loadFallback();
        return fallback.convertWithBrowser(source,{standard,onProgress:message=>announce(message),shouldCancel:()=>cancelRequested});
    }
}
async function process() {
    if(!ready || working || !files.length)return;
    // Confirm exact queue before conversion; no files are uploaded.
    if(!window.confirm('Convert '+files.length+' selected DOCX file(s) to PDF?\n\n'+
        files.map((f,i)=>(i+1)+'. '+f.name).join('\n')))return;
    working=true;cancelRequested=false;
    controls();release();list.replaceChildren();section.hidden=false;
    busyOverlay(true,'Preparing conversion...');
    try {
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
        const queued=files.slice(), used=new Set();let ok=0,failed=0,skipped=0;
        for(let i=0;i<queued.length;i++){
            if(cancelRequested){skipped=queued.length-i;break;}
            const f=queued[i];
            announce('Converting '+(i+1)+' of '+queued.length+': '+f.name);
            try{
                const mode=document.querySelector('input[name="page-layout"]:checked')?.value || 'standard';
                const source=mode==='standard' ? await window.CCNormalizeDocxToA4(f) : f;
                if(cancelRequested){skipped=queued.length-i;break;}
                const result=await convertDocument(source,mode==='standard');
                if(cancelRequested){skipped=queued.length-i;break;}
                if(!result.blob || !result.blob.size)throw Error('No PDF was generated.');
                const url=URL.createObjectURL(result.blob);
                const name=uniqueName(f.name,used);
                urls.push(url);results.push({url,name});ok++;
                row(f.name,'Converted with '+(result.engine==='browser'?'browser fallback (image-based PDF)':'LibreOffice')+' · '+size(result.blob.size)+(result.skippedBlankPages?' · '+result.skippedBlankPages+' blank page(s) removed':'')+(result.forcedSplits?' · Review '+result.forcedSplits+' oversized row split(s)':''),false,{url,name});
            }catch(e){
                if(cancelRequested || e?.name==='AbortError'){
                    skipped=queued.length-i;break;
                }
                failed++;
                row(f.name,'Failed: '+(e?.message||String(e)),true);
            }
            // Yield between files so the browser can handle Cancel.
            await new Promise(resolve=>setTimeout(resolve,0));
        }
        downloadAll.hidden=ok<2;note.hidden=ok<2;
        if(skipped){
            for(const f of queued.slice(queued.length-skipped))row(f.name,'Canceled · Not converted',true);
            announce('Conversion canceled. '+ok+' completed, '+failed+' failed, '+skipped+' skipped. Completed PDFs remain downloadable.');
        }else{
            announce(ok+' of '+queued.length+' documents converted.'+(failed?' See errors below.':''),
                failed>0);
        }
    }catch(e){
        console.error('Conversion batch failed:',e);
        announce('Conversion stopped: '+(e?.message||String(e)),true);
    }finally{
        working=false;cancelRequested=false;files=[];controls();
        busyOverlay(false);
    }
}
zone.addEventListener('click',()=>{if(ready&&!working) input.click()});
zone.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.key===' ')&&ready&&!working){e.preventDefault();input.click()}
});
for(const kind of ['dragenter','dragover']) zone.addEventListener(kind,e=>{
    e.preventDefault(); if(ready&&!working) zone.classList.add('is-over');
});
for(const kind of ['dragleave','drop']) zone.addEventListener(kind,e=>{
    e.preventDefault(); zone.classList.remove('is-over');
});
zone.addEventListener('drop',e=>add(e.dataTransfer?.files||[]));
input.addEventListener('change',()=>{add(input.files||[]);input.value=''});
convert.addEventListener('click',process);
addMore?.addEventListener('click',()=>{if(!working)input.click()});
cancelButton?.addEventListener('click',()=>{
    if(!working || cancelRequested)return;
    cancelRequested=true;
    cancelButton.disabled=true;
    if(overlayNote)overlayNote.textContent='Finishing the current browser rendering step, then stopping. Completed PDFs will be kept.';
    announce('Cancel requested. Stopping after the current step...');
});
downloadAll.addEventListener('click',()=>{
    for(const result of results) {
        const a=document.createElement('a'); a.href=result.url; a.download=result.name;
        document.body.append(a);a.click();a.remove();
    }
});
clear.addEventListener('click',()=>{
    if(working)return;
    files=[]; release(); list.replaceChildren(); section.hidden=true;
    downloadAll.hidden=true;note.hidden=true;announce('Files cleared. Nothing was saved.');controls();
});
window.addEventListener('pagehide',()=>{release(); files=[]; engine?.stop?.('Converter page closed.');});
async function init() {
    ready=true;
    controls();
    announce('Preparing converter...');
    setEngineHint('Recommended selects the best available method.');
    // The scoped worker handles versioned runtime library caches, not document data.
    // Register it even when the optional LibreOffice engine has not been deployed.
    if ('serviceWorker' in navigator) {
        try {
            const registration=await navigator.serviceWorker.register('./sw.js');
            registration.update().catch(error=>console.warn('Runtime worker update check:',error));
        } catch (error) {
            console.warn('Runtime cache service worker unavailable; browser renderer can still run.',error);
        }
    }
    try {
        // Check that deployment actually contains *all* prerequisite entrypoints.
        // If Pages is published from a branch, these usually return 404:
        // don't try to initialize LibreOffice at all, and keep the fallback ready.
        for (const relative of [
            'office-converter/index.js',
            'office-converter/engine-worker.js',
            'office-converter/lo/manifest.json',
            'office-converter/lo/soffice.wasm.xz.000'
        ]) {
            // HEAD avoids downloading the ~23 MB compressed WASM file merely to check it exists.
            const response=await fetch(relative,{cache:'no-store',
                method:relative.endsWith('.xz.000')?'HEAD':'GET'});
            if (!response.ok) throw Error(relative+' returned HTTP '+response.status);
        }
        const {OfficeEngine,ensureCrossOriginIsolation}=await import('./office-converter/index.js');
        const isolated=await ensureCrossOriginIsolation('./sw.js');
        if (!isolated) throw Error('Cross-origin isolation could not be established for LibreOffice.');
        engine=new OfficeEngine({base:new URL('./office-converter/',import.meta.url)});
        engine.addEventListener('state',event=>{
            if (event.detail.state==='loading') announce('Loading and caching local LibreOffice runtime...');
            if (event.detail.state==='error') {
                officeFailure=event.detail.detail || event.detail.text || 'Unknown worker error';
                announce('LibreOffice unavailable: '+officeFailure+'. Browser fallback remains available.',true);
            }
        });
        announce('Ready to convert.');
        setEngineHint('Recommended selects the best available method.');
    } catch(error) {
        officeFailure=error?.message||String(error);
        console.warn('Optional LibreOffice runtime unavailable:',error);
        announce('Ready to convert using the browser renderer.');
        setEngineHint('Recommended will use basic conversion on this device.');
    } finally {controls();}
}
controls();init();
