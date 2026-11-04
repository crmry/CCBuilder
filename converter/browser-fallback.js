/*
 * Browser-only DOCX fallback: JSZip + docx-preview + html2canvas.
 * A small JPEG-backed PDF writer removes the need for a separate jsPDF script.
 * The generated PDF is image-based: review pagination, fonts and table layout.
 */
const scripts = [
  './vendor/jszip.min.js',
  './vendor/docx-preview.min.js',
  './vendor/html2canvas.min.js'
];
let loaded;
function loadScript(src) {
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.onload=resolve;
    script.onerror=()=>reject(new Error('Missing browser dependency: '+src+'. Check the published GitHub Pages artifact.'));
    document.head.appendChild(script);
  });
}
export function prepareBrowserFallback() {
  if (!loaded) loaded=(async()=>{
    for (const src of scripts) {
      if (src.includes('jszip') && window.JSZip) continue;
      if (src.includes('docx-preview') && window.docx?.renderAsync) continue;
      if (src.includes('html2canvas') && window.html2canvas) continue;
      await loadScript(src);
    }
    if (!window.docx?.renderAsync || !window.html2canvas || !window.JSZip)
      throw Error('Browser DOCX renderer dependencies failed to initialize.');
  })().catch(e=>{loaded=null;throw e;});
  return loaded;
}
function pageDimensions(section, standard) {
  if (standard) return {w:210,h:297};
  // docx-preview sizes pages in CSS px; 96 CSS px == 25.4 mm.
  return {w:Math.max(40,section.offsetWidth*25.4/96),
          h:Math.max(40,section.offsetHeight*25.4/96)};
}
const encoder=new TextEncoder();
function pdfFromJpegs(pages) {
  if(!pages.length) throw Error('No PDF pages were rendered.');
  const chunks=[], offsets=[0];
  let length=0;
  const add=bytes=>{
    if(typeof bytes==='string')bytes=encoder.encode(bytes);
    chunks.push(bytes);length+=bytes.byteLength;
  };
  const object=(number,body)=>{
    offsets[number]=length;
    add(number+' 0 obj\n');
    add(body);
    add('\nendobj\n');
  };
  add('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  const kids=pages.map((_,i)=>(3+i*3)+' 0 R').join(' ');
  object(2,'<< /Type /Pages /Kids ['+kids+'] /Count '+pages.length+' >>');
  for(let i=0;i<pages.length;i++){
    const item=pages[i];
    const pageId=3+i*3, contentId=pageId+1, imageId=pageId+2;
    const width=(item.widthMm*72/25.4).toFixed(3);
    const height=(item.heightMm*72/25.4).toFixed(3);
    const imageName='/Im'+i;
    object(pageId,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+width+' '+height+'] /Resources << /XObject << '+imageName+' '+imageId+' 0 R >> >> /Contents '+contentId+' 0 R >>');
    // PDF coordinate system uses the bottom-left origin; draw the image in page bounds.
    const content='q\n'+width+' 0 0 '+height+' 0 0 cm\n'+imageName+' Do\nQ\n';
    object(contentId,'<< /Length '+encoder.encode(content).length+' >>\nstream\n'+content+'endstream');
    offsets[imageId]=length;
    add(imageId+' 0 obj\n<< /Type /XObject /Subtype /Image /Width '+item.pixelWidth+
        ' /Height '+item.pixelHeight+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+item.jpeg.byteLength+
        ' >>\nstream\n');
    add(item.jpeg);
    add('\nendstream\nendobj\n');
  }
  const xref=length, total=3+pages.length*3;
  add('xref\n0 '+total+'\n0000000000 65535 f \n');
  for(let n=1;n<total;n++) add(String(offsets[n]).padStart(10,'0')+' 00000 n \n');
  add('trailer\n<< /Size '+total+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
  return new Blob(chunks,{type:'application/pdf'});
}
async function jpegBytes(canvas) {
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(
    image=>image?resolve(image):reject(Error('Could not render PDF page as JPEG.')),
    'image/jpeg',0.88));
  return new Uint8Array(await blob.arrayBuffer());
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
    const output=[];
    for(let i=0;i<pages.length;i++){
      const page=pages[i];
      onProgress('Rendering PDF page '+(i+1)+' of '+pages.length+'...');
      const {w,h}=pageDimensions(page,standard);
      const canvas=await window.html2canvas(page,{backgroundColor:'#ffffff',scale:1.5,
        useCORS:false,logging:false,windowWidth:Math.max(document.documentElement.clientWidth,page.scrollWidth+64)});
      try{
        output.push({widthMm:w,heightMm:h,pixelWidth:canvas.width,
          pixelHeight:canvas.height,jpeg:await jpegBytes(canvas)});
      } finally {canvas.width=0;canvas.height=0;}
    }
    return {blob:pdfFromJpegs(output),engine:'browser'};
  } finally {host.remove();}
}
