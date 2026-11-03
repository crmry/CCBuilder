import { OfficeEngine, ensureCrossOriginIsolation } from './office-converter/index.js';

const $ = id => document.getElementById(id);
const zone=$('drop-zone'), input=$('file-input'), convert=$('convert-button'), clear=$('clear-button');
const downloadAll=$('download-all-button'), note=$('download-note');
const status=$('engine-status'), section=$('files-section'), list=$('file-list');
const LIMIT_COUNT=20, LIMIT_BYTES=50*1024*1024;
let files=[], results=[], urls=[], engine=null, ready=false, working=false;

function announce(message, error=false) {
    status.textContent=message;
    status.classList.toggle('is-error',error);
}
function controls() {
    convert.disabled=!ready || working || files.length===0;
    clear.disabled=working || (!files.length && !results.length);
    zone.setAttribute('aria-disabled', String(!ready || working));
}
function size(bytes) {
    return bytes < 1048576 ? (bytes/1024).toFixed(1)+' KB' : (bytes/1048576).toFixed(1)+' MB';
}
function row(name, message, error=false, output=null) {
    const li=document.createElement('li'); li.className='cc-file-row';
    const div=document.createElement('div');
    const title=document.createElement('div'); title.className='cc-file-name'; title.textContent=name;
    const meta=document.createElement('div'); meta.className='cc-file-meta'+(error?' is-error':''); meta.textContent=message;
    div.append(title,meta); li.append(div);
    if(output) {
        const a=document.createElement('a'); a.className='cc-download-link';
        a.textContent='Download PDF'; a.href=output.url; a.download=output.name; li.append(a);
    }
    list.append(li);
}
function release() {
    urls.forEach(URL.revokeObjectURL); urls=[]; results=[];
}
function render() {
    list.replaceChildren();
    files.forEach(f=>row(f.name,size(f.size)+' · Ready to convert'));
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
async function process() {
    if(!ready || working || !files.length) return;
    working=true; controls(); release(); list.replaceChildren(); section.hidden=false;
    const queued=files.slice(), used=new Set(); let ok=0;
    try {
        for(let i=0;i<queued.length;i++) {
            const f=queued[i];
            announce('Converting '+(i+1)+' of '+queued.length+': '+f.name);
            try {
                const mode=document.querySelector('input[name="page-layout"]:checked')?.value || 'standard';
                const source=mode==='standard' ? await window.CCNormalizeDocxToA4(f) : f;
                const result=await engine.convertFile(source,'pdf');
                if(!result.blob || !result.blob.size) throw Error('No PDF was generated.');
                const url=URL.createObjectURL(result.blob);
                const name=uniqueName(f.name,used);
                urls.push(url); results.push({url,name}); ok++;
                row(f.name,'Converted · '+size(result.blob.size),false,{url,name});
            } catch(e) {
                row(f.name,'Failed: '+(e?.message||String(e)),true);
            }
        }
        downloadAll.hidden=ok<2; note.hidden=ok<2;
        announce(ok+' of '+queued.length+' documents converted.'+(ok<queued.length?' See errors below.':''),ok<queued.length);
    } finally {
        working=false; files=[]; controls();
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
window.addEventListener('pagehide',release);
async function init() {
    announce('Setting up private local conversion...');
    try {
        const isolated=await ensureCrossOriginIsolation('./sw.js');
        if(!isolated) { announce('Local conversion requires a modern desktop browser with service workers enabled.',true);return; }
        engine=new OfficeEngine({base:new URL('./office-converter/',import.meta.url)});
        engine.addEventListener('state',e=>{
            if(e.detail.state==='loading')announce('Loading LibreOffice locally (the first visit may take longer)...');
            if(e.detail.state==='error')announce('Engine error: '+(e.detail.text||'Unknown error'),true);
        });
        ready=true;announce('Ready. Drop DOCX files to convert them locally.');
    }catch(e){announce('Could not initialize converter: '+(e?.message||String(e)),true)}
    controls();
}
controls();init();
