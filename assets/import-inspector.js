/* Detailed, local-only diagnostics for imported CCBuilder JSON. */
(function () {
  'use strict';

  const requirementKeys=['checklist','where'];
  const processKeys=['clientSteps','agencyActions','feesToBePaid','processingTime','personResponsible'];
  const headerKeys={
    '#serviceNameInput':'serviceName','#description-tour-target':'description',
    '[name="office"]':'office','[name="who_may_avail"]':'who_may_avail',
    'input[name="classification"]':'classification','input[name="transaction_type"]':'transaction_type',
    '#FeesToBePaid':'feesToBePaid','#ProcessingTime':'processingTime',
    '#requirementsTable':'requirements','#processOverviewTable':'processOverview'
  };
  function jsonPath(issue) {
    if(issue.jsonPath)return issue.jsonPath;
    const target=issue.target||'';
    const req=target.match(/^#requirementsTableBody tr:nth-child\((\d+)\) td:nth-child\((\d+)\)/);
    if(req)return 'requirements['+(Number(req[1])-1)+'].'+(requirementKeys[Number(req[2])-1]||'checklist');
    const step=target.match(/^#processOverviewTableBody tr:nth-child\((\d+)\) td:nth-child\((\d+)\)/);
    if(step)return 'processOverview['+(Number(step[1])-1)+'].'+(processKeys[Number(step[2])-1]||'clientSteps');
    return headerKeys[target]||'';
  }
  function jsonValue(data,path) {
    if(!path||path==='$')return data;
    return path.replace(/\[(\d+)\]/g,'.$1').split('.').reduce((v,key)=>{
      return v===undefined||v===null?undefined:v[key];
    },data);
  }
  function displayValue(data,path) {
    const value=jsonValue(data,path);
    if(value===undefined)return '(missing)';
    if(value===null)return '(null)';
    const str=typeof value==='string'?
      value.replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
        .replace(/\s+/g,' ').trim()||'(empty)' : JSON.stringify(value);
    return str && str.length>170?str.slice(0,167)+'…':(str||'(empty)');
  }
  function structureIssues(data) {
    const issues=[];
    const err=(path,msg)=>issues.push({section:'JSON file structure',label:path,message:msg,jsonPath:path});
    if(!data||typeof data!=='object'||Array.isArray(data)){err('$','Expected a Citizen Charter JSON object.');return issues;}
    if(!Array.isArray(data.requirements))err('requirements','Expected an array of requirement rows.');
    if(!Array.isArray(data.processOverview))err('processOverview','Expected an array of process steps.');
    if(issues.length)return issues;
    for(const key of ['serviceName','office','description','classification','who_may_avail','feesToBePaid','processingTime']){
      if(data[key]!==undefined&&typeof data[key]!=='string')err(key,'Expected text, not another JSON data type.');
    }
    if(data.transaction_type!==undefined&&(!Array.isArray(data.transaction_type)||
      data.transaction_type.some(v=>typeof v!=='string')))err('transaction_type','Expected an array of transaction types.');
    for(const [name,fields] of [['requirements',requirementKeys],['processOverview',processKeys]]){
      data[name].forEach((row,i)=>{
        const base=name+'['+i+']';
        if(!row||typeof row!=='object'||Array.isArray(row)){err(base,'Expected an object for this row.');return;}
        fields.forEach(key=>{
          if(row[key]!==undefined&&typeof row[key]!=='string')err(base+'.'+key,'Expected text, not another JSON data type.');
        });
      });
    }
    return issues;
  }
  function syntaxDetails(error,raw) {
    const msg=String(error&&error.message||'Invalid JSON syntax.');
    const lc=msg.match(/line\s+(\d+).*column\s+(\d+)/i);
    if(lc)return 'Line '+lc[1]+', column '+lc[2]+': '+msg;
    const pos=msg.match(/position\s+(\d+)/i);
    if(!pos)return msg;
    const lines=raw.slice(0,Number(pos[1])).split(/\r?\n/);
    return 'Line '+lines.length+', column '+(lines[lines.length-1].length+1)+': '+msg;
  }

  // Export pure helpers for regression tests before accessing the DOM.
  window.ccJsonDiagnostics={jsonPath,jsonValue,displayValue,structureIssues,syntaxDetails};

  const style=document.createElement('style');
  style.textContent='#cc-json-review[hidden]{display:none!important}'+
    '#cc-json-review{position:fixed;inset:0;z-index:22000;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,.52);padding:16px}'+
    '.cc-json-panel{width:min(690px,100%);max-height:87vh;overflow:hidden;background:white;border-radius:13px;box-shadow:0 18px 58px rgba(15,23,42,.25);display:flex;flex-direction:column;color:#1e293b}'+
    '.cc-json-head{padding:20px 24px 16px;border-bottom:1px solid #e2e8f0}'+
    '.cc-json-head small{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b}'+
    '.cc-json-head h3{font-size:21px;margin:7px 0;font-weight:700}'+
    '.cc-json-head p{font-size:13px;color:#64748b;line-height:1.55;margin:0}'+
    '.cc-json-list{padding:12px 24px 20px;overflow:auto}'+
    '.cc-json-list h4{font-size:12px;color:#475569;font-weight:700;text-transform:uppercase;margin:13px 0 8px}'+
    '.cc-json-item{border:1px solid #dfe6ef;border-radius:8px;padding:10px 12px;margin:7px 0}'+
    '.cc-json-item strong{display:block;font-size:13px;color:#26364b}'+
    '.cc-json-item p{font-size:12px;line-height:1.45;color:#64748b;margin:4px 0}'+
    '.cc-json-path{display:block;font:600 11.5px/1.5 ui-monospace,Consolas,monospace;color:#2d5888;overflow-wrap:anywhere;margin:6px 0 3px}'+
    '.cc-json-found{font-size:12px;color:#475569;overflow-wrap:anywhere}'+
    '.cc-json-foot{display:flex;justify-content:space-between;align-items:center;gap:12px;border-top:1px solid #e2e8f0;padding:13px 24px}'+
    '.cc-json-foot small{color:#64748b}'+
    '.cc-json-foot button{border-radius:7px;padding:8px 13px;font-size:13px;font-weight:650;cursor:pointer}'+
    '.cc-json-edit{background:#244567;color:white;border:1px solid #244567}'+
    '.cc-json-edit[hidden]{display:none!important}'+
    '.cc-json-close{background:white;color:#334155;border:1px solid #cbd5e1}';
  document.head.appendChild(style);
  const overlay=document.createElement('section');
  overlay.id='cc-json-review';
  overlay.hidden=true;
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Imported Citizen Charter file issues');
  const panel=document.createElement('div');
  panel.className='cc-json-panel';
  const head=document.createElement('div');head.className='cc-json-head';
  const kicker=document.createElement('small');kicker.textContent='Citizen Charter · Import Review';
  const heading=document.createElement('h3');
  const summary=document.createElement('p');
  const filename=document.createElement('p');filename.style.marginTop='8px';
  head.append(kicker,heading,summary,filename);
  const list=document.createElement('div');list.className='cc-json-list';
  const foot=document.createElement('div');foot.className='cc-json-foot';
  const count=document.createElement('small');
  const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:9px';
  const edit=document.createElement('button');edit.type='button';edit.className='cc-json-edit';edit.textContent='Open for correction';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='cc-json-close';cancel.textContent='Close';
  buttons.append(edit,cancel);foot.append(count,buttons);
  panel.append(head,list,foot);overlay.append(panel);document.body.appendChild(overlay);

  function close(){overlay.hidden=true;document.body.style.overflow='';}
  cancel.addEventListener('click',close);
  overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close();});
  function present(fileName,issues,data,correctable,loadDraft) {
    heading.textContent=correctable?'File needs correction':'File cannot be opened';
    summary.textContent=correctable?
      'The file is valid Citizen Charter JSON, but contains incomplete entries. Each issue identifies its JSON field and current value. Open it as a draft to correct the entries; final Save and PDF export remain blocked.':
      'The file has invalid JSON syntax or structure. The current Builder form has not changed.';
    filename.textContent='File: '+fileName;
    count.textContent=issues.length+(issues.length===1?' issue found':' issues found');
    edit.hidden=!correctable;
    edit.onclick=correctable?()=>{if(loadDraft())close();}:null;
    list.replaceChildren();
    for(const section of [...new Set(issues.map(issue=>issue.section))]) {
      const sectionTitle=document.createElement('h4');sectionTitle.textContent=section;list.appendChild(sectionTitle);
      issues.filter(issue=>issue.section===section).forEach(issue=>{
        const card=document.createElement('div');card.className='cc-json-item';
        const label=document.createElement('strong');label.textContent=issue.label;
        const message=document.createElement('p');message.textContent=issue.message;
        const path=document.createElement('code');path.className='cc-json-path';
        const key=jsonPath(issue);path.textContent='JSON field: '+(key||'$');
        const found=document.createElement('div');found.className='cc-json-found';
        found.textContent='Current value: '+(data===null?'(unavailable)':displayValue(data,key));
        card.append(label,message,path,found);list.appendChild(card);
      });
    }
    overlay.hidden=false;document.body.style.overflow='hidden';cancel.focus();
  }
  function load(data,name,correction) {
    const existing=typeof collectCurrentFormData==='function'?collectCurrentFormData():null;
    if(existing&&typeof hasSubstantialData==='function'&&hasSubstantialData(existing)&&
       !window.confirm('Opening this file replaces the current form. Continue?'))return false;
    if(typeof window.resetCharterReadiness==='function')window.resetCharterReadiness();
    currentOpenedFileName=name;
    applyFormData(data);
    scheduleAutoSave();
    if(correction){
      // CKEditor initialization is asynchronous; do not navigate until rows exist.
      const expectedRequirements=Math.max(1,data.requirements.length);
      const expectedSteps=Math.max(1,data.processOverview.length);
      let attempts=0;
      const inspect=()=>{
        const expectedReqEditors=expectedRequirements*2;
        const expectedStepEditors=expectedSteps*5;
        if((requirementEditors.length>=expectedReqEditors &&
            processOverviewEditors.length>=expectedStepEditors)||++attempts>=200){
          window.checkCharterReadiness();
        }else window.setTimeout(inspect,100);
      };
      window.setTimeout(inspect,100);
    }
    return true;
  }
  window.importFormData=function(event){
    const input=event.target,file=input.files&&input.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onerror=()=>{
      present(file.name,[{section:'File',label:'Cannot read file',message:'The browser could not read this file.',jsonPath:'$'}],null,false);
      input.value='';
    };
    reader.onload=event=>{
      const raw=String(event.target.result||'');
      let data;
      try {data=JSON.parse(raw);}
      catch(error){
        present(file.name,[{section:'JSON syntax',label:'Invalid JSON',
          message:syntaxDetails(error,raw),jsonPath:'$'}],null,false);
        input.value='';
        return;
      }
      const shapeErrors=structureIssues(data);
      if(shapeErrors.length){
        present(file.name,shapeErrors,data,false);
      }else{
        const issues=window.validateCharterData(data);
        if(issues.length)present(file.name,issues,data,true,()=>load(data,file.name,true));
        else load(data,file.name,false);
      }
      input.value='';
    };
    reader.readAsText(file);
  };
})();