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
  // Screening aid, not an authoritative government plantilla directory.
  const positionWords = /\b(officer|nurse|nursing|administrative|aide|assistant|supervisor|chief|head|director|technologist|technician|pharmacist|physician|specialist|registrar|accountant|clerk|engineer|attendant|secretary|therapist|midwife|surgeon|dentist|nutritionist|dietitian|psychologist|social worker|social welfare|information technology|operator|cashier|encoder|statistician|librarian|architect|auditor|analyst|inspector|manager|coordinator|pathologist|radiologist|consultant|medical|health|records|housekeeper|driver|utility worker|janitor)\b/i;

  function validateCharterData(data) {
    const issues = [];
    const add = (section, label, message, target) => issues.push({ section, label, message, target });

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      add('File', 'Data format', 'This file does not contain valid Citizen Charter data.', null);
      return issues;
    }

    [
      ['serviceName', 'Service Name', '#serviceNameInput'],
      ['description', 'Description', '#editor'],
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
        const entry = row && typeof row === 'object' ? row : {};
        const checklist = text(entry.checklist), where = text(entry.where);
        if (!checklist)
          add('Checklist of Requirements', 'Row ' + n + ': Requirement', 'Specify the document and number/type of copies, or “None”.', target);
        else if (checklist.toLowerCase() !== 'none' && !/\b(?:\d+|one|two|three|four|five)\s*(?:\(\d+\)\s*)?(?:original|photocopy|copies|copy)\b/i.test(checklist))
          add('Checklist of Requirements', 'Row ' + n + ': Copy details', 'Specify quantity and original/photocopy (example: Valid ID — 1 photocopy).', target);
        if (!where)
          add('Checklist of Requirements', 'Row ' + n + ': Where to Secure', 'Specify the issuing office or “None”.', target);
        if (checklist.toLowerCase() === 'none' && where && where.toLowerCase() !== 'none')
          add('Checklist of Requirements', 'Row ' + n + ': Where to Secure', 'If no requirements exist, enter “None” in both columns.', target);
      });
    }

    if (!Array.isArray(data.processOverview) || !data.processOverview.length) {
      add('Process Overview', 'Process Steps', 'Add at least one complete process step.', '#processOverviewTable');
    } else {
      data.processOverview.forEach((row, index) => {
        const n = index + 1;
        const target = '#processOverviewTableBody tr:nth-child(' + n + ')';
        const entry = row && typeof row === 'object' ? row : {};
        if (!filled(entry.clientSteps))
          add('Process Overview', 'Step ' + n + ': Client Steps', 'Describe what the client does and where.', target);
        if (!filled(entry.agencyActions))
          add('Process Overview', 'Step ' + n + ': Agency Actions', 'Describe the action of agency personnel.', target);

        const fee = text(entry.feesToBePaid);
        if (!fee)
          add('Process Overview', 'Step ' + n + ': Fees', 'Enter the prescribed fee and PHP amount, or explicitly type “None”.', target);
        else if (/^(?:no fee|n\/a|nil|free)$/i.test(fee))
          add('Process Overview', 'Step ' + n + ': Fees', 'Use the exact word “None” for a service without a fee.', target);
        else if (fee.toLowerCase() !== 'none') {
          if (!feeAmount.test(fee))
            add('Process Overview', 'Step ' + n + ': Fees', 'Provide a fee type and exact PHP amount, for example Certification Fee: PHP 50.00.', target);
          if (numericRange.test(fee))
            add('Process Overview', 'Step ' + n + ': Fees', 'Fee ranges are not accepted. State the exact amount.', target);
          if (feeAmount.test(fee) && !fee.replace(feeAmount, '').replace(/[\s:;(),.-]/g, '').trim())
            add('Process Overview', 'Step ' + n + ': Fees', 'State the name/purpose of the fee as well as its amount.', target);
        }

        const time = text(entry.processingTime);
        if (!time)
          add('Process Overview', 'Step ' + n + ': Processing Time', 'Enter an exact duration (for example 15 minutes).', target);
        else if (!timeUnits.test(time) || numericRange.test(time) || /\b(varies|depending|tbd|n\/a)\b/i.test(time))
          add('Process Overview', 'Step ' + n + ': Processing Time', 'Use a fixed number of days, hours or minutes, not a range or “varies”.', target);

        const person = text(entry.personResponsible);
        if (!person)
          add('Process Overview', 'Step ' + n + ': Person Responsible', 'Enter the official plantilla position and office, not an employee name.', target);
        else {
          const parts = person.split(/,\s*|;\s*|\s+[–—-]\s+/).filter(Boolean);
          if (parts.length < 2 || !parts[0].trim() || !parts.slice(1).join(' ').trim())
            add('Process Overview', 'Step ' + n + ': Person Responsible', 'Provide the plantilla designation AND office (for example Administrative Officer V, Cashier Section).', target);
          if (!positionWords.test(parts[0] || ''))
            add('Process Overview', 'Step ' + n + ': Person Responsible', 'Use an official position title instead of a personal name; verify against the approved plantilla.', target);
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
    .cc-ready-highlight { outline:2px solid #2563eb !important; outline-offset:4px; transition:outline-color .3s; }
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

  let previousFocus = null;
  const close = () => {
    modal.hidden = true;
    document.body.style.overflow = '';
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  };
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
            jump.addEventListener('click', () => {
              close();
              const target = document.querySelector(issue.target);
              if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.classList.add('cc-ready-highlight');
                setTimeout(() => target.classList.remove('cc-ready-highlight'), 2400);
                const input = target.matches('input,textarea') ? target : target.querySelector('.ck-editor__editable, textarea, input');
                if (input) input.focus({ preventScroll: true });
              }
            });
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
    if (issues.length || action === 'check') showIssues(issues, action);
    return issues.length === 0;
  };
  window.checkCharterReadiness = function () {
    if (typeof collectCurrentFormData === 'function')
      window.validateCitizenCharterForAction(collectCurrentFormData(), 'check');
  };
})();