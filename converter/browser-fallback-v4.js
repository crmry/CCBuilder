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
const CC_A4 = { w:210, h:297, left:25.4, right:12.7, top:38.1, bottom:25.4 };
// Determine the actual painted content on a page. Page background whitespace does not
// count toward the required document margins. Threshold includes light blue headings.
function contentBounds(canvas) {
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const {width:w,height:h}=canvas;
  const pixels=ctx.getImageData(0,0,w,h).data;
  let left=w,top=h,right=-1,bottom=-1;
  const step=2;
  for(let y=0;y<h;y+=step){
    for(let x=0;x<w;x+=step){
      const i=(y*w+x)*4;
      if(pixels[i+3]<24)continue;
      // Near-white anti-aliasing is not substantive ink.
      if(pixels[i]>242 && pixels[i+1]>242 && pixels[i+2]>242)continue;
      if(x<left)left=x;
      if(x>right)right=x;
      if(y<top)top=y;
      if(y>bottom)bottom=y;
    }
  }
  if(right<0) return {x:0,y:0,w,h};
  const pad=4;
  left=Math.max(0,left-pad);top=Math.max(0,top-pad);
  right=Math.min(w-1,right+pad+step);bottom=Math.min(h-1,bottom+pad+step);
  return {x:left,y:top,w:right-left+1,h:bottom-top+1};
}
function cropCanvas(source, bounds){
  const out=document.createElement('canvas');
  out.width=bounds.w;out.height=bounds.h;
  const context=out.getContext('2d');
  context.fillStyle='#ffffff';context.fillRect(0,0,out.width,out.height);
  context.drawImage(source,bounds.x,bounds.y,bounds.w,bounds.h,0,0,bounds.w,bounds.h);
  return out;
}
function fitToStandardBounds(w,h){
  const availableW=CC_A4.w-CC_A4.left-CC_A4.right;
  const availableH=CC_A4.h-CC_A4.top-CC_A4.bottom;
  const factor=Math.min(availableW/w,availableH/h);
  return {drawXmm:CC_A4.left,drawTopMm:CC_A4.top,
          drawWidthMm:w*factor,drawHeightMm:h*factor};
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
    const drawWidth=((item.drawWidthMm??item.widthMm)*72/25.4).toFixed(3);
    const drawHeight=((item.drawHeightMm??item.heightMm)*72/25.4).toFixed(3);
    const drawX=((item.drawXmm??0)*72/25.4).toFixed(3);
    const drawY=((item.heightMm-(item.drawTopMm??0)-(item.drawHeightMm??item.heightMm))*72/25.4).toFixed(3);
    const content='q\n'+drawWidth+' 0 0 '+drawHeight+' '+drawX+' '+drawY+' cm\n'+imageName+' Do\nQ\n';
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
        const bounds=standard?contentBounds(canvas):{x:0,y:0,w:canvas.width,h:canvas.height};
        const cropped=standard?cropCanvas(canvas,bounds):canvas;
        try {
          const placement=standard?fitToStandardBounds(cropped.width,cropped.height):
            {drawXmm:0,drawTopMm:0,drawWidthMm:w,drawHeightMm:h};
          output.push({widthMm:w,heightMm:h,pixelWidth:cropped.width,
            pixelHeight:cropped.height,...placement,jpeg:await jpegBytes(cropped)});
        } finally {if(cropped!==canvas){cropped.width=0;cropped.height=0;}}
      } finally {canvas.width=0;canvas.height=0;}
    }
    return {blob:pdfFromJpegs(output),engine:'browser'};
  } finally {host.remove();}
}
