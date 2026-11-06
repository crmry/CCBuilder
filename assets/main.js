		let editor;
		let requirementEditors = [];
		let processOverviewEditors = [];
		let editorCounter = 0;
		let ckeditorInstance;
		let totalFeesEditor;
		let totalTimeEditor;
		let previewWindow = null;
		let currentOpenedFileName = '';

		// Auto-Save Draft Constants and State (Session-only: released when browser is closed, preserved across page refreshes)
		const DRAFT_CACHE_KEY = 'cc_builder_draft_cache';
		let autoSaveTimer = null;
		let isRestoringDraft = false;

		// Clean up any residual localStorage from previous versions
		try {
		    localStorage.removeItem(DRAFT_CACHE_KEY);
		} catch (e) {}

		function hasVisibleEditorContent(val) {
		    if (!val) return false;
		    return String(val).replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length > 0;
		}

		function toEditorHtml(val) {
		    if (!val) return '';
		    const str = String(val);
		    if (/<(?:p|ul|ol|li|br|strong|b|em|i|h[1-6]|div)\b/i.test(str)) {
		        return str;
		    }
		    const escaped = str
		        .replace(/&/g, '&amp;')
		        .replace(/</g, '&lt;')
		        .replace(/>/g, '&gt;')
		        .replace(/\r?\n/g, '<br>');
		    return `<p>${escaped}</p>`;
		}

		function hasSubstantialData(data) {
		    if (!data) return false;
		    if (data.serviceName && data.serviceName.trim()) return true;
		    if (data.office && data.office.trim()) return true;
		    if (hasVisibleEditorContent(data.description)) return true;
		    if (data.classification && data.classification !== 'Not selected' && data.classification !== '') return true;
		    if (data.transaction_type && data.transaction_type.length > 0) return true;
		    if (data.who_may_avail && data.who_may_avail.trim()) return true;
		    if (hasVisibleEditorContent(data.feesToBePaid)) return true;
		    if (hasVisibleEditorContent(data.processingTime)) return true;

		    if (data.requirements && data.requirements.some(r => 
		        (r.checklist && r.checklist.replace(/<[^>]*>/g, '').trim()) || 
		        (r.where && r.where.replace(/<[^>]*>/g, '').trim())
		    )) return true;

		    if (data.processOverview && data.processOverview.some(p => 
		        (p.clientSteps && p.clientSteps.replace(/<[^>]*>/g, '').trim()) ||
		        (p.agencyActions && p.agencyActions.replace(/<[^>]*>/g, '').trim()) ||
		        (p.personResponsible && p.personResponsible.replace(/<[^>]*>/g, '').trim())
		    )) return true;

		    return false;
		}

		function hasValidDraft() {
		    try {
		        const raw = sessionStorage.getItem(DRAFT_CACHE_KEY);
		        if (!raw) return false;
		        const payload = JSON.parse(raw);
		        if (!payload || !payload.data) return false;
		        return hasSubstantialData(payload.data);
		    } catch (e) {
		        return false;
		    }
		}

		function updateAutoSaveStatus(state) {
		    const badge = document.getElementById('draftStatusBadge');
		    const icon = document.getElementById('draftStatusIcon');
		    const text = document.getElementById('draftStatusText');
		    if (!badge || !icon || !text) return;

		    badge.classList.remove('saving', 'saved', 'cleared');

		    if (state === 'saving') {
		        badge.classList.add('saving');
		        icon.className = 'fa fa-spinner fa-spin text-warning';
		        text.textContent = 'Saving...';
		    } else if (state === 'saved') {
		        badge.classList.add('saved');
		        icon.className = 'fa fa-check-circle text-success';
		        text.textContent = 'Draft auto-saved';
		    } else if (state === 'cleared') {
		        badge.classList.add('cleared');
		        icon.className = 'fa fa-redo text-muted';
		        text.textContent = 'Form reset';
		        setTimeout(() => {
		            if (badge.classList.contains('cleared')) {
		                badge.classList.remove('cleared');
		                icon.className = 'fa fa-check-circle text-success';
		                text.textContent = 'Draft auto-saved';
		            }
		        }, 2000);
		    } else {
		        icon.className = 'fa fa-check-circle text-success';
		        text.textContent = 'Draft auto-saved';
		    }
		}

		function scheduleAutoSave() {
		    if (isRestoringDraft) return;
		    if (typeof window.refreshCitizenCharterReadiness === 'function') window.refreshCitizenCharterReadiness();
		    updateAutoSaveStatus('saving');
		    if (autoSaveTimer) clearTimeout(autoSaveTimer);
		    autoSaveTimer = setTimeout(() => {
		        performAutoSave();
		    }, 600);
		}

		function performAutoSave() {
		    if (isRestoringDraft) return;
		    try {
		        const data = collectCurrentFormData();
		        if (!data) return;

		        if (!hasSubstantialData(data)) {
		            sessionStorage.removeItem(DRAFT_CACHE_KEY);
		            updateAutoSaveStatus('idle');
		            return;
		        }

		        const payload = {
		            timestamp: Date.now(),
		            data: data
		        };
		        sessionStorage.setItem(DRAFT_CACHE_KEY, JSON.stringify(payload));
		        updateAutoSaveStatus('saved');
		    } catch (err) {
		        console.warn('Draft auto-save warning (sessionStorage quota or disabled):', err);
		        updateAutoSaveStatus('idle');
		    }
		}

		function checkAndRestoreDraft() {
		    try {
		        const raw = sessionStorage.getItem(DRAFT_CACHE_KEY);
		        if (!raw) return;

		        const payload = JSON.parse(raw);
		        if (!payload || !payload.data) {
		            sessionStorage.removeItem(DRAFT_CACHE_KEY);
		            return;
		        }

		        if (!hasSubstantialData(payload.data)) {
		            sessionStorage.removeItem(DRAFT_CACHE_KEY);
		            return;
		        }

		        isRestoringDraft = true;
		        applyFormData(payload.data);
		        isRestoringDraft = false;

		        updateAutoSaveStatus('saved');
		    } catch (err) {
		        console.error('Error restoring draft:', err);
		        isRestoringDraft = false;
		    }
		}

		document.addEventListener("DOMContentLoaded", () => {
		    const descriptionConfig = {
		        toolbar: [
		            'heading',
		            '|',
		            'bold',
		            'italic',
		            '|',
		            'bulletedList',
		            'numberedList',
		            '|',
		            'outdent',
		            'indent',
		            '|',
		            'undo',
		            'redo'
		        ],
		        placeholder: 'Provide a concise statement on the service purpose, statutory legal mandate/basis, and qualification criteria (e.g., This process covers the verification, evaluation, and issuance of official certifications/permits for eligible clients pursuant to RA 11032)...'
		    };

		    const draftExists = hasValidDraft();
		    if (!draftExists) {
		        addRequirementRow();
		        addProcessOverviewRow();
		    }

		    const totalCellEditorConfig = {
		        toolbar: ['bold', 'italic', 'bulletedList', 'numberedList']
		    };

		    const applyEditorWrappingStyles = (editorInstance) => {
		        editorInstance.editing.view.change(writer => {
		            writer.setStyle('word-break', 'keep-all', editorInstance.editing.view.document.getRoot());
		            writer.setStyle('overflow-wrap', 'break-word', editorInstance.editing.view.document.getRoot());
		            writer.setStyle('white-space', 'normal', editorInstance.editing.view.document.getRoot());
		            writer.setStyle('hyphens', 'none', editorInstance.editing.view.document.getRoot());
		        });
		    };

		    const mainEditorPromise = ClassicEditor.create(document.querySelector("#editor"), descriptionConfig).then(e => {
		        ckeditorInstance = e;
		        ckeditorInstance.model.document.on('change:data', () => scheduleAutoSave());
		    }).catch(error => {
		        console.error('Error initializing main editor:', error);
		    });

		    const totalFeesPromise = ClassicEditor.create(document.querySelector("#FeesToBePaid"), {
		        ...totalCellEditorConfig,
		        placeholder: 'e.g., Total: PHP 50.00 or None'
		    }).then(e => {
		        totalFeesEditor = e;
		        applyEditorWrappingStyles(e);
		        e.model.document.on('change:data', () => scheduleAutoSave());
		    }).catch(error => {
		        console.error('Error initializing total fees editor:', error);
		    });

		    const totalTimePromise = ClassicEditor.create(document.querySelector("#ProcessingTime"), {
		        ...totalCellEditorConfig,
		        placeholder: 'e.g., Total: 2 Days, 3 Hours (1 Day = 8 hrs)'
		    }).then(e => {
		        totalTimeEditor = e;
		        applyEditorWrappingStyles(e);
		        e.model.document.on('change:data', () => scheduleAutoSave());
		    }).catch(error => {
		        console.error('Error initializing total processing time editor:', error);
		    });

		    Promise.allSettled([mainEditorPromise, totalFeesPromise, totalTimePromise]).then(() => {
		        if (draftExists) {
		            checkAndRestoreDraft();
		        }
		    });

		    // Interactive sync for custom option cards (radio & checkbox)
		    document.addEventListener("change", (e) => {
		        if (e.target.matches('.custom-option-card input[type="radio"]')) {
		            document.querySelectorAll(`input[name="${e.target.name}"]`).forEach(r => {
		                r.closest('.custom-option-card')?.classList.toggle('active', r.checked);
		            });
		            scheduleAutoSave();
		        } else if (e.target.matches('.custom-option-card input[type="checkbox"]')) {
		            e.target.closest('.custom-option-card')?.classList.toggle('active', e.target.checked);
		            scheduleAutoSave();
		        }
		    });

		    // Auto-save listeners on form inputs
		    const form = document.getElementById('citizenCharterForm');
		    if (form) {
		        form.addEventListener('input', () => scheduleAutoSave());
		        form.addEventListener('change', () => scheduleAutoSave());
		    }

		    // Auto-adjust height for textareas as content is typed
		    document.querySelectorAll('textarea.form-control').forEach(autoAdjustTextarea);
		    document.addEventListener('input', (e) => {
		        if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('form-control')) {
		            autoAdjustTextarea(e.target);
		        }
		    });

		    // Initialize tooltips
		    if (typeof bootstrap !== 'undefined' && bootstrap.Tooltip) {
		        document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
		    }

		    // Check and display Data Privacy Statement modal on first visit
		    checkAndShowPrivacyNoticeOnVisit();
		});

		let tourLaunchedOnVisit = false;

		function openPrivacyNoticeModal() {
		    const modalEl = document.getElementById('privacyNoticeModal');
		    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
		        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
		        modal.show();
		    }
		}

		function acknowledgePrivacyNotice() {
		    const checkbox = document.getElementById('dontShowPrivacyAgain');
		    if (checkbox && checkbox.checked) {
		        try {
		            localStorage.setItem('cc_privacy_acknowledged', 'true');
		        } catch (e) {}
		    }
		    const modalEl = document.getElementById('privacyNoticeModal');
		    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
		        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
		        modal.hide();
		    }

		    // Activate tour only after the privacy modal closes
		    if (!tourLaunchedOnVisit && !tourRunning) {
		        setTimeout(() => {
		            startSystemTour();
		        }, 350);
		    }
		}

		function checkAndShowPrivacyNoticeOnVisit() {
		    try {
		        const acknowledged = localStorage.getItem('cc_privacy_acknowledged');
		        if (acknowledged !== 'true') {
		            setTimeout(() => {
		                openPrivacyNoticeModal();
		            }, 400);
		        }
		    } catch (e) {}
		}

		// Ensure tour activates when privacy modal is hidden on initial visit
		document.addEventListener('DOMContentLoaded', () => {
		    const modalEl = document.getElementById('privacyNoticeModal');
		    if (modalEl) {
		        modalEl.addEventListener('hidden.bs.modal', () => {
		            if (!tourLaunchedOnVisit && !tourRunning) {
		                setTimeout(() => {
		                    startSystemTour();
		                }, 300);
		            }
		        });
		    }
		});

		function autoAdjustTextarea(el) {
		    if (!el) return;
		    el.style.height = 'auto';
		    el.style.height = Math.max(el.scrollHeight + 2, 42) + 'px';
		}

		function addNewRowFromActionPanel() {
		    addProcessOverviewRowAndScroll();
		}

		function addProcessOverviewRowAndScroll() {
		    addProcessOverviewRow();
		    scheduleAutoSave();
		    setTimeout(() => {
		        const rows = document.querySelectorAll('#processOverviewTableBody tr');
		        if (rows.length > 0) {
		            const lastRow = rows[rows.length - 1];
		            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
		            lastRow.classList.add('highlight-row');
		            setTimeout(() => lastRow.classList.remove('highlight-row'), 2000);
		        }
		    }, 100);
		}

		function addRequirementRowAndScroll() {
		    addRequirementRow();
		    scheduleAutoSave();
		    setTimeout(() => {
		        const rows = document.querySelectorAll('#requirementsTableBody tr');
		        if (rows.length > 0) {
		            const lastRow = rows[rows.length - 1];
		            lastRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
		            lastRow.classList.add('highlight-row');
		            setTimeout(() => lastRow.classList.remove('highlight-row'), 2000);
		        }
		    }, 100);
		}

		function addRequirementRow(requirementValue = '', whereValue = '') {
		    const tableBody = document.getElementById('requirementsTableBody');
		    const isFirstRow = (tableBody.rows.length === 0);
		    const newRow = document.createElement('tr');
		    const rowIndex = editorCounter++;

		    newRow.innerHTML = `
        <td>
            <div id="requirement-${rowIndex}"></div>
        </td>
        <td>
            <div id="whereToSecure-${rowIndex}"></div>
        </td>
        <td style="text-align: center; vertical-align: middle;">
            <div class="table-actions-btns">
                <button type="button" class="add-btn" onclick="addRequirementRow(); scheduleAutoSave();" title="Add Additional Row">
                    <i class="fa fa-plus"></i> ADD
                </button>
                ${!isFirstRow ? `
                <button type="button" class="delete-btn" onclick="deleteRequirementRow(this.closest('tr'))" title="Delete Row">
                    <i class="fa fa-trash-alt"></i> Delete
                </button>` : ''}
            </div>
        </td>
    `;
		    tableBody.appendChild(newRow);

		    const reqConfig = {
		        toolbar: ['bold', 'italic', 'bulletedList', 'numberedList'],
		        placeholder: 'Document Name (# of copies, original/photocopy) — e.g., Duly accomplished application form (1 original copy), Valid Government-issued ID (1 photocopy)'
		    };

		    const whereConfig = {
		        toolbar: ['bold', 'italic', 'bulletedList', 'numberedList'],
		        placeholder: 'Specific issuing office, division, desk, or portal (e.g., Agency Receiving Section / Issuing Government Agency / Online Portal)'
		    };

		    ClassicEditor.create(document.querySelector(`#requirement-${rowIndex}`), reqConfig)
		        .then(editorInstance => {
		            editorInstance.setData(requirementValue);
		            editorInstance.editing.view.change(writer => {
		                writer.setStyle('word-break', 'keep-all', editorInstance.editing.view.document.getRoot());
		                writer.setStyle('overflow-wrap', 'break-word', editorInstance.editing.view.document.getRoot());
		                writer.setStyle('white-space', 'normal', editorInstance.editing.view.document.getRoot());
		                writer.setStyle('hyphens', 'none', editorInstance.editing.view.document.getRoot());
		            });
		            requirementEditors.push({
		                type: 'requirement',
		                index: rowIndex,
		                editor: editorInstance
		            });
		            editorInstance.model.document.on('change:data', () => scheduleAutoSave());
		        });
			
		    ClassicEditor.create(document.querySelector(`#whereToSecure-${rowIndex}`), whereConfig)
		        .then(editorInstance => {
		            editorInstance.setData(whereValue);
		            editorInstance.editing.view.change(writer => {
		                writer.setStyle('word-break', 'keep-all', editorInstance.editing.view.document.getRoot());
		                writer.setStyle('overflow-wrap', 'break-word', editorInstance.editing.view.document.getRoot());
		                writer.setStyle('white-space', 'normal', editorInstance.editing.view.document.getRoot());
		                writer.setStyle('hyphens', 'none', editorInstance.editing.view.document.getRoot());
		            });
		            requirementEditors.push({
		                type: 'whereToSecure',
		                index: rowIndex,
		                editor: editorInstance
		            });
		            editorInstance.model.document.on('change:data', () => scheduleAutoSave());
		        });
		}

		function addProcessOverviewRow(clientSteps = '', agencyActions = '', fees = '', time = '', person = '') {
		    const tableBody = document.getElementById('processOverviewTableBody');
		    const isFirstRow = (tableBody.rows.length === 0);
		    const newRow = document.createElement('tr');
		    const rowIndex = editorCounter++;

		    newRow.innerHTML = `
        <td><div id="clientSteps-${rowIndex}"></div></td>
        <td><div id="agencyActions-${rowIndex}"></div></td>
        <td><div id="feesToBePaid-${rowIndex}"></div></td>
        <td><div id="processingTime-${rowIndex}"></div></td>
        <td><div id="personResponsible-${rowIndex}"></div></td>
        <td style="text-align: center; vertical-align: middle;">
            <div class="table-actions-btns">
                <button type="button" class="add-btn" onclick="addProcessOverviewRow(); scheduleAutoSave();" title="Add Additional Row">
                    <i class="fa fa-plus"></i> ADD
                </button>
                ${!isFirstRow ? `
                <button type="button" class="delete-btn" onclick="deleteProcessOverviewRow(this.closest('tr'))" title="Delete Row">
                    <i class="fa fa-trash-alt"></i> Delete
                </button>` : ''}
            </div>
        </td>
    `;
		    tableBody.appendChild(newRow);

		    const editorConfig = {
		        toolbar: ['bold', 'italic', 'bulletedList', 'numberedList'],
		    };

		    const stepPlaceholders = {
		        clientSteps: 'Numbered client action and location (e.g., 1. Submit request to Receiving Section). Leave blank when Agency Actions continue the same step as 1.2, 1.3, etc.',
		        agencyActions: 'Numbered action per step (e.g., 1.1 Receive documents, verify completeness against checklist, and issue acknowledgment receipt)',
		        feesToBePaid: 'Type of Fee: Currency Amount (e.g., Certification Fee: PHP 50.00) or "None" (Ranging is prohibited)',
		        processingTime: 'Exact duration: # Day/s, # Hour/s, # Minute/s (e.g., 15 minutes or 1 Day, 2 Hours) (Ranging is prohibited)',
		        personResponsible: 'Official plantilla title(s) and responsible office (e.g., Nurse Attendant II / Administrative Aide IV, IMISS Office). Multiple titles may appear on separate lines above their office.'
		    };

		    const fields = [{
		            type: 'clientSteps',
		            value: clientSteps
		        },
		        {
		            type: 'agencyActions',
		            value: agencyActions
		        },
		        {
		            type: 'feesToBePaid',
		            value: fees
		        },
		        {
		            type: 'processingTime',
		            value: time
		        },
		        {
		            type: 'personResponsible',
		            value: person
		        },
		    ];

		    fields.forEach(field => {
		        ClassicEditor.create(document.querySelector(`#${field.type}-${rowIndex}`), {
		            ...editorConfig,
		            placeholder: stepPlaceholders[field.type] || ''
		        })
		            .then(editorInstance => {
		                editorInstance.setData(field.value);
		                editorInstance.editing.view.change(writer => {
		                    writer.setStyle('word-break', 'keep-all', editorInstance.editing.view.document.getRoot());
		                    writer.setStyle('overflow-wrap', 'break-word', editorInstance.editing.view.document.getRoot());
		                    writer.setStyle('white-space', 'normal', editorInstance.editing.view.document.getRoot());
		                    writer.setStyle('hyphens', 'none', editorInstance.editing.view.document.getRoot());
		                });
		                processOverviewEditors.push({
		                    type: field.type,
		                    index: rowIndex,
		                    editor: editorInstance
		                });
		                editorInstance.model.document.on('change:data', () => scheduleAutoSave());
		            });
		    });
		}

		function deleteRequirementRow(row) {
		    if (!row) return;
		    const tableBody = document.getElementById('requirementsTableBody');
		    if (tableBody.rows.length <= 1 || row === tableBody.rows[0]) {
		        return; // Prevent deleting the first permanent row
		    }
		    const editorDiv = row.querySelector('[id^="requirement-"]');
		    if (editorDiv) {
		        const rowIndex = editorDiv.id.split('-')[1];
		        requirementEditors = requirementEditors.filter(editor => editor.index !== parseInt(rowIndex));
		    }
		    row.remove();
		    updateRequirementTableActions();
		    scheduleAutoSave();
		}

		function deleteProcessOverviewRow(row) {
		    if (!row) return;
		    const tableBody = document.getElementById('processOverviewTableBody');
		    if (tableBody.rows.length <= 1 || row === tableBody.rows[0]) {
		        return; // Prevent deleting the first permanent row
		    }
		    const editorDiv = row.querySelector('[id^="clientSteps-"]');
		    if (editorDiv) {
		        const rowIndex = editorDiv.id.split('-')[1];
		        processOverviewEditors = processOverviewEditors.filter(editor => editor.index !== parseInt(rowIndex));
		    }
		    row.remove();
		    updateProcessOverviewTableActions();
		    scheduleAutoSave();
		}

		function updateRequirementTableActions() {
		    const tableBody = document.getElementById('requirementsTableBody');
		    Array.from(tableBody.rows).forEach((r, idx) => {
		        const deleteBtn = r.querySelector('.delete-btn');
		        if (idx === 0 && deleteBtn) {
		            deleteBtn.remove();
		        }
		    });
		}

		function updateProcessOverviewTableActions() {
		    const tableBody = document.getElementById('processOverviewTableBody');
		    Array.from(tableBody.rows).forEach((r, idx) => {
		        const deleteBtn = r.querySelector('.delete-btn');
		        if (idx === 0 && deleteBtn) {
		            deleteBtn.remove();
		        }
		    });
		}

		function clearForm() {
		    if (typeof window.resetCharterReadiness === 'function') window.resetCharterReadiness();
		    try {
		        sessionStorage.removeItem(DRAFT_CACHE_KEY);
		        localStorage.removeItem(DRAFT_CACHE_KEY);
		    } catch (e) {
		        console.warn('Could not remove draft storage:', e);
		    }

		    document.getElementById('citizenCharterForm').reset();
		    document.querySelectorAll('.custom-option-card').forEach(c => c.classList.remove('active'));

		    if (ckeditorInstance) {
		        ckeditorInstance.setData('');
		    }
		    if (totalFeesEditor) {
		        totalFeesEditor.setData('');
		    }
		    if (totalTimeEditor) {
		        totalTimeEditor.setData('');
		    }
		    requirementEditors.forEach(e => {
		        try { e.editor.destroy(); } catch (err) {}
		    });
		    requirementEditors = [];
		    const reqBody = document.getElementById('requirementsTableBody');
		    if (reqBody) reqBody.innerHTML = '';

		    processOverviewEditors.forEach(e => {
		        try { e.editor.destroy(); } catch (err) {}
		    });
		    processOverviewEditors = [];
		    const procBody = document.getElementById('processOverviewTableBody');
		    if (procBody) procBody.innerHTML = '';

		    editorCounter = 0;
		    addRequirementRow();
		    addProcessOverviewRow();
		    setTimeout(() => document.querySelectorAll('textarea.form-control').forEach(autoAdjustTextarea), 50);

		    if (previewWindow && !previewWindow.closed) {
		        previewWindow.close();
		        previewWindow = null;
		    }
		    currentOpenedFileName = '';
		    const importInput = document.getElementById('importFileInput');
		    if (importInput) importInput.value = '';

		    updateAutoSaveStatus('cleared');
		    if (typeof window.refreshCitizenCharterReadiness === 'function') window.refreshCitizenCharterReadiness();
		}

		function collectCurrentFormData() {
		    const form = document.getElementById('citizenCharterForm');
		    if (!form) return null;
		    const formData = new FormData(form);
		    const data = {
		        serviceName: formData.get('serviceName') || '',
		        office: formData.get('office') || '',
		        classification: formData.get('classification') || '',
		        transaction_type: formData.getAll('transaction_type') || [],
		        who_may_avail: formData.get('who_may_avail') || '',
		        feesToBePaid: totalFeesEditor ? totalFeesEditor.getData() : (formData.get('feesToBePaid') || ''),
		        processingTime: totalTimeEditor ? totalTimeEditor.getData() : (formData.get('processingTime') || ''),
		        description: ckeditorInstance ? ckeditorInstance.getData() : '',
		        requirements: [],
		        processOverview: []
		    };

		    document.querySelectorAll('#requirementsTableBody tr').forEach(row => {
		        const div = row.querySelector('div');
		        if (!div || !div.id) return;
		        const rowIndex = div.id.split('-')[1];
		        const requirementEditor = requirementEditors.find(editor => editor.index == rowIndex && editor.type === 'requirement');
		        const whereToSecureEditor = requirementEditors.find(editor => editor.index == rowIndex && editor.type === 'whereToSecure');

		        if (requirementEditor && whereToSecureEditor) {
		            data.requirements.push({
		                checklist: requirementEditor.editor.getData(),
		                where: whereToSecureEditor.editor.getData()
		            });
		        }
		    });

		    document.querySelectorAll('#processOverviewTableBody tr').forEach(row => {
		        const div = row.querySelector('div');
		        if (!div || !div.id) return;
		        const rowIndex = div.id.split('-')[1];
		        const clientStepsEditor = processOverviewEditors.find(editor => editor.index == rowIndex && editor.type === 'clientSteps');
		        const agencyActionsEditor = processOverviewEditors.find(editor => editor.index == rowIndex && editor.type === 'agencyActions');
		        const feesToBePaidEditor = processOverviewEditors.find(editor => editor.index == rowIndex && editor.type === 'feesToBePaid');
		        const processingTimeEditor = processOverviewEditors.find(editor => editor.index == rowIndex && editor.type === 'processingTime');
		        const personResponsibleEditor = processOverviewEditors.find(editor => editor.index == rowIndex && editor.type === 'personResponsible');

		        if (clientStepsEditor && agencyActionsEditor && feesToBePaidEditor && processingTimeEditor && personResponsibleEditor) {
		            data.processOverview.push({
		                clientSteps: clientStepsEditor.editor.getData(),
		                agencyActions: agencyActionsEditor.editor.getData(),
		                feesToBePaid: feesToBePaidEditor.editor.getData(),
		                processingTime: processingTimeEditor.editor.getData(),
		                personResponsible: personResponsibleEditor.editor.getData()
		            });
		        }
		    });

		    return data;
		}

		function applyFormData(data) {
		    if (!data) return;

		    const serviceNameInput = document.getElementById('serviceNameInput');
		    if (serviceNameInput) serviceNameInput.value = data.serviceName || '';

		    const officeTextarea = document.querySelector('textarea[name="office"]');
		    if (officeTextarea) officeTextarea.value = data.office || '';

		    const whoMayAvailTextarea = document.querySelector('textarea[name="who_may_avail"]');
		    if (whoMayAvailTextarea) whoMayAvailTextarea.value = data.who_may_avail || '';

		    if (totalFeesEditor) {
		        totalFeesEditor.setData(toEditorHtml(data.feesToBePaid));
		    } else {
		        const feesInput = document.getElementById('FeesToBePaid');
		        if (feesInput && 'value' in feesInput) feesInput.value = data.feesToBePaid || '';
		    }

		    if (totalTimeEditor) {
		        totalTimeEditor.setData(toEditorHtml(data.processingTime));
		    } else {
		        const processingTimeInput = document.getElementById('ProcessingTime');
		        if (processingTimeInput && 'value' in processingTimeInput) processingTimeInput.value = data.processingTime || '';
		    }

		    if (ckeditorInstance) {
		        ckeditorInstance.setData(data.description || '');
		    }

		    document.querySelectorAll('input[name="classification"]').forEach(el => {
		        el.checked = (el.value === data.classification);
		        el.closest('.custom-option-card')?.classList.toggle('active', el.checked);
		    });

		    document.querySelectorAll('input[name="transaction_type"]').forEach(el => {
		        el.checked = data.transaction_type && data.transaction_type.includes(el.value);
		        el.closest('.custom-option-card')?.classList.toggle('active', el.checked);
		    });

		    requirementEditors.forEach(e => {
		        try { e.editor.destroy(); } catch (err) {}
		    });
		    requirementEditors = [];
		    const reqBody = document.getElementById('requirementsTableBody');
		    if (reqBody) reqBody.innerHTML = '';

		    processOverviewEditors.forEach(e => {
		        try { e.editor.destroy(); } catch (err) {}
		    });
		    processOverviewEditors = [];
		    const procBody = document.getElementById('processOverviewTableBody');
		    if (procBody) procBody.innerHTML = '';

		    editorCounter = 0;

		    if (data.requirements && data.requirements.length > 0) {
		        data.requirements.forEach(item => addRequirementRow(item.checklist, item.where));
		    } else {
		        addRequirementRow();
		    }

		    if (data.processOverview && data.processOverview.length > 0) {
		        data.processOverview.forEach(item =>
		            addProcessOverviewRow(item.clientSteps, item.agencyActions, item.feesToBePaid, item.processingTime, item.personResponsible)
		        );
		    } else {
		        addProcessOverviewRow();
		    }

		    setTimeout(() => {
		        document.querySelectorAll('textarea.form-control').forEach(autoAdjustTextarea);
		    }, 100);
		}

		function saveFormData() {
		    const data = collectCurrentFormData();
		    if (!data || !window.validateCitizenCharterForAction(data, 'save')) return;

		    // Determine a clean, valid file name for saving
		    let fileName = '';
		    const rawServiceName = (data.serviceName || '').trim();

		    if (rawServiceName) {
		        // Sanitize: strip newlines, slashes, and invalid filesystem characters: \ / : * ? " < > |
		        let clean = rawServiceName
		            .replace(/[\r\n\t]+/g, ' ')
		            .replace(/[\\/:*?"<>|]+/g, '_')
		            .replace(/\s+/g, ' ')
		            .trim();
		        // Truncate to reasonable length to prevent OS filesystem errors
		        if (clean.length > 120) {
		            clean = clean.substring(0, 120).trim();
		        }
		        if (clean) {
		            fileName = clean + (clean.toLowerCase().endsWith('.json') ? '' : '.json');
		        }
		    }

		    if (!fileName && currentOpenedFileName) {
		        fileName = currentOpenedFileName;
		        if (!fileName.toLowerCase().endsWith('.json')) {
		            fileName += '.json';
		        }
		    }

		    if (!fileName) {
		        fileName = 'citizen_charter.json';
		    }

		    const blob = new Blob([JSON.stringify(data, null, 2)], {
		        type: "application/json"
		    });
		    const a = document.createElement("a");
		    a.href = URL.createObjectURL(blob);
		    a.download = fileName;
		    document.body.appendChild(a);
		    a.click();
		    document.body.removeChild(a);
		    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
		}
		const exportFormData = saveFormData;

		// Import is intentionally different from final-output validation: a user
		// must be able to reopen an old/incomplete draft in order to correct it.
		function normalizeCitizenCharterImport(raw) {
		    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		        throw new Error('This is not a Citizen Charter JSON object.');
		    }
		    if (!Object.prototype.hasOwnProperty.call(raw, 'requirements') ||
		        !Object.prototype.hasOwnProperty.call(raw, 'processOverview')) {
		        throw new Error('This file is missing the requirements or processOverview section of a Citizen Charter backup.');
		    }
		    if (!Array.isArray(raw.requirements) || !Array.isArray(raw.processOverview)) {
		        throw new Error('The requirements and processOverview sections must be lists.');
		    }
		    const stringField = (value, path) => {
		        if (value === undefined || value === null) return '';
		        if (typeof value !== 'string') throw new Error('Invalid data type in ' + path + ': text is required.');
		        return value;
		    };
		    const preferred = (row, primary, legacy, path) =>
		        stringField(row[primary] !== undefined ? row[primary] : row[legacy], path);
		    const entries = raw.requirements.map((entry, i) => {
		        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
		            throw new Error('Invalid requirements[' + i + ']: expected a row of text fields.');
		        return {
		            checklist: preferred(entry, 'checklist', 'requirement', 'requirements[' + i + '].checklist'),
		            where: preferred(entry, 'where', 'whereToSecure', 'requirements[' + i + '].where')
		        };
		    });
		    const steps = raw.processOverview.map((entry, i) => {
		        if (!entry || typeof entry !== 'object' || Array.isArray(entry))
		            throw new Error('Invalid processOverview[' + i + ']: expected a row of text fields.');
		        const fields = {};
		        for (const key of ['clientSteps', 'agencyActions', 'feesToBePaid', 'processingTime', 'personResponsible']) {
		            const legacyKey = {feesToBePaid:'fees', processingTime:'time', personResponsible:'person'}[key] || key;
		            fields[key] = preferred(entry, key, legacyKey, 'processOverview[' + i + '].' + key);
		        }
		        return fields;
		    });
		    const types = raw.transaction_type !== undefined ? raw.transaction_type : raw.transactionTypes;
		    let transactions;
		    if (Array.isArray(types)) {
		        if (!types.every(v => typeof v === 'string'))
		            throw new Error('Invalid transaction_type: every selected type must be text.');
		        transactions = types;
		    } else if (typeof types === 'string') {
		        transactions = types.split(/\s*,\s*/).filter(Boolean);
		    } else if (types === undefined || types === null) {
		        transactions = [];
		    } else {
		        throw new Error('Invalid transaction_type: expected a list of transaction types.');
		    }
		    return {
		        serviceName: stringField(raw.serviceName, 'serviceName'),
		        office: stringField(raw.office, 'office'),
		        description: stringField(raw.description, 'description'),
		        classification: stringField(raw.classification, 'classification'),
		        transaction_type: transactions,
		        who_may_avail: stringField(
		            raw.who_may_avail !== undefined ? raw.who_may_avail : raw.whoMayAvail, 'who_may_avail'),
		        feesToBePaid: stringField(
		            raw.feesToBePaid !== undefined ? raw.feesToBePaid : raw.FeesToBePaid, 'feesToBePaid'),
		        processingTime: stringField(
		            raw.processingTime !== undefined ? raw.processingTime : raw.ProcessingTime, 'processingTime'),
		        requirements: entries,
		        processOverview: steps
		    };
		}

		function importFormData(event) {
		    const input = event && (event.currentTarget || event.target);
		    const file = input && input.files && input.files[0];
		    if (!file) return;
		    const reportError = (message, rawValue) => {
		        if (window.ccImportReview && typeof window.ccImportReview.present === 'function') {
		            window.ccImportReview.present(file.name,
		                [{section:'File import', label:'Unable to open this JSON file', message, jsonPath:'$'}],
		                rawValue === undefined ? null : rawValue, false);
		        } else {
		            window.alert(message);
		        }
		    };
		    const applyImportedData = (data, needsCorrection) => {
		        const current = collectCurrentFormData();
		        if (current && hasSubstantialData(current) &&
		            !window.confirm('Open ' + file.name + '? This will replace the current form. Continue?')) {
		            return false;
		        }
		        if (typeof window.resetCharterReadiness === 'function') window.resetCharterReadiness();
		        isRestoringDraft = true;
		        try {
		            applyFormData(data);
		            currentOpenedFileName = file.name;
		        } catch (err) {
		            isRestoringDraft = false;
		            throw err;
		        }
		        // CKEditor creates dynamic rows asynchronously. Wait until every
		        // imported row has been initialized before validating or saving.
		        const requiredRequirementEditors = Math.max(1, data.requirements.length) * 2;
		        const requiredStepEditors = Math.max(1, data.processOverview.length) * 5;
		        let attempts = 0;
		        const finish = () => {
		            if (requirementEditors.length >= requiredRequirementEditors &&
		                processOverviewEditors.length >= requiredStepEditors || ++attempts >= 120) {
		                isRestoringDraft = false;
		                scheduleAutoSave();
		                if (needsCorrection && typeof window.checkCharterReadiness === 'function')
		                    window.checkCharterReadiness();
		            } else {
		                window.setTimeout(finish, 100);
		            }
		        };
		        window.setTimeout(finish, 100);
		        return true;
		    };
		    const reader = new FileReader();
		    reader.onerror = () => {
		        reportError('The browser could not read the selected file. Please try opening the JSON file again.');
		        input.value = '';
		    };
		    reader.onload = () => {
		        try {
		            const rawText = String(reader.result || '').replace(/^\uFEFF/, '');
		            let parsed;
		            try {
		                parsed = JSON.parse(rawText);
		            } catch (err) {
		                const detail = window.ccJsonDiagnostics?.syntaxDetails?.(err, rawText) || err.message;
		                reportError('Invalid JSON syntax: ' + detail);
		                return;
		            }
		            let data;
		            try {
		                data = normalizeCitizenCharterImport(parsed);
		            } catch (err) {
		                reportError(err.message, parsed);
		                return;
		            }
		            const issues = typeof window.validateCharterData === 'function'
		                ? window.validateCharterData(data) : [];
		            if (issues.length && window.ccImportReview && typeof window.ccImportReview.present === 'function') {
		                window.ccImportReview.present(file.name, issues, data, true,
		                    () => applyImportedData(data, true));
		            } else {
		                // Fail open for editing (never for final export) if the
		                // optional diagnostics UI is unavailable.
		                applyImportedData(data, issues.length > 0);
		            }
		        } catch (err) {
		            console.error('Citizen Charter import error:', err);
		            isRestoringDraft = false;
		            reportError('Unable to load this file: ' + (err && err.message ? err.message : 'Unknown error.'));
		        } finally {
		            input.value = ''; // Allows choosing the same file again.
		        }
		    };
		    try {
		        reader.readAsText(file, 'UTF-8');
		    } catch (err) {
		        reportError('Unable to access the selected file: ' + err.message);
		        input.value = '';
		    }
		}
		window.ccMainImportFile = importFormData;

		function getCitizenCharterData() {
		    const rawTotalFees = totalFeesEditor ? totalFeesEditor.getData() : '';
		    const rawTotalTime = totalTimeEditor ? totalTimeEditor.getData() : '';
		    const FeesToBePaid = hasVisibleEditorContent(rawTotalFees) ? rawTotalFees : "NONE";
		    const ProcessingTime = hasVisibleEditorContent(rawTotalTime) ? rawTotalTime : "N/A";
		    const serviceName = document.getElementById('serviceNameInput').value;
		    const description = ckeditorInstance ? ckeditorInstance.getData() : '';
		    const office = document.querySelector('textarea[name="office"]').value;
		    const classificationElement = document.querySelector('input[name="classification"]:checked');
		    const classification = classificationElement ? classificationElement.value : 'Not selected';
		    const transactionTypes = Array.from(document.querySelectorAll('input[name="transaction_type"]:checked'))
		        .map(el => el.value).join(', ');
		    const whoMayAvail = document.querySelector('textarea[name="who_may_avail"]').value.replace(/\n/g, '<br>');

		    let requirements = [];
		    requirementEditors.forEach(req => {
		        if (req.type === 'requirement') {
		            const requirementData = req.editor.getData();
		            const whereToSecureEditor = requirementEditors.find(r => r.index === req.index && r.type === 'whereToSecure');
		            const whereToSecureData = whereToSecureEditor ? whereToSecureEditor.editor.getData() : '';
		            requirements.push({
		                requirement: requirementData,
		                whereToSecure: whereToSecureData
		            });
		        }
		    });

		    let processOverview = [];
		    processOverviewEditors.forEach(proc => {
		        if (proc.type === 'clientSteps') {
		            const clientStepsData = proc.editor.getData();
		            const agencyActionsEditor = processOverviewEditors.find(p => p.index === proc.index && p.type === 'agencyActions');
		            const agencyActionsData = agencyActionsEditor ? agencyActionsEditor.editor.getData() : '';
		            const feesToBePaidEditor = processOverviewEditors.find(p => p.index === proc.index && p.type === 'feesToBePaid');
		            const feesToBePaidData = feesToBePaidEditor ? feesToBePaidEditor.editor.getData() : '';
		            const processingTimeEditor = processOverviewEditors.find(p => p.index === proc.index && p.type === 'processingTime');
		            const processingTimeData = processingTimeEditor ? processingTimeEditor.editor.getData() : '';
		            const personResponsibleEditor = processOverviewEditors.find(p => p.index === proc.index && p.type === 'personResponsible');
		            const personResponsibleData = personResponsibleEditor ? personResponsibleEditor.editor.getData() : '';
		            processOverview.push({
		                clientSteps: clientStepsData,
		                agencyActions: agencyActionsData,
		                feesToBePaid: feesToBePaidData,
		                processingTime: processingTimeData,
		                personResponsible: personResponsibleData
		            });
		        }
		    });

		    return {
		        serviceName,
		        description,
		        office,
		        classification,
		        transactionTypes,
		        whoMayAvail,
		        requirements,
		        processOverview,
		        FeesToBePaid,
		        ProcessingTime
		    };
		}

		function generateReportHtml(data) {
		    const {
		        serviceName,
		        description,
		        office,
		        classification,
		        transactionTypes,
		        whoMayAvail,
		        requirements,
		        processOverview,
		        FeesToBePaid,
		        ProcessingTime
		    } = data;

		    return `
		        <div class="main-header">
		            <span class="service-name">${serviceName || "Citizen's Charter"}</span>
		            <div class="service-description">${description || ""}</div>
		        </div>
		        <table class="info-table">
		            <colgroup>
		                <col style="width: 27.5%;">
		                <col style="width: 72.5%;">
		            </colgroup>
		            <tr>
		                <th style="width: 27.5%;">Office or Division:</th>
		                <td style="width: 72.5%;">${office || ""}</td>
		            </tr>
		            <tr>
		                <th>Classification:</th>
		                <td>${classification || ""}</td>
		            </tr>
		            <tr>
		                <th>Type of Transaction:</th>
		                <td>${transactionTypes || ""}</td>
		            </tr>
		            <tr>
		                <th>Who may avail:</th>
		                <td>${whoMayAvail || ""}</td>
		            </tr>
		        </table>

		        <table class="requirements-table">
		            <colgroup>
		                <col style="width: 54%;">
		                <col style="width: 46%;">
		            </colgroup>
		            <tbody>
		                <tr>
		                    <th style="width: 54%; text-align: center;">CHECKLIST OF REQUIREMENTS</th>
		                    <th style="width: 46%; text-align: center;">WHERE TO SECURE</th>
		                </tr>
		                ${requirements && requirements.length > 0 ? requirements.map(req => `
		                    <tr>
		                        <td>${req.requirement}</td>
		                        <td>${req.whereToSecure}</td>
		                    </tr>
		                `).join('') : `
		                    <tr>
		                        <td style="text-align: center; font-style: italic;">None</td>
		                        <td style="text-align: center; font-style: italic;">N/A</td>
		                    </tr>
		                `}
		            </tbody>
		        </table>

		        <table class="process-table">
		            <colgroup>
		                <col style="width: 27.5%;">
		                <col style="width: 26.5%;">
		                <col style="width: 11.5%;">
		                <col style="width: 15.5%;">
		                <col style="width: 19%;">
		            </colgroup>
		            <tbody>
		                <tr>
		                    <th style="width: 27.5%; text-align: center;">CLIENT STEPS</th>
		                    <th style="width: 26.5%; text-align: center;">AGENCY ACTIONS</th>
		                    <th style="width: 11.5%; text-align: center;">FEES TO BE PAID</th>
		                    <th style="width: 15.5%; text-align: center;">PROCESSING TIME</th>
		                    <th style="width: 19%; text-align: center;">PERSON RESPONSIBLE</th>
		                </tr>
		                ${processOverview && processOverview.length > 0 ? processOverview.map(proc => `
		                    <tr>
		                        <td>${proc.clientSteps}</td>
		                        <td>${proc.agencyActions}</td>
		                        <td style="text-align: center;">${proc.feesToBePaid}</td>
		                        <td style="text-align: center;">${proc.processingTime}</td>
		                        <td>${proc.personResponsible}</td>
		                    </tr>
		                `).join('') : `
		                    <tr>
		                        <td style="text-align: center; font-style: italic;">None</td>
		                        <td style="text-align: center; font-style: italic;">None</td>
		                        <td style="text-align: center; font-style: italic;">None</td>
		                        <td style="text-align: center; font-style: italic;">N/A</td>
		                        <td style="text-align: center; font-style: italic;">N/A</td>
		                    </tr>
		                `}
		                <tr>
		                    <th></th>
		                    <th style="text-align:right;">TOTAL</th>
		                    <th style="text-align:center;">${hasVisibleEditorContent(FeesToBePaid) ? FeesToBePaid : 'NONE'}</th>
		                    <th style="text-align:center;">${hasVisibleEditorContent(ProcessingTime) ? ProcessingTime : 'N/A'}</th>
		                    <th></th>
		                </tr>
		            </tbody>
		        </table>
		    `;
		}

		function openPreview() {
		    const currentData = collectCurrentFormData();
		    if (!currentData || !window.validateCitizenCharterForAction(currentData, 'preview')) return;
		    const data = getCitizenCharterData();
		    displayPreview(data);
		}

		function downloadDirectPDF() {
		    openPreview();
		}

		function displayPreview(data) {
		    const {
		        serviceName,
		        description,
		        office,
		        classification,
		        transactionTypes,
		        whoMayAvail,
		        requirements,
		        processOverview,
		        FeesToBePaid,
		        ProcessingTime
		    } = data;

		    let previewWindow = window.open('', '', 'width=950px,height=1056px');
		    if (!previewWindow) {
		        alert("Please allow popups for this site to view the preview.");
		        return;
		    }

		    const reportHtml = generateReportHtml(data);

		    previewWindow.document.write(`
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${serviceName || "Citizen Charter"} - Print / Save as PDF</title>
            <link rel="stylesheet" href="assets/font-awesome/css/font-awesome.css">
            <style>
    @page {
        size: A4 portrait;
        margin: 1.5in 0.5in 1in 1in;
    }

    *, *:before, *:after {
        box-sizing: border-box;
    }

    body {
        font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
        line-height: 1.45;
        margin: 0;
        padding: 24px;
        font-size: 14px;
        color: #000;
        background: #fff;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
    }

    /* Action Banner Card */
    .preview-instruction-card {
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 16px 20px;
        margin-bottom: 24px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }

    .preview-instruction-header {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
        margin-bottom: 8px;
        padding-bottom: 8px;
        border-bottom: 1px solid #e2e8f0;
    }

    .preview-instruction-desc {
        font-size: 13.5px;
        line-height: 1.5;
        color: #334155;
        margin: 0 0 14px 0;
    }

    .preview-buttons-bar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
    }

    .btn-pdf-print {
        background: #2563eb;
        color: #ffffff;
        border: none;
        padding: 9px 18px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);
        transition: background 0.15s ease;
    }
    .btn-pdf-print:hover {
        background: #1d4ed8;
    }

    .btn-pdf-close {
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
        padding: 9px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
    }
    .btn-pdf-close:hover {
        background: #e2e8f0;
    }

    /* Report Content Styles */
    .main-header {
        margin-bottom: 10px;
    }

    .service-name {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 6px;
        display: block;
        color: #000;
        letter-spacing: 0.2px;
    }

    .service-description {
        font-size: 14px;
        line-height: 1.5;
        display: block;
        color: #000;
        margin-bottom: 10px;
    }

    .service-description p,
    td p, th p {
        margin: 0 0 4px 0;
    }
    .service-description p:last-child,
    td p:last-child, th p:last-child {
        margin-bottom: 0;
    }

    td ul, td ol, th ul, th ol {
        text-align: left;
        margin: 2px 0;
        padding-left: 18px;
    }

    table {
        width: 100%;
        table-layout: fixed;
        border-collapse: collapse;
        margin: 0;
        word-wrap: break-word;
        page-break-inside: auto;
        break-inside: auto;
        font-size: 14px;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
    }

    .requirements-table,
    .process-table {
        margin-top: -1.5px;
    }

    th, td {
        border: 1.5px solid #000;
        padding: 7px 6px;
        text-align: left;
        vertical-align: top;
        word-break: break-word;
        font-size: 14px;
        line-height: 1.45;
        color: #000;
    }

    th {
        background-color: #8eaadb !important;
        font-weight: bold;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }

    .requirements-table th,
    .process-table th {
        vertical-align: middle;
        font-size: 13px;
    }

    thead {
        display: table-row-group !important;
    }

    tfoot {
        display: table-row-group !important;
    }

    tbody {
        break-inside: auto;
        page-break-inside: auto;
    }

    tr {
        page-break-inside: avoid;
        break-inside: avoid;
    }

    @media print {
        body {
            margin: 0;
            padding: 0;
            font-size: 14px;
            color: #000;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .preview-instruction-card {
            display: none !important;
        }

        table {
            table-layout: fixed;
            border-collapse: collapse;
            page-break-inside: auto;
            break-inside: auto;
            margin: 0;
            font-size: 14px;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .requirements-table,
        .process-table {
            margin-top: -1.5px;
        }

        thead {
            display: table-row-group !important;
        }

        tfoot {
            display: table-row-group !important;
        }

        tbody {
            break-inside: auto;
            page-break-inside: auto;
        }

        tr {
            page-break-inside: avoid;
            break-inside: avoid;
        }

        th, td {
            border: 1.5px solid #000 !important;
            font-size: 14px !important;
            padding: 7px 6px !important;
            color: #000 !important;
        }

        th {
            background-color: #8eaadb !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        .requirements-table th,
        .process-table th {
            vertical-align: middle !important;
            font-size: 13px !important;
        }

        .service-name {
            font-size: 20px !important;
            color: #000 !important;
        }

        .service-description {
            font-size: 14px !important;
            color: #000 !important;
        }
    }

    @media screen and (max-width: 768px) {
        body {
            font-size: 14px;
        }

        .service-name {
            font-size: 18px;
        }
    }
</style>
        </head>
        <body>
            <div class="preview-instruction-card">
                <div class="preview-instruction-header">
                    <i class="fa fa-print"></i> Official Citizen's Charter Print &amp; PDF Export
                </div>
                <p class="preview-instruction-desc">
                    To save as an official, high-quality vector PDF, click <strong>"Print / Save as PDF"</strong> below. When the printer window appears, set <strong>Destination</strong> to <strong>"Save as PDF"</strong> (Paper size: A4, Margins: Default).
                </p>
                <div class="preview-buttons-bar">
                    <button type="button" class="btn-pdf-print" onclick="window.print()">
                        <i class="fa fa-print"></i> Print / Save as PDF (Ctrl+P)
                    </button>
                    <button type="button" class="btn-pdf-close" onclick="window.close()">
                        <i class="fa fa-times"></i> Close Preview
                    </button>
                </div>
            </div>

            <div id="printableReportArea">
                ${reportHtml}
            </div>
        </body>
        </html>
    `);
		    previewWindow.document.close();
		}

		let tourRunning = false;
		let activeDriverInstance = null;

		function cleanupDriverTour() {
		    tourRunning = false;
		    if (activeDriverInstance) {
		        try {
		            activeDriverInstance.destroy();
		        } catch (err) {}
		        activeDriverInstance = null;
		    }
		    document.querySelectorAll('.driver-overlay, #driver-popover-content, .driver-popover, #driver-dummy-element').forEach(el => {
		        try {
		            el.remove();
		        } catch (err) {}
		    });
		    document.body.classList.remove('driver-active', 'driver-fade', 'driver-simple');
		    document.querySelectorAll('.driver-active-element, .driver-no-interaction').forEach(el => {
		        el.classList.remove('driver-active-element', 'driver-no-interaction');
		        el.removeAttribute('aria-haspopup');
		        el.removeAttribute('aria-expanded');
		        el.removeAttribute('aria-controls');
		    });
		}

		function startSystemTour() {
		    // Prevent tour from overlapping while Data Privacy modal is visible
		    const modalEl = document.getElementById('privacyNoticeModal');
		    if (modalEl && (modalEl.classList.contains('show') || modalEl.style.display === 'block')) {
		        console.warn('Privacy modal is currently open. Tour will start after privacy notice is acknowledged.');
		        return;
		    }

		    if (typeof window.driver === 'undefined' || !window.driver.js || !window.driver.js.driver) {
		        console.warn('Driver.js is initializing, retrying tour in 150ms...');
		        setTimeout(startSystemTour, 150);
		        return;
		    }

		    const driverFn = window.driver.js.driver;

		    const driverObj = driverFn({
		        showProgress: true,
		        animate: true,
		        allowClose: true,
		        overlayColor: 'rgba(15, 23, 42, 0.70)',
		        nextBtnText: 'Next →',
		        prevBtnText: '← Back',
		        doneBtnText: 'Finish Tour ✓',
		        progressText: 'Step {{current}} of {{total}}',
		        onCloseClick: () => {
		            cleanupDriverTour();
		        },
		        onDestroyed: () => {
		            cleanupDriverTour();
		        },
		        steps: [
		            {
		                element: '.page-top-header',
		                popover: {
		                    title: 'Citizen Charter Builder — Guided Tour',
		                    description: 'This guide explains the main fields and controls for preparing a Citizen\'s Charter. Follow the steps to complete the form, review the entries, and preview the printable report.',
		                    side: 'bottom',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#serviceNameInput',
		                popover: {
		                    title: 'Service Name',
		                    description: '<strong>ARTA Standard:</strong> Must state the official title that describes the <em>totality of the service</em> (e.g., <code>ISSUANCE OF MEDICAL CERTIFICATE AND CLINICAL ABSTRACT</code>).<br><br>• <strong>Totality:</strong> Must encompass the full transaction from initial application to final release.<br>• <strong>Inter-Office / Common Services:</strong> If shared across multiple bureaus/offices, specify the issuing unit.<br>• <em>System Tip:</em> This also serves as the default filename when you save.',
		                    side: 'bottom',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#description-tour-target',
		                popover: {
		                    title: 'Description',
		                    description: '<strong>ARTA Standard:</strong> Provide a concise statement informing citizens of the exact purpose of the service, statutory legal basis/mandate, and applicable qualification criteria.<br><br>• Keep language simple, clear, and citizen-friendly.<br>• Rich formatting (bullet points, bold highlights) can be used to organize multi-part scopes.',
		                    side: 'bottom',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#mainDetailsTable tbody tr:nth-child(1)',
		                popover: {
		                    title: 'Office or Division',
		                    description: '<strong>ARTA Standard:</strong> State the complete official name of the office, division, or unit offering the service.<br><br>• <strong>Multi-Office / Inter-Agency:</strong> If the service workflow crosses departments or external agencies, explicitly list all participating offices in the sequence of transaction.',
		                    side: 'top',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#mainDetailsTable tbody tr:nth-child(2)',
		                popover: {
		                    title: 'Classification',
		                    description: '<strong>ARTA Standard (RA 11032 Sec. 9):</strong> The classification strictly dictates the maximum allowable processing time:<br><br>• 🟢 <strong>Simple:</strong> Max <strong>3 working days</strong> (ministerial actions only).<br>• 🟡 <strong>Complex:</strong> Max <strong>7 working days</strong> (requires resolution of complicated issues / technical evaluation).<br>• 🔴 <strong>Highly Technical:</strong> Max <strong>20 working days</strong> (requires specialized technical evaluation).<br><br>⚠️ <em>What NOT to do:</em> Total Processing Time cannot exceed the selected category limit, and ranging (e.g. <em>"Simple to Complex"</em>) is strictly prohibited!',
		                    side: 'top',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#mainDetailsTable tbody tr:nth-child(3)',
		                popover: {
		                    title: 'Type of Transaction',
		                    description: '<strong>ARTA Standard:</strong> Classify based on the client category:<br><br>• <strong>G2C (Government to Citizen):</strong> For transactions with individual citizens or the general public.<br>• <strong>G2B (Government to Business):</strong> For transactions involving commercial firms or businesses.<br>• <strong>G2G (Government to Government):</strong> For transactions between government agencies or internal personnel.<br><br>⚠️ <em>Consistency Rule:</em> The selected type must strictly match the clients listed in <em>Who May Avail</em>.',
		                    side: 'top',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#mainDetailsTable tbody tr:nth-child(4)',
		                popover: {
		                    title: 'Who May Avail',
		                    description: '<strong>ARTA Standard:</strong><br><br>• If anyone is eligible without restriction, enter <strong>"All"</strong>.<br>• If restricted to specific groups or beneficiaries, enumerate all authorized clients (e.g., <em>Discharged inpatients, registered suppliers, active civil servants</em>).<br><br>⚠️ <em>Rule:</em> Spell out acronyms and avoid obscure abbreviations so the public clearly understands eligibility.',
		                    side: 'top',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#requirementsTable',
		                popover: {
		                    title: 'Checklist of Requirements',
		                    description: '<strong>ARTA Prescribed Manner of Writing:</strong><br><code>Name of Document (# of copies, original/photocopy)</code><br><em>Example:</em> <code>Duly Accomplished Request Form (1 original copy)</code><br><br>• <strong>Single Copies:</strong> Explicitly state <em>"one (1)"</em> and specify whether <em>original</em> or <em>photocopy</em>.<br>• <strong>Where to Secure:</strong> Name the specific issuing office, desk, or portal (e.g. <em>PSA Serbilis Center / HIMD Receiving Desk</em>).<br>• If none needed: write <strong>"None"</strong> (never leave blank).<br><br>⚠️ <em>CRITICAL:</em> Any requirement demanded from a citizen that is not listed here is an illegal additional requirement under RA 11032!',
		                    side: 'top',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#processOverviewTable',
		                popover: {
		                    title: 'Client Steps and Agency Actions',
		                    description: '<strong>ARTA Step-by-Step Flow Rules:</strong><br><br>• <strong>Client Steps:</strong> State what the citizen does and where (e.g., <em>"1. Submit requirements to Receiving Section"</em>). First step must be submission; last step must be claiming result.<br>• <strong>Agency Actions:</strong> Specific action taken by agency staff (e.g., <em>"1.1 Review document completeness"</em>). Use sub-numbering (1.1, 1.2, 1.3) for multiple agency actions per client step. <strong>Leave Client Steps blank on continuation rows</strong> when Agency Actions follow the same numbered sequence; enter a new Client Step only when the client action changes.<br>• <strong>Zero Contact Policy:</strong> Minimize face-to-face interactions strictly to essential ministerial transactions.<br><br>⚠️ <em>Rule:</em> Demanding unlisted steps from clients is strictly prohibited!',
		                    side: 'top',
		                    align: 'start'
		                }
		            },
		            {
		                element: '#processOverviewTable tfoot',
		                popover: {
		                    title: 'Fees, Processing Time and Responsible Person',
		                    description: '<strong>ARTA Specification Rules:</strong><br><br>• <strong>Fees:</strong> Type + Currency + Amount (e.g., <code>Certification Fee: PHP 50.00</code>) or <code>None</code>. ⚠️ <em>Ranging (e.g. PHP 50-100) is illegal!</em><br>• <strong>Processing Time:</strong> Exact duration in Days, Hours, Minutes (1 day = 8 working hours). ⚠️ <em>Ranging (e.g. "1-2 hours") is prohibited!</em><br>• <strong>Person Responsible:</strong> Write the <strong>official plantilla position title(s) and responsible office</strong> (e.g., <code>Nurse Attendant II</code>, <code>Administrative Aide IV</code>, followed by <code>IMISS Office</code>). Multiple position titles may appear on separate lines. If personnel rotates, use the <em>Immediate Supervisor\'s Designation and Office</em>. ⚠️ <em>Do NOT use personal employee names!</em>',
		                    side: 'top',
		                    align: 'start'
		                }
		            },
		            {
		                element: '.actions-panel',
		                popover: {
		                    title: 'Readiness Check, Preview and Save',
		                    description: '• <strong>Check Readiness:</strong> Locates each missing or nonstandard entry, highlights the exact field, and lets you go directly to that field to correct it.<br>• <strong>Preview / Save as PDF:</strong> Opens the official printable report preview. Select <em>"Save as PDF"</em> in your printer dialog for crisp vector output or print directly to paper.<br>• <strong>Save:</strong> Exports a standard <code>.json</code> data backup for recordkeeping and mandatory annual updates (required by March 31 annually).<br>• <strong>Open:</strong> Loads an existing <code>.json</code> file to modify or review.<br>• <strong>Clear Form:</strong> Resets fields to draft a new charter.',
		                    side: 'top',
		                    align: 'center'
		                }
		            },
		            {
		                element: '#startTourNavBtn',
		                popover: {
		                    title: 'Tour Complete',
		                    description: 'You can reopen this guide anytime using <strong>Take a Tour</strong>. Review your entries and preview the output before saving or printing.',
		                    side: 'bottom',
		                    align: 'end',
		                    doneBtnText: 'Finish Tour ✓',
		                    onNextClick: () => {
		                        cleanupDriverTour();
		                    }
		                }
		            }
		        ]
		    });

		    tourRunning = true;
		    tourLaunchedOnVisit = true;
		    activeDriverInstance = driverObj;
		    driverObj.drive();
		}

		// Direct event delegation fallback to guarantee tour closes when clicking close button (×) or finish button
		document.addEventListener('click', (e) => {
		    // 1. Close button (×)
		    const closeBtn = e.target && (e.target.matches('.driver-popover-close-btn') || e.target.closest('.driver-popover-close-btn'));
		    if (closeBtn) {
		        e.preventDefault();
		        e.stopPropagation();
		        cleanupDriverTour();
		        return;
		    }

		    // 2. Finish Tour button on final step
		    const nextBtn = e.target && (e.target.matches('.driver-popover-next-btn') || e.target.closest('.driver-popover-next-btn'));
		    if (nextBtn) {
		        const btnText = (nextBtn.textContent || '').trim();
		        const isLast = (activeDriverInstance && typeof activeDriverInstance.isLastStep === 'function' && activeDriverInstance.isLastStep()) ||
		                       btnText.includes('Finish') ||
		                       btnText.includes('Done');
		        if (isLast) {
		            e.preventDefault();
		            e.stopPropagation();
		            cleanupDriverTour();
		            return;
		        }
		    }
		}, true);

		// Automatically activate tour on visiting or refreshing the page only if privacy notice is not active
		    (function setupAutoTourActivation() {
		        function triggerTourOnVisit() {
		            if (tourLaunchedOnVisit || tourRunning) return;

		            const modalEl = document.getElementById('privacyNoticeModal');
		            const isModalShowing = modalEl && (modalEl.classList.contains('show') || modalEl.style.display === 'block');

		            // If privacy modal has not been acknowledged yet or is currently visible, defer to privacy modal acknowledgment
		            let acknowledged = false;
		            try {
		                acknowledged = (localStorage.getItem('cc_privacy_acknowledged') === 'true');
		            } catch (e) {}

		            if (!acknowledged || isModalShowing) {
		                return;
		            }

		            startSystemTour();
		        }

		        // Check immediate state
		        if (document.readyState === 'complete') {
		            setTimeout(triggerTourOnVisit, 500);
		        } else {
		            window.addEventListener('load', () => setTimeout(triggerTourOnVisit, 500));
		            document.addEventListener('DOMContentLoaded', () => setTimeout(triggerTourOnVisit, 700));
		        }

		        // Universal fallback for returning visits where privacy is already acknowledged
		        setTimeout(triggerTourOnVisit, 1000);
		    })();

		/* Creator Attribution & Anti-Tamper Protection */
		(function initCreatorAttributionProtection() {
		    const REQUIRED_HANDLE = 'crmry';
		    const REQUIRED_PROFILE = 'https://github.com/crmry';
		    const INNER_CONTENT = '<span>&copy; 2026 <strong>Citizen Charter Builder</strong> &bull; Created by <a href="' + REQUIRED_PROFILE + '" target="_blank" rel="noopener noreferrer" class="creator-link">' + REQUIRED_HANDLE + '</a></span>';

		    function enforceAttribution() {
		        let footer = document.getElementById('appCreatorFooter');
		        const targetParent = document.querySelector('.container-fluid') || document.querySelector('#page-wrapper') || document.body;

		        if (!footer) {
		            footer = document.createElement('footer');
		            footer.id = 'appCreatorFooter';
		            footer.className = 'app-creator-footer';
		            footer.setAttribute('data-creator', REQUIRED_HANDLE);
		            footer.setAttribute('data-protected', 'true');
		            footer.innerHTML = '<div class="creator-footer-content">' + INNER_CONTENT + '</div>';
		            if (targetParent) {
		                targetParent.appendChild(footer);
		            }
		            return;
		        }

		        // Validate content integrity
		        const text = footer.textContent || '';
		        const link = footer.querySelector('a');
		        const hasValidText = text.includes('Citizen Charter Builder') && text.includes(REQUIRED_HANDLE);
		        const hasValidLink = link && link.getAttribute('href') === REQUIRED_PROFILE;

		        if (!hasValidText || !hasValidLink) {
		            footer.innerHTML = '<div class="creator-footer-content">' + INNER_CONTENT + '</div>';
		        }

		        // Enforce visibility
		        if (footer.style.display === 'none' || footer.style.visibility === 'hidden' || footer.style.opacity === '0') {
		            footer.style.display = 'block';
		            footer.style.visibility = 'visible';
		            footer.style.opacity = '1';
		        }
		    }

		    if (document.readyState === 'loading') {
		        document.addEventListener('DOMContentLoaded', enforceAttribution);
		    } else {
		        enforceAttribution();
		    }

		    // Mutation observer to detect and reverse tampering/removal
		    try {
		        const observer = new MutationObserver(() => {
		            enforceAttribution();
		        });
		        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
		    } catch (e) {
		        console.warn('Attribution observer fallback active');
		    }

		    // Periodic verification interval
		    setInterval(enforceAttribution, 4000);
		})();


