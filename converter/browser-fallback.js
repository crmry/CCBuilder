/*
 * Offline, browser-only fallback. Libraries are bundled into GitHub Pages by pages.yml.
 * DOCX -> DOM (docx-preview) -> canvas (html2canvas) -> image-backed PDF (jsPDF).
 * Image-backed output is less faithful than LibreOffice: review tables and pagination.
 */
const scripts = [
  './vendor/jszip.min.js',
  './vendor/docx-preview.min.js',
  './vendor/html2canvas.min.js',
  './vendor/jspdf.umd.min.js'
];
let loaded;
function loadScript(src) {
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.onload=resolve;
    script.onerror=()=>reject(new Error('Missing browser PDF dependency: '+src));
    document.head.appendChild(script);
  });
}
export function prepareBrowserFallback() {
  if (!loaded) loaded=(async()=>{
    for (const src of scripts) await loadScript(src);
    if (!window.docx?.renderAsync || !window.html2canvas || !window.jspdf?.jsPDF)
      throw Error('Browser PDF dependencies failed to initialize.');
  })().catch(e=>{loaded=null;throw e;});
  return loaded;
}
function dimensions(section, standard) {
  if (standard) return {w:210,h:297};
  const pxW=section.offsetWidth, pxH=section.offsetHeight;
  // DOCX HTML pages are rendered using CSS pixels; 96 CSS px = 25.4 mm.
  const w=Math.max(40,pxW*25.4/96), h=Math.max(40,pxH*25.4/96);
  return {w,h};
}
export async function convertWithBrowser(file, {standard=false,onProgress=()=>{}}={}) {
  await prepareBrowserFallback();
  const host=document.createElement('div');
  host.className='cc-render-host';
  host.setAttribute('aria-hidden','true');
  document.body.appendChild(host);
  try {
    onProgress('Rendering Word document in browser...');
    await window.docx.renderAsync(file,host,host,{
      inWrapper:true,breakPages:true,ignoreLastRenderedPageBreak:false,
      renderHeaders:true,renderFooters:true,renderFootnotes:true,
      useBase64URL:true,renderAltChunks:false
    });
    if (document.fonts?.ready) await document.fonts.ready;
    const pages=Array.from(host.querySelectorAll('section.docx'));
    if (!pages.length) throw Error('Word renderer did not produce any pages.');
    // jsPDF supports per-page dimensions; retain original paper size when requested.
    let pdf;
    for(let i=0;i<pages.length;i++){
      const page=pages[i];
      onProgress('Rendering PDF page '+(i+1)+' of '+pages.length+'...');
      const {w,h}=dimensions(page,standard);
      if(!pdf) pdf=new window.jspdf.jsPDF({unit:'mm',format:[w,h],orientation:w>h?'landscape':'portrait',compress:true});
      else pdf.addPage([w,h],w>h?'landscape':'portrait');
      // Capture the rendered page. Scale limits memory on large documents.
      const canvas=await window.html2canvas(page,{backgroundColor:'#ffffff',scale:1.5,
        useCORS:false,logging:false,windowWidth:Math.max(document.documentElement.clientWidth,page.scrollWidth+64)});
      const pageW=pdf.internal.pageSize.getWidth(),pageH=pdf.internal.pageSize.getHeight();
      // Fit the full page without cropping. Note: overflowing content must be checked manually.
      const aspect=canvas.width/canvas.height;
      let drawW=pageW,drawH=drawW/aspect;
      if(drawH>pageH){drawH=pageH;drawW=drawH*aspect;}
      pdf.addImage(canvas.toDataURL('image/jpeg',0.88),'JPEG',0,0,drawW,drawH,undefined,'FAST');
      canvas.width=0;canvas.height=0;
    }
    return {blob:pdf.output('blob'),engine:'browser'};
  } finally {
    host.remove();
  }
}
