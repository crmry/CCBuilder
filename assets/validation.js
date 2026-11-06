/* Citizen Charter readiness validation — on-device, no external service. */
(function () {
  'use strict';

  function text(value) {
    return (typeof value === 'string' ? value : '')
      .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
  }
  const filled = value => Boolean(text(value));
  const feeAmount = /(?:\bPHP\b|₱)\s*[\d,]+(?:\.\d{1,2})?/i;
  const numericRange = /\d[\d,.]*\s*(?:-|–|—|\bto\b)\s*\d[\d,.]*/i;
  const timeUnits = /\b\d+(?:\.\d+)?\s*(?:working\s+|business\s+)?(?:day|days|hour|hours|hr|hrs|minute|minutes|min|mins)\b/i;
  // Titles are checked against the user's 130-entry approved-position list.
  // The office/section/unit is separate from the plantilla title.
  function editorLines(value) {
    return String(typeof value==='string'?value:'')
      .replace(/<br\s*\/?>/gi,'\n')
      .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi,'\n')
      .replace(/<li\b[^>]*>/gi,'\n')
      .replace(/<[^>]*>/g,' ')
      .replace(/&nbsp;|&#160;/gi,' ').replace(/&amp;/gi,'&')
      .split(/\r?\n|;\s*/)
      .map(line=>line.replace(/\s+/g,' ').trim())
      .filter(Boolean);
  }

  const officeWords=/\b(office|division|department|section|unit|center|centre|bureau|branch|service|facility|ward|desk|secretariat)\b/i;
  function validateResponsibleCell(value) {
    const reference=window.CCPlantillaPositions;
    if(!reference || !Array.isArray(reference.titles) || !reference.titles.length)
      return {kind:'list-unavailable'};

    const lines=editorLines(value);
    if(!lines.length)return {kind:'missing'};
    // Commas and spaced dashes separate titles and office; compact title
    // hyphens (Nutritionist-Dietitian) are left intact.
    let clauses=lines.flatMap(line=>line.split(/,\s*|\s+[–—-]\s+/).map(x=>x.trim()).filter(Boolean));
    let office='';
    let positions=clauses;

    const last=clauses[clauses.length-1];
    if(clauses.length>1 && last && !reference.match(last) && officeWords.test(last)){
      office=last;
      positions=clauses.slice(0,-1);
    }
    // Support legacy one-line: "Administrative Officer V Cashier Section".
    // Do not confuse an exact position such as "Ward Assistant" with an office.
    if(!office && clauses.length===1 && last && !reference.match(last)){
      const words=last.split(/\s+/);
      let proposed=null;
      for(let i=1;i<words.length-1;i++){
        const role=words.slice(0,i).join(' ');
        const unit=words.slice(i).join(' ');
        if(!officeWords.test(unit) || reference.match(unit))continue;
        const known=reference.match(role);
        const candidate=known||reference.closest(role);
        if(!candidate)continue;
        const score=(known?100:0)+role.length;
        if(!proposed || score>proposed.score)
          proposed={role,unit,score};
      }
      if(proposed){
        office=proposed.unit;
        positions=[proposed.role];
      }
    }
    if(!office && clauses.length===1 && officeWords.test(last) && !reference.match(last))return {kind:'position'};
    if(!office)return {kind:'office'};
    if(!positions.length)return {kind:'position'};

    const invalid=positions.filter(title=>!reference.match(title));
    if(invalid.length){
      const invalidTitle=invalid[0];
      return {
        kind:'position',title:invalidTitle,suggestion:reference.closest(invalidTitle),
        invalidTitles:invalid.map(title=>({title,suggestion:reference.closest(title)}))
      };
    }
    return null;
  }

  // Changes text only; HTML tags, other titles and the office are unchanged.
  function replaceSuggestedPlantillaTitle(html, previous, suggested) {
    const input=String(typeof html==='string'?html:'');
    const reference=window.CCPlantillaPositions;
    if(!previous || !suggested || !reference || !reference.match(suggested))
      return {html:input,changed:false};
    const escaped=previous.replace(/[.*+?^$()|[\]{}\\]/g,'\\  function numberedAgencyActions(value) {').replace(/\s+/g,'\\s+');
    const regex=new RegExp('(^|[^A-Za-z0-9])('+escaped+')(?=$|[^A-Za-z0-9])','i');
    const fragments=input.split(/(<[^>]*>)/g);
    let changed=false;
    for(let i=0;i<fragments.length;i+=2){
      if(!regex.test(fragments[i]))continue;
      fragments[i]=fragments[i].replace(regex,(_,prefix)=>prefix+suggested);
      changed=true;
      break;
    }
    return {html:changed?fragments.join(''):input,changed};
  }
  window.ccReplaceSuggestedPlantillaTitle=replaceSuggestedPlantillaTitle;

  function numberedAgencyActions(value) {
    const parsed=[];
    for(const line of editorLines(value)){
      // Accept 1.2 Assess, 1.2Assess and rich-text versions of either.
      const m=line.match(/^(?:[-•]\s*)?(\d+)\s*\.\s*(\d+)(?!\d)/);
      if(m)parsed.push({major:Number(m[1]),minor:Number(m[2])});
    }
    return parsed;
  }
  function numberedClientStep(value) {
    const m=text(value).match(/^(\d+)\s*[.)]\s*/);
    return m?Number(m[1]):null;
  }

  // The number and format of copies applies to paper documents, not every
  // online form or standard office-issued form. "Where to Secure" must still
  // identify the actual source of either kind of form.
  const copyDetailsPattern = /\b(?:\d+|one|two|three|four|five)\s*(?:\(\d+\)\s*)?(?:original|photocopy|photocopies|copies|copy)\b/i;
  const standardFormPattern = /\b(?:form|slip|template|questionnaire|worksheet|logsheet|log\s+sheet)\s*(?:\([^)]*\))?\s*[.:;]?$/i;
  const digitalSourcePattern = /\b(?:online|electronic|digitally|digital|web[\s-]?portal|portal|e-?form|google\s+forms|microsoft\s+forms|qr[\s-]?code|website|web[\s-]?site|url)\b|https?:\/\/|www\.|(?:[a-z0-9-]+\.)+(?:org|gov|edu|com|net|ph)\b/i;
  const digitalFormPattern = /\b(?:online|web[\s-]?based|electronic|digital|e-?form)\s+(?:form|application|request|registration|submission)\b/i;
  const paperCopyPattern = /\b(?:hard[\s-]?copy|physical\s+copy|printed\s+(?:application\s+)?(?:copy|form)|original\s+copy|certified\s+true\s+copy|photocopy|photocopies|copies\s+of|copy\s+of|printed\s+and\s+signed)\b/i;

  function requiresCopyDetails(checklist, whereToSecure) {
    if (copyDetailsPattern.test(checklist)) return false;
    if (!whereToSecure) return true; // The Where-to-Secure check is separate.
    // An explicit paper-copy instruction still requires quantity and copy type.
    if (paperCopyPattern.test(checklist)) return true;
    const isStandardForm=standardFormPattern.test(checklist);
    const isOnlineForm=digitalFormPattern.test(checklist) ||
      (isStandardForm && digitalSourcePattern.test(whereToSecure));
    return !(isOnlineForm || isStandardForm);
  }

  function validateCharterData(data) {
    const issues = [];
    const add = (section, label, message, target, fix = null) =>
      issues.push({section,label,message,target,...(fix?{fix}:{})});

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      add('File', 'Data format', 'This file does not contain valid Citizen Charter data.', null);
      return issues;
    }

    [
      ['serviceName', 'Service Name', '#serviceNameInput'],
      ['description', 'Description', '#description-tour-target'],
      ['office', 'Office or Division', '[name="office"]'],
      ['who_may_avail', 'Who May Avail', '[name="who_may_avail"]']
    ].forEach(([field, label, target]) => {
      if (typeof data[field] !== 'string' || !filled(data[field]))
        add('Service details', label, 'Complete this required field.', target);
    });

    if (!['Simple', 'Complex', 'Highly Technical'].includes(data.classification))
      add('Service details', 'Classification', 'Select Simple, Complex, or Highly Technical.', 'input[name="classification"]');

    const allowedTypes = ['Government to Citizen (G2C)', 'Government to Business (G2B)', 'Government to Government (G2G)'];
    if (!Array.isArray(data.transaction_type) || !data.transaction_type.length ||
        data.transaction_type.some(type => !allowedTypes.includes(type)))
      add('Service details', 'Type of Transaction', 'Select at least one valid transaction type.', 'input[name="transaction_type"]');

    if (!Array.isArray(data.requirements) || !data.requirements.length) {
      add('Checklist of Requirements', 'Requirements', 'Add a requirement, or enter “None” if there are no required documents.', '#requirementsTable');
    } else {
      data.requirements.forEach((row, index) => {
        const n = index + 1;
        const target = '#requirementsTableBody tr:nth-child(' + n + ')';
        const cell = column => target + ' td:nth-child(' + column + ')';
        const entry = row && typeof row === 'object' ? row : {};
        const checklist = text(entry.checklist), where = text(entry.where);
        if (!checklist)
          add('Checklist of Requirements', 'Row ' + n + ': Requirement',
            'Enter the required document or form, or “None” when no requirement applies.', cell(1));
        else if (checklist.toLowerCase() !== 'none' && requiresCopyDetails(checklist, where))
          add('Checklist of Requirements', 'Row ' + n + ': Copy details',
            'For paper documents, specify the number of originals or photocopies (example: Valid ID — 1 photocopy). Online forms and standard office-issued forms do not need copy details unless printed copies are required.', cell(1));
        if (!where)
          add('Checklist of Requirements', 'Row ' + n + ': Where to Secure', 'Specify the issuing office or “None”.', cell(2));
        if (checklist.toLowerCase() === 'none' && where && where.toLowerCase() !== 'none')
          add('Checklist of Requirements', 'Row ' + n + ': Where to Secure', 'If no requirements exist, enter “None” in both columns.', cell(2));
      });
    }

    if (!Array.isArray(data.processOverview) || !data.processOverview.length) {
      add('Process Overview', 'Process Steps', 'Add at least one complete process step.', '#processOverviewTable');
    } else {
      let activeClientStep = null;
      let lastAgencyAction = null;
      data.processOverview.forEach((row, index) => {
        const n = index + 1;
        const target = '#processOverviewTableBody tr:nth-child(' + n + ')';
        const cell = column => target + ' td:nth-child(' + column + ')';
        const entry = row && typeof row === 'object' ? row : {};
        const actionNumbers = numberedAgencyActions(entry.agencyActions);
        const firstAction = actionNumbers[0] || null;
        const lastAction = actionNumbers[actionNumbers.length-1] || null;
        const hasClientStep = filled(entry.clientSteps);
        if (hasClientStep) {
          const explicitNumber = numberedClientStep(entry.clientSteps);
          activeClientStep = explicitNumber !== null ? explicitNumber :
            (firstAction ? firstAction.major : null);
        } else {
          // A numbered agency sub-action belongs to its active Client Step.
          // Do not reject a blank Client Steps cell simply because a previous
          // agency row was unnumbered, or its number was formatted differently.
          const continued = index > 0 && activeClientStep !== null &&
            firstAction && firstAction.major === activeClientStep &&
            firstAction.minor >= 1;
          if (!continued) {
            add('Process Overview','Step '+n+': Client Steps',
              'Enter a new client action only when the client must do something new. Otherwise, leave it blank when Agency Actions continue the active step (such as 1.2, 1.3, 1.4).',cell(1));
          }
        }
        if (!filled(entry.agencyActions)) {
          add('Process Overview','Step '+n+': Agency Actions',
            'Describe the action of agency personnel.',cell(2));
        }
        // If the agency sequence itself skips or repeats a numbered action,
        // highlight Agency Actions (not the intentionally blank Client Steps).
        if (!hasClientStep && firstAction && lastAgencyAction &&
            firstAction.major === lastAgencyAction.major &&
            firstAction.major === activeClientStep &&
            firstAction.minor !== lastAgencyAction.minor + 1) {
          add('Process Overview','Step '+n+': Agency Actions',
            'Check the agency-action numbering: after '+lastAgencyAction.major+'.'+lastAgencyAction.minor+
            ', the next sub-action should be '+lastAgencyAction.major+'.'+(lastAgencyAction.minor+1)+
            '. The Client Steps cell can remain blank.',cell(2));
        }
        lastAgencyAction = lastAction;

        const fee = text(entry.feesToBePaid);
        if (!fee)
          add('Process Overview', 'Step ' + n + ': Fees', 'Enter the prescribed fee and PHP amount, or explicitly type “None”.', cell(3));
        else if (/^(?:no fee|n\/a|nil|free)$/i.test(fee))
          add('Process Overview', 'Step ' + n + ': Fees', 'Use the exact word “None” for a service without a fee.', cell(3));
        else if (fee.toLowerCase() !== 'none') {
          if (!feeAmount.test(fee))
            add('Process Overview', 'Step ' + n + ': Fees', 'Provide a fee type and exact PHP amount, for example Certification Fee: PHP 50.00.', cell(3));
          if (numericRange.test(fee))
            add('Process Overview', 'Step ' + n + ': Fees', 'Fee ranges are not accepted. State the exact amount.', cell(3));
          if (feeAmount.test(fee) && !fee.replace(feeAmount, '').replace(/[\s:;(),.-]/g, '').trim())
            add('Process Overview', 'Step ' + n + ': Fees', 'State the name/purpose of the fee as well as its amount.', cell(3));
        }

        const time = text(entry.processingTime);
        if (!time)
          add('Process Overview', 'Step ' + n + ': Processing Time', 'Enter an exact duration (for example 15 minutes).', cell(4));
        else if (!timeUnits.test(time) || numericRange.test(time) || /\b(varies|depending|tbd|n\/a)\b/i.test(time))
          add('Process Overview', 'Step ' + n + ': Processing Time', 'Use a fixed number of days, hours or minutes, not a range or “varies”.', cell(4));

        const responsibleIssue=validateResponsibleCell(entry.personResponsible);
        if(responsibleIssue){
          let message='';
          if(responsibleIssue.kind==='list-unavailable'){
            message='The plantilla reference is unavailable. Refresh this page to reload the position list before exporting.';
          }else if(responsibleIssue.kind==='missing'){
            message='Enter a title from the plantilla list and the responsible office.';
          }else if(responsibleIssue.kind==='office'){
            message='Add the responsible office, section, or unit. List the plantilla title(s) above it.';
          }else if(responsibleIssue.invalidTitles?.length){
            // Surface each invalid title so each suggestion can be accepted.
            responsibleIssue.invalidTitles.forEach(({title,suggestion})=>{
              const detail='“'+title+'” is not in the supplied plantilla list.'+
                (suggestion?' Suggested title: “'+suggestion+'”.':' Verify the exact title and grade.');
              add('Process Overview','Step '+n+': Person Responsible',detail,cell(5),
                suggestion?{kind:'plantilla',from:title,to:suggestion}:null);
            });
            message=null;
          }else{
            message='Enter an approved plantilla position title above the responsible office.';
          }
          if(message) add('Process Overview','Step '+n+': Person Responsible',message,cell(5));
        }

      });
    }

    const totalFee = text(data.feesToBePaid);
    if (!totalFee)
      add('Totals', 'Total Fees', 'Enter the total in PHP, or explicitly type “None” for a free service.', '#FeesToBePaid');
    else if (totalFee.toLowerCase() !== 'none' && (!feeAmount.test(totalFee) || numericRange.test(totalFee)))
      add('Totals', 'Total Fees', 'Enter a definite PHP total, or “None”.', '#FeesToBePaid');

    if (Array.isArray(data.processOverview) && data.processOverview.length) {
      const allFree = data.processOverview.every(row => text(row && row.feesToBePaid).toLowerCase() === 'none');
      const anyPaid = data.processOverview.some(row => feeAmount.test(text(row && row.feesToBePaid)));
      if (allFree && totalFee && totalFee.toLowerCase() !== 'none')
        add('Totals', 'Total Fees', 'Every step is free; Total Fees must also be “None”.', '#FeesToBePaid');
      if (anyPaid && totalFee.toLowerCase() === 'none')
        add('Totals', 'Total Fees', 'At least one step has a fee; enter the correct total amount.', '#FeesToBePaid');
    }

    const totalTime = text(data.processingTime);
    if (!totalTime)
      add('Totals', 'Total Processing Time', 'Enter the total processing duration.', '#ProcessingTime');
    else if (!timeUnits.test(totalTime) || numericRange.test(totalTime) || /\b(varies|depending|tbd|n\/a)\b/i.test(totalTime))
      add('Totals', 'Total Processing Time', 'Enter a definite total in days, hours or minutes.', '#ProcessingTime');

    return issues;
  }

  // Expose the pure validator for browser-based regression tests.
  window.validateCharterData = validateCharterData;

  const css = `
    #cc-readiness-dialog[hidden] { display: none !important; }
    #cc-readiness-dialog { position: fixed; inset: 0; z-index: 21000; background: rgba(15,23,42,.48); display: flex; align-items: center; justify-content: center; padding: 18px; }
    .cc-ready-panel { width: min(670px,100%); max-height: min(85vh,850px); background: #fff; border-radius: 14px; box-shadow: 0 22px 70px rgba(15,23,42,.23); display:flex; flex-direction:column; overflow: hidden; color:#172334; }
    .cc-ready-head { padding: 22px 24px 14px; border-bottom: 1px solid #e5eaf0; }
    .cc-ready-kicker { color:#64748b; font-size:11px; font-weight:700; letter-spacing:.09em; text-transform:uppercase; }
    .cc-ready-head h3 { margin:7px 0 8px; font-size:21px; font-weight:700; line-height:1.3; }
    .cc-ready-head p { margin:0; color:#607083; line-height:1.5; font-size:13px; }
    .cc-ready-body { overflow:auto; padding: 15px 24px 20px; }
    .cc-ready-group { margin-bottom:16px; }
    .cc-ready-group h4 { font-size:12px; letter-spacing:.05em; text-transform:uppercase; color:#475569; margin:10px 0 7px; font-weight:700; }
    .cc-ready-issue { border:1px solid #e2e8f0; border-radius:9px; margin:7px 0; padding: 11px 12px; display:flex; align-items:center; justify-content:space-between; gap:14px; background:#fff; }
    .cc-ready-issue strong { font-size:13px; color:#202f42; display:block; }
    .cc-ready-issue span { font-size:12px; color:#66778b; display:block; margin-top:3px; line-height:1.45; }
    .cc-ready-go { border:1px solid #cbd5e1; border-radius:6px; background:#f8fafc; white-space:nowrap; padding:7px 11px; color:#334155; font-size:12px; font-weight:600; cursor:pointer; }
    .cc-ready-go:hover { border-color:#2563eb; color:#1d4ed8; }
    .cc-ready-footer { border-top:1px solid #e5eaf0; padding:13px 24px; display:flex; justify-content:space-between; align-items:center; gap:12px; }
    .cc-ready-footer small { color:#778498; font-size:12px; }
    .cc-ready-close { background:#243b5a; color:#fff; border:0; padding:9px 20px; border-radius:7px; font-size:13px; font-weight:650; cursor:pointer; }
    .cc-ready-invalid { outline:2px solid #dc6c60 !important; outline-offset:-2px; border-radius:4px; background:rgba(220,108,96,.04) !important; }
    .cc-ready-highlight { outline:3px solid #2563eb !important; outline-offset:3px; box-shadow:0 0 0 6px rgba(37,99,235,.15) !important; transition:box-shadow .2s; }
    .cc-ready-inline-error { margin:7px 0 4px; border-left:3px solid #cc6155; padding:5px 8px; background:#fff7f5; border-radius:0 5px 5px 0; color:#86483e; font-size:12px; line-height:1.45; }
    .cc-ready-inline-error strong { font-weight:700; display:block; color:#983e35; margin-bottom:2px; }
    .cc-ready-inline-error span { display:block; }
    .cc-ready-inline-error .cc-ready-inline-extra { margin-top:3px; }
    #cc-ready-review-link[hidden] { display:none !important; }
    #cc-ready-review-link { position:fixed; bottom:20px; right:20px; z-index:1050; border:1px solid #e0b1a9; box-shadow:0 5px 18px rgba(15,23,42,.12); background:#fff; color:#92483f; border-radius:9px; padding:10px 14px; font-size:13px; font-weight:700; cursor:pointer; }
    #cc-ready-review-link:hover { border-color:#b6574c; background:#fff9f7; }
    @media(max-width:600px) { #cc-ready-review-link { bottom:12px; right:12px; font-size:12px; padding:9px 11px; } }
    @media(max-width:600px) { .cc-ready-head,.cc-ready-body {padding-left:16px;padding-right:16px;} .cc-ready-footer {padding:12px 16px;} .cc-ready-issue {align-items:flex-start;flex-direction:column;gap:8px;} }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const modal = document.createElement('section');
  modal.id = 'cc-readiness-dialog';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'cc-ready-title');
  modal.innerHTML =
    '<div class="cc-ready-panel">' +
    ' <div class="cc-ready-head"><div class="cc-ready-kicker">Citizen Charter · Readiness Check</div>' +
    ' <h3 id="cc-ready-title"></h3><p id="cc-ready-description"></p></div>' +
    ' <div class="cc-ready-body" id="cc-ready-issues"></div>' +
    ' <div class="cc-ready-footer"><small id="cc-ready-count"></small>' +
    ' <button class="cc-ready-close" type="button">Close</button></div></div>';
  document.body.appendChild(modal);

  const reviewButton = document.createElement('button');
  reviewButton.type = 'button';
  reviewButton.id = 'cc-ready-review-link';
  reviewButton.hidden = true;
  reviewButton.setAttribute('aria-label', 'Review remaining Citizen Charter readiness issues');
  reviewButton.addEventListener('click', () => window.checkCharterReadiness());
  document.body.appendChild(reviewButton);

  let previousFocus = null;
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  };
  // Resolve a validator location to the actual visible form control. CKEditor
  // hides the original div and renders a separate editable inside its container.
  function findField(selector) {
    if (!selector) return null;
    let source;
    try { source = document.querySelector(selector); } catch (_) { return null; }
    if (!source) return null;

    let marker = source;
    if (source.matches('input[type="radio"], input[type="checkbox"]')) {
      marker = source.closest('.option-grid') || source.closest('td') || source.parentElement;
    } else if (source.id === 'FeesToBePaid' || source.id === 'ProcessingTime' || source.id === 'editor') {
      marker = source.closest('td') || source.closest('#description-tour-target') || source.parentElement;
    }
    if (!marker) marker = source;
    const editable = marker.querySelector('.ck-editor__editable[contenteditable="true"], .ck-editor__editable, [contenteditable="true"]');
    const focusable = editable ||
      (source.matches('input, textarea, select, [contenteditable="true"]') ? source : marker.querySelector('input:not([type="hidden"]), textarea, select, button'));
    return { marker, focusable };
  }

  function clearFieldMarkers() {
    document.querySelectorAll('.cc-ready-inline-error').forEach(node => node.remove());
    document.querySelectorAll('.cc-ready-invalid').forEach(node => node.classList.remove('cc-ready-invalid'));
    document.querySelectorAll('[data-cc-ready-invalid]').forEach(node => {
      node.removeAttribute('aria-invalid');
      node.removeAttribute('data-cc-ready-invalid');
    });
  }

  function markFields(issues) {
    clearFieldMarkers();
    reviewButton.hidden = issues.length === 0;
    reviewButton.textContent = issues.length + (issues.length === 1 ? ' issue · Review' : ' issues · Review');
    const groups = new Map();
    issues.forEach(issue => {
      if (!issue.target) return;
      if (!groups.has(issue.target)) groups.set(issue.target, []);
      groups.get(issue.target).push(issue);
    });
    groups.forEach((problems, selector) => {
      const field = findField(selector);
      if (!field) return;
      const { marker, focusable } = field;
      marker.classList.add('cc-ready-invalid');
      if (focusable) {
        focusable.setAttribute('aria-invalid', 'true');
        focusable.setAttribute('data-cc-ready-invalid', 'true');
      }
      const note = document.createElement('div');
      note.className = 'cc-ready-inline-error';
      const heading = document.createElement('strong');
      heading.textContent = problems[0].label + ' — needs correction';
      note.appendChild(heading);
      problems.forEach((problem, i) => {
        const detail = document.createElement('span');
        if (i > 0) detail.className = 'cc-ready-inline-extra';
        detail.textContent = problem.message;
        note.appendChild(detail);
      });
      // Tables need a sibling rather than inserting arbitrary children into a table.
      if (marker.tagName === 'TABLE' || marker.matches('.option-grid, #description-tour-target') || marker.matches('input, textarea, select')) {
        marker.insertAdjacentElement('afterend', note);
      } else {
        marker.appendChild(note);
      }
    });
  }

  function goToIssue(issue) {
    const field = findField(issue.target);
    if (!field) return false;
    close();
    // Scroll the visible CKEditor wrapper / table cell rather than the hidden source div.
    field.marker.scrollIntoView({ behavior: 'smooth', block: 'center' });
    field.marker.classList.add('cc-ready-highlight');
    if (field.focusable && typeof field.focusable.focus === 'function') {
      field.focusable.focus({ preventScroll: true });
    }
    window.setTimeout(() => field.marker.classList.remove('cc-ready-highlight'), 2600);
    return true;
  }

  modal.querySelector('.cc-ready-close').addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });

  function showIssues(issues, action) {
    previousFocus = document.activeElement;
    const blocked = issues.length > 0;
    const isImport = action === 'open';
    modal.querySelector('#cc-ready-title').textContent = blocked
      ? (isImport ? 'File cannot be opened' : 'Complete these items first')
      : 'Ready for final review';
    modal.querySelector('#cc-ready-description').textContent = blocked
      ? (isImport
        ? 'The selected file is incomplete or does not follow the required format. Your current work was not changed.'
        : 'The requested action is paused. Correct the items below, then try again. Your draft remains editable.')
      : 'All required fields passed the format checks. Verify plantilla titles and the information against your office’s approved records before final submission.';
    modal.querySelector('#cc-ready-count').textContent = blocked
      ? (issues.length + (issues.length === 1 ? ' issue found' : ' issues found'))
      : 'No missing required entries found';
    const body = modal.querySelector('#cc-ready-issues');
    body.replaceChildren();
    if (!isImport) markFields(issues);

    if (!blocked) {
      const ok = document.createElement('p');
      ok.style.cssText = 'color:#247046;font-size:14px;margin:10px 0;';
      ok.textContent = 'All mandatory sections contain valid entries.';
      body.appendChild(ok);
    } else {
      const sections = [...new Set(issues.map(issue => issue.section))];
      sections.forEach(section => {
        const group = document.createElement('div');
        group.className = 'cc-ready-group';
        const title = document.createElement('h4');
        title.textContent = section;
        group.appendChild(title);
        issues.filter(issue => issue.section === section).forEach(issue => {
          const item = document.createElement('div');
          item.className = 'cc-ready-issue';
          const content = document.createElement('div');
          const label = document.createElement('strong');
          label.textContent = issue.label;
          const detail = document.createElement('span');
          detail.textContent = issue.message;
          content.append(label, detail);
          item.appendChild(content);
          if (!isImport && issue.target) {
            const jump = document.createElement('button');
            jump.type = 'button';
            jump.className = 'cc-ready-go';
            jump.textContent = 'Go to field';
            jump.addEventListener('click', () => goToIssue(issue));
            item.appendChild(jump);
          }
          group.appendChild(item);
        });
        body.appendChild(group);
      });
    }
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    modal.querySelector('.cc-ready-close').focus();
  }

  let annotationsShown = false;
  let annotationTimer = null;
  window.refreshCitizenCharterReadiness = function () {
    if (!annotationsShown || !modal.hidden || typeof collectCurrentFormData !== 'function') return;
    window.clearTimeout(annotationTimer);
    annotationTimer = window.setTimeout(() => {
      if (!modal.hidden) return;
      const data = collectCurrentFormData();
      if (data) markFields(validateCharterData(data));
    }, 300);
  };

  window.validateCitizenCharterForAction = function (data, action) {
    const issues = validateCharterData(data);
    if (action !== 'open' && data) {
      const reqCount = document.querySelectorAll('#requirementsTableBody tr').length;
      const stepCount = document.querySelectorAll('#processOverviewTableBody tr').length;
      if (reqCount > (Array.isArray(data.requirements) ? data.requirements.length : 0))
        issues.unshift({section:'Editor',label:'Requirements still loading',message:'Allow the requirement editors to finish loading and try again.',target:'#requirementsTable'});
      if (stepCount > (Array.isArray(data.processOverview) ? data.processOverview.length : 0))
        issues.unshift({section:'Editor',label:'Process steps still loading',message:'Allow the process editors to finish loading and try again.',target:'#processOverviewTable'});
    }
    if (action !== 'open') annotationsShown = true;
    if (issues.length || action === 'check') showIssues(issues, action);
    else if (action !== 'open') markFields([]);
    return issues.length === 0;
  };
  window.checkCharterReadiness = function () {
    if (typeof collectCurrentFormData === 'function')
      window.validateCitizenCharterForAction(collectCurrentFormData(), 'check');
  };
  window.resetCharterReadiness = function () {
    annotationsShown = false;
    window.clearTimeout(annotationTimer);
    clearFieldMarkers();
    reviewButton.hidden = true;
  };
})();