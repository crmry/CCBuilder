// Run with: node tests/readiness-validation.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const src = fs.readFileSync('assets/validation.js', 'utf8');
const positionSrc = fs.readFileSync('assets/plantilla-positions.js', 'utf8');
const sandbox = {
  window: {},
  document: { createElement() { throw new Error('TEST_SETUP_DONE'); } }
};
vm.runInNewContext(positionSrc, sandbox, {filename:'assets/plantilla-positions.js'});
try {
  vm.runInNewContext(src, sandbox, {filename:'assets/validation.js'});
  throw new Error('Validation script should reach DOM setup.');
} catch (error) {
  if (error.message !== 'TEST_SETUP_DONE') throw error;
}
const validate = sandbox.window.validateCharterData;
assert.equal(typeof validate, 'function');

const example = {
  serviceName: 'Issuance of Clearance',
  description: '<p>Service description</p>',
  office: 'Records Section',
  classification: 'Simple',
  transaction_type: ['Government to Citizen (G2C)'],
  who_may_avail: 'All',
  requirements: [{checklist:'Valid ID (1 photocopy)', where:'Receiving Section'}],
  processOverview: [{
    clientSteps: '1. Submit request',
    agencyActions: '1.1 Review submission',
    feesToBePaid: 'None',
    processingTime: '15 minutes',
    personResponsible: 'Administrative Officer V, Receiving Section'
  }],
  feesToBePaid: 'None',
  processingTime: '15 minutes'
};
const copy = () => JSON.parse(JSON.stringify(example));
assert.equal(validate(example).length, 0, 'Complete free service should pass');
const paid = copy();
paid.processOverview[0].feesToBePaid = 'Certification Fee: PHP 50.00';
paid.feesToBePaid = 'PHP 50.00';
assert.equal(validate(paid).length, 0, 'Complete paid service should pass');

function expectError(transform, label) {
  const data = copy();
  transform(data);
  const issues = validate(data);
  assert(issues.some(issue => issue.label.includes(label)), 'Expected '+label+': '+JSON.stringify(issues));
}
expectError(d => { d.processOverview[0].feesToBePaid = ''; }, 'Fees');
expectError(d => { d.feesToBePaid = ''; }, 'Total Fees');
expectError(d => { d.processOverview[0].personResponsible = 'Juan Dela Cruz'; }, 'Person Responsible');
expectError(d => { d.processOverview[0].personResponsible = 'Administrative Officer V'; }, 'Person Responsible');
expectError(d => { d.requirements[0].checklist = 'Valid ID'; }, 'Copy details');
expectError(d => { d.processOverview[0].processingTime = '1 to 2 hours'; }, 'Processing Time');
expectError(d => { d.processOverview[0].feesToBePaid = 'Fee: PHP 10.00'; }, 'Total Fees');
expectError(d => { d.classification = ''; }, 'Classification');
expectError(d => { d.transaction_type = []; }, 'Type of Transaction');
assert(validate({other: 'not a charter'}).length > 0, 'Unrelated JSON must be rejected');
assert(validate(null).length > 0, 'Null imports must be rejected');
const noReq = copy();
noReq.requirements = [{checklist:'None',where:'None'}];
assert.equal(validate(noReq).length, 0, 'Explicitly no requirements should pass');

console.log('Citizen Charter readiness validation: 14 checks passed.');

// The correction navigator must point at exact columns, not a whole process row.
const wrongPosition = copy();
wrongPosition.processOverview[0].personResponsible = 'Juan Dela Cruz';
const positionIssue = validate(wrongPosition).find(issue => issue.label.includes('Person Responsible'));
assert.equal(positionIssue.target, '#processOverviewTableBody tr:nth-child(1) td:nth-child(5)');

const wrongFee = copy();
wrongFee.processOverview[0].feesToBePaid = '';
const feeIssue = validate(wrongFee).find(issue => issue.label.includes('Step 1: Fees'));
assert.equal(feeIssue.target, '#processOverviewTableBody tr:nth-child(1) td:nth-child(3)');

const wrongTime = copy();
wrongTime.processOverview[0].processingTime = '';
const timeIssue = validate(wrongTime).find(issue => issue.label.includes('Step 1: Processing Time'));
assert.equal(timeIssue.target, '#processOverviewTableBody tr:nth-child(1) td:nth-child(4)');

const missingWhere = copy();
missingWhere.requirements[0].where = '';
const whereIssue = validate(missingWhere).find(issue => issue.label.includes('Where to Secure'));
assert.equal(whereIssue.target, '#requirementsTableBody tr:nth-child(1) td:nth-child(2)');

const missingDocument = copy();
missingDocument.requirements[0].checklist = '';
const requirementIssue = validate(missingDocument).find(issue => issue.label.includes('Row 1: Requirement'));
assert.equal(requirementIssue.target, '#requirementsTableBody tr:nth-child(1) td:nth-child(1)');

const stepTwo = copy();
stepTwo.processOverview.push({...stepTwo.processOverview[0], personResponsible: ''});
const stepTwoIssue = validate(stepTwo).find(issue => issue.label.includes('Step 2: Person Responsible'));
assert.equal(stepTwoIssue.target, '#processOverviewTableBody tr:nth-child(2) td:nth-child(5)');

const missingDescription = copy();
missingDescription.description = '';
const descriptionIssue = validate(missingDescription).find(issue => issue.label === 'Description');
assert.equal(descriptionIssue.target, '#description-tour-target');

// No exact field may be inferred from a different row's index.
const multipleErrors = copy();
multipleErrors.processOverview[0].feesToBePaid = '';
multipleErrors.processOverview[0].personResponsible = '';
assert(validate(multipleErrors).some(issue => issue.target.endsWith('td:nth-child(3)')));
assert(validate(multipleErrors).some(issue => issue.target.endsWith('td:nth-child(5)')));

console.log('Precise readiness field navigation: 8 checks passed.');



// A single Client Step can have multiple consecutive Agency Actions.
// Rows with 1.2, 1.3, 1.4 do not require duplicating Client Steps.
const continued=copy();
continued.processOverview[0].clientSteps='<p>1. Submit request to Receiving Section</p>';
continued.processOverview[0].agencyActions='<p>1.1 Receive and assess request</p>';
continued.processOverview[0].personResponsible='<p>Nursing Attendant II</p><p>Administrative Aide IV</p><p>IMISS Office</p>';
continued.processOverview.push({
  clientSteps:'<p></p>',agencyActions:'<p>1.2 Assess and classify request</p>',
  feesToBePaid:'None',processingTime:'10 minutes',
  personResponsible:'<p>Nursing Attendant II</p><p>Administrative Aide IV</p><p>IMISS Office</p>'
}, {
  clientSteps:'',agencyActions:'<p>1.3 Evaluate request</p>',
  feesToBePaid:'None',processingTime:'10 minutes',
  personResponsible:'<p>Supervising Health Program Officer</p><p>IMISS Office</p>'
}, {
  clientSteps:'',agencyActions:'<p>1.4 Troubleshooting and corrective actions</p>',
  feesToBePaid:'None',processingTime:'10 minutes',
  personResponsible:'<p>Nursing Attendant II</p><p>Ward Assistant</p><p>Computer Maintenance Technologist III</p><p>IMISS Office</p>'
});
assert.equal(validate(continued).length,0,'Multiline plantilla titles and Agency Action 1.1–1.4 continuation must pass');

const newlinePositions=copy();
newlinePositions.processOverview[0].personResponsible='Nursing Attendant II\nAdministrative Aide IV\nIMISS Office';
assert.equal(validate(newlinePositions).length,0,'Newline-separated roles sharing an office must pass');

const singlePosition=copy();
singlePosition.processOverview[0].personResponsible='<p>Supervising Health Program Officer</p><p>IMISS Office</p>';
assert.equal(validate(singlePosition).length,0,'Single plantilla title with an office on the next line must pass');

const missingOffice=copy();
missingOffice.processOverview[0].personResponsible='<p>Nursing Attendant II</p><p>Administrative Aide IV</p>';
assert(validate(missingOffice).some(issue=>issue.label.includes('Person Responsible')),
  'Missing office should still fail');

const personalNameWithOffice=copy();
personalNameWithOffice.processOverview[0].personResponsible='<p>Juan Dela Cruz</p><p>IMISS Office</p>';
assert(validate(personalNameWithOffice).some(issue=>issue.label.includes('Person Responsible')),
  'Personal name + office should still fail');

const missingInitialStep=copy();
missingInitialStep.processOverview[0].clientSteps='';
assert(validate(missingInitialStep).some(issue=>issue.label.includes('Client Steps')),
  'The first row must have a Client Step');

const skippedSubaction=JSON.parse(JSON.stringify(continued));
skippedSubaction.processOverview[1].agencyActions='<p>1.3 Assess and classify request</p>';
assert(validate(skippedSubaction).some(issue=>issue.label.includes('Step 2: Agency Actions')),
  'Skipped numbering belongs to Agency Actions, not intentionally blank Client Steps');
assert(!validate(skippedSubaction).some(issue=>issue.label.includes('Step 2: Client Steps')),
  'A skipped sub-action must not create a misleading Client Steps warning');

const mismatchedSubaction=JSON.parse(JSON.stringify(continued));
mismatchedSubaction.processOverview[1].agencyActions='<p>2.1 Assess and classify request</p>';
assert(validate(mismatchedSubaction).some(issue=>issue.label.includes('Step 2: Client Steps')),
  'A different major Agency Action must not silently authorize a blank Client Step');

const unnumberedSubaction=JSON.parse(JSON.stringify(continued));
unnumberedSubaction.processOverview[1].agencyActions='<p>Assess and classify request</p>';
assert(validate(unnumberedSubaction).some(issue=>issue.label.includes('Step 2: Client Steps')),
  'A blank Client Step with an unnumbered Agency Action should fail');

const secondClientGroup=JSON.parse(JSON.stringify(continued));
secondClientGroup.processOverview[2].clientSteps='<p>2. Claim processed documents</p>';
secondClientGroup.processOverview[2].agencyActions='<p>2.1 Release approved form</p>';
secondClientGroup.processOverview[3].agencyActions='<p>2.2 Provide receipt</p>';
assert.equal(validate(secondClientGroup).length,0,'A new numbered Client Step should begin a new Agency Action group');

const multiActionInOneRow=JSON.parse(JSON.stringify(continued));
multiActionInOneRow.processOverview[0].agencyActions='<p>1.1 Receive request</p><p>1.2 Review request</p>';
multiActionInOneRow.processOverview[1].agencyActions='<p>1.3 Assess request</p>';
multiActionInOneRow.processOverview[2].agencyActions='<p>1.4 Evaluate request</p>';
multiActionInOneRow.processOverview[3].agencyActions='<p>1.5 Complete request</p>';
assert.equal(validate(multiActionInOneRow).length,0,
  'The last sub-action within a rich-text cell should set the continuation number');

console.log('Continuation and plantilla regression: 11 scenarios passed.');


// The complete source-provided position catalogue is used for validation.
assert.equal(sandbox.window.CCPlantillaPositions.titles.length,130,'All 130 supplied titles must be present');
assert.equal(sandbox.window.CCPlantillaPositions.match(' nursing attendant II '),'Nursing Attendant II');
assert.equal(sandbox.window.CCPlantillaPositions.match('Nurse Attendant II'),null);
assert.equal(sandbox.window.CCPlantillaPositions.match('Seamtress'),'Seamtress','Do not silently edit provided source text');

const officialPositionList=copy();
officialPositionList.processOverview[0].personResponsible=
  '<p>Nursing Attendant II</p><p>Administrative Aide IV</p><p>Information Systems Analyst III</p><p>IMISS Office</p>';
assert.equal(validate(officialPositionList).length,0,'Multiple listed plantilla titles with one office must pass');

const suppliedTypo=copy();
suppliedTypo.processOverview[0].personResponsible='<p>Nurse Attendant II</p><p>IMISS Office</p>';
const suggestedTypo=validate(suppliedTypo).find(x=>x.label.includes('Person Responsible'));
assert(suggestedTypo && suggestedTypo.message.includes('Nursing Attendant II'),
  'Mismatch must suggest the exact title from the supplied list');

const analystTypo=copy();
analystTypo.processOverview[0].personResponsible=
  '<p>Information System Analyst III</p><p>IMISS Office</p>';
assert(validate(analystTypo).some(x=>x.message.includes('Information Systems Analyst III')),
  'Near-match should suggest listed Information Systems Analyst III');

const otherOfficial=copy();
otherOfficial.processOverview[0].personResponsible='<p>Ward Assistant</p><p>IMISS Office</p>';
assert.equal(validate(otherOfficial).length,0,'Ward Assistant is a plantilla title, not an office name');

const knownChief=copy();
knownChief.processOverview[0].personResponsible='<p>Medical Center Chief II</p><p>Medical Center Office</p>';
assert.equal(validate(knownChief).length,0,'Exact position with Center should pass when followed by office');

const noOfficeChief=copy();
noOfficeChief.processOverview[0].personResponsible='Medical Center Chief II';
assert(validate(noOfficeChief).some(x=>x.label.includes('Person Responsible')),
  'Known titles that include Center still require an office');

const wrongGrade=copy();
wrongGrade.processOverview[0].personResponsible='<p>Administrative Aide II</p><p>IMISS Office</p>';
assert(validate(wrongGrade).some(x=>x.label.includes('Person Responsible')),
  'Grade absent from supplied positions must be rejected');
assert.equal(sandbox.window.CCPlantillaPositions.closest('Administrative Aide II'),null,
  'Do not suggest a different position family or grade for a missing title');

const unknownWithOffice=copy();
unknownWithOffice.processOverview[0].personResponsible='<p>Juan Dela Cruz</p><p>IMISS Office</p>';
assert(validate(unknownWithOffice).some(x=>x.label.includes('Person Responsible')),
  'A personal name must not pass by having a valid office');

const flattened=copy();
flattened.processOverview[0].personResponsible='Nursing Attendant II IMISS Office';
assert.equal(validate(flattened).length,0,'Flattened title and office should remain usable');

const flattenedTypo=copy();
flattenedTypo.processOverview[0].personResponsible='Nurse Attendant II IMISS Office';
assert(validate(flattenedTypo).some(x=>x.message.includes('Nursing Attendant II')),
  'Flattened typo must still produce a correction suggestion');

const officeOnly=copy();
officeOnly.processOverview[0].personResponsible='<p>IMISS Office</p>';
assert(validate(officeOnly).some(x=>x.label.includes('Person Responsible')),
  'Office-only fields must not pass');

console.log('Plantilla position reference: 12 cases passed.');


// Standard forms / online forms do not require physical-copy counts unless
// the requirement explicitly calls for printed copies.
const screenshotRequirements=copy();
screenshotRequirements.requirements=[
  {checklist:'<p>1. Job Order Request Form</p>',where:'<p>IMISS Job Order Request Form from forms.clmmrh.org</p>'},
  {checklist:'<p>2. For Deployment of ICT Equipment – Requisition and Issuance Slip</p>',where:'<p>Materials Management Section</p>'}
];
assert.equal(validate(screenshotRequirements).length,0,
  'Named online form and office-issued standard slip should pass without copies');

const onlineRequest=copy();
onlineRequest.requirements=[{checklist:'Online request for technical assistance',where:'IMISS Office — Online Portal'}];
assert.equal(validate(onlineRequest).length,0,
  'Explicitly online requests with an identified portal do not need physical copies');

const genericForm=copy();
genericForm.requirements=[{checklist:'Job Order Request Form',where:'IMISS Receiving Desk'}];
assert.equal(validate(genericForm).length,0,'Named standard forms obtained at an office do not need copy counts');

const genericSlip=copy();
genericSlip.requirements=[{checklist:'Requisition and Issuance Slip',where:'Materials Management Section'}];
assert.equal(validate(genericSlip).length,0,'Office-issued standard slips do not need copy counts');

const missingFormSource=copy();
missingFormSource.requirements=[{checklist:'Job Order Request Form',where:''}];
assert(validate(missingFormSource).some(issue=>issue.label.includes('Where to Secure')),
  'An otherwise valid standard form still needs a source');

const physicalId=copy();
physicalId.requirements=[{checklist:'Valid Government-Issued ID',where:'Client'}];
assert(validate(physicalId).some(issue=>issue.label.includes('Copy details')),
  'A paper identification document still requires copy details');

const physicalIdComplete=copy();
physicalIdComplete.requirements=[{checklist:'Valid ID (1 photocopy)',where:'Client'}];
assert.equal(validate(physicalIdComplete).length,0,'Properly specified copies still pass');

const printedForm=copy();
printedForm.requirements=[{checklist:'Printed Application Form',where:'Receiving Section'}];
assert(validate(printedForm).some(issue=>issue.label.includes('Copy details')),
  'Explicitly printed forms should still have copy details');

const paperCopyOfForm=copy();
paperCopyOfForm.requirements=[{checklist:'Copy of Job Order Request Form',where:'IMISS Office'}];
assert(validate(paperCopyOfForm).some(issue=>issue.label.includes('Copy details')),
  'Explicit physical copies must carry quantities even if the document is a form');

const numberedSupportingForm=copy();
numberedSupportingForm.requirements=[{checklist:'Form 137',where:'School Registrar'}];
assert(validate(numberedSupportingForm).some(issue=>issue.label.includes('Copy details')),
  'Numbered supporting documents are not assumed to be generic blank forms');

const ordinaryCertificate=copy();
ordinaryCertificate.requirements=[{checklist:'Birth Certificate',where:'PSA Office'}];
assert(validate(ordinaryCertificate).some(issue=>issue.label.includes('Copy details')),
  'Traditional documentary requirements still need copy details');

console.log('Online and standard-form copy validation: 11 cases passed.');


// Regression from actual screenshots: 1.2Assess (no space), followed by 1.3
// and 1.4, shares Client Step 1; a Client Experience Survey starts Step 2.
const screenshot=copy();
screenshot.processOverview[0].clientSteps='<p>1. Submit the Job Order Request Form to the IMISS Office</p>';
screenshot.processOverview[0].agencyActions='<p>1. Receive and acknowledge the request</p>';
screenshot.processOverview.push(
  {clientSteps:'<p>&nbsp;</p>',
   agencyActions:'<p>1.2Assess and classify request (Urgent or Non-Urgent) and endorse to IMISS Head</p>',
   feesToBePaid:'None',processingTime:'10 minutes',
   personResponsible:'<p>Administrative Aide IV</p><p>IMISS Office</p>'},
  {clientSteps:'',agencyActions:'<p>1.3 Evaluate Job Order Request for approval or disapproval</p>',
   feesToBePaid:'None',processingTime:'10 minutes',
   personResponsible:'<p>Supervising Health Program Officer</p><p>IMISS Office</p>'},
  {clientSteps:'',agencyActions:'<p>1.4 Troubleshooting and corrective actions</p><ul><li>Network outages</li></ul>',
   feesToBePaid:'None',processingTime:'15 minutes',
   personResponsible:'<p>Computer Maintenance Technologist III</p><p>IMISS Office</p>'},
  {clientSteps:'<p>2. Answer the Client Experience Survey Form</p>',
   agencyActions:'<p>2. IHOMS staff administer the Client Experience Survey.</p>',
   feesToBePaid:'None',processingTime:'10 minutes',
   personResponsible:'<p>Administrative Aide IV</p><p>IMISS Office</p>'}
);
assert.equal(validate(screenshot).length,0,
  'Screenshot sequence with glued 1.2Assess, subsequent blank rows, and Client Step 2 must pass');

const gluedNumberAfterRichText=copy();
gluedNumberAfterRichText.processOverview[0].agencyActions='<p>1.1 Review form</p>';
gluedNumberAfterRichText.processOverview.push({
  clientSteps:'',agencyActions:'<p><strong>1.2</strong>Assess completeness</p>',
  feesToBePaid:'None',processingTime:'10 minutes',personResponsible:'Administrative Officer V, Records Section'
});
assert.equal(validate(gluedNumberAfterRichText).length,0,
  'Number and text separated only by HTML formatting must be recognized as 1.2');

const sameGroupNumber=copy();
sameGroupNumber.processOverview.push({
  clientSteps:'',agencyActions:'<p>2.2 Assess request</p>',
  feesToBePaid:'None',processingTime:'10 minutes',personResponsible:'Administrative Officer V, Records Section'
});
assert(validate(sameGroupNumber).some(issue=>issue.label.includes('Step 2: Client Steps')),
  'Agency Action 2.2 must not continue Client Step 1');

const missingInitialClient=JSON.parse(JSON.stringify(screenshot));
missingInitialClient.processOverview[0].clientSteps='';
assert(validate(missingInitialClient).some(issue=>issue.label.includes('Step 1: Client Steps')),
  'Initial client step remains mandatory');

const duplicatedAction=JSON.parse(JSON.stringify(gluedNumberAfterRichText));
duplicatedAction.processOverview[1].agencyActions='1.1 Repeat assessment';
const duplicationIssues=validate(duplicatedAction);
assert(duplicationIssues.some(issue=>issue.label.includes('Step 2: Agency Actions')),
  'Repeated agency action number must be flagged under Agency Actions');
assert(!duplicationIssues.some(issue=>issue.label.includes('Step 2: Client Steps')),
  'Repeated agency action number must not incorrectly mark Client Steps');

console.log('Screenshot continuation regression: 6 cases passed.');


// Suggestive autocorrection: each mismatched role is presented independently.
// Nothing is modified until the user explicitly accepts a suggestion.
const mixedAnalysts=copy();
mixedAnalysts.processOverview[0].personResponsible=
  '<p>Nursing Attendant II</p>'+
  '<p>Ward Assistant</p>'+
  '<p>Information System Analyst III</p>'+
  '<p>Information System Analyst II</p>'+
  '<p>Information System Analyst I</p>'+
  '<p>IMISS Office</p>';
const threeFixes=validate(mixedAnalysts).filter(issue=>issue.fix?.kind==='plantilla');
assert.equal(threeFixes.length,3,'Every incorrect analyst title must have its own suggestion');
assert.deepEqual(threeFixes.map(issue=>issue.fix.to),
  ['Information Systems Analyst III','Information Systems Analyst II','Information Systems Analyst I'],
  'Suggestions must preserve the exact Roman numeral / position grade');
assert(threeFixes.every(issue=>issue.target.endsWith('td:nth-child(5)')),
  'Every suggested correction must target the Person Responsible field');

const replaceTitle=sandbox.window.ccReplaceSuggestedPlantillaTitle;
const originalRoles=mixedAnalysts.processOverview[0].personResponsible;
assert.equal(replaceTitle(originalRoles,'Information System Analyst III','Information Systems Analyst III').changed,true);
let corrected=originalRoles;
for(const issue of threeFixes) {
  const result=replaceTitle(corrected,issue.fix.from,issue.fix.to);
  assert(result.changed,'An approved suggestion should apply to the displayed position');
  corrected=result.html;
}
assert(corrected.includes('Information Systems Analyst III'));
assert(corrected.includes('Information Systems Analyst II'));
assert(corrected.includes('Information Systems Analyst I'));
assert(corrected.includes('<p>Nursing Attendant II</p>'));
assert(corrected.includes('<p>Ward Assistant</p>'));
assert(corrected.includes('<p>IMISS Office</p>'));
mixedAnalysts.processOverview[0].personResponsible=corrected;
assert.equal(validate(mixedAnalysts).length,0,'After explicit corrections, the entire cell must pass readiness');

const sameGrade=replaceTitle('<p>Information System Analyst III</p>',
  'Information System Analyst II','Information Systems Analyst II');
assert.equal(sameGrade.changed,false,'Do not replace II inside an unrelated III title');
assert.equal(sameGrade.html,'<p>Information System Analyst III</p>');

const preserveMarkup=replaceTitle(
  '<p class="note" data-value="Information System Analyst III"><strong>Information System Analyst III</strong></p>'+
  '<p>IMISS Office</p>',
  'Information System Analyst III','Information Systems Analyst III');
assert(preserveMarkup.changed,'Titles with inline bold styling should be fixable');
assert(preserveMarkup.html.includes('data-value="Information System Analyst III"'),
  'Never modify HTML attributes');
assert(preserveMarkup.html.includes('<strong>Information Systems Analyst III</strong>'),
  'Keep bold markup around corrected titles');
assert(preserveMarkup.html.includes('<p>IMISS Office</p>'),'Leave office untouched');

const unknownApproval=replaceTitle('<p>John Doe</p><p>IMISS Office</p>',
  'John Doe','Unapproved Job Title');
assert.equal(unknownApproval.changed,false,'Only titles present in the supplied catalogue may be applied');

const repeatedInvalid=replaceTitle(
  '<p>Information System Analyst III</p><p>Information System Analyst III</p><p>IMISS Office</p>',
  'Information System Analyst III','Information Systems Analyst III');
assert.equal((repeatedInvalid.html.match(/Information Systems Analyst III/g)||[]).length,1,
  'One explicit click corrects exactly one occurrence');

console.log('Suggestive plantilla autocorrection: 19 checks passed.');


// Regression: CKEditor numbered lists render "1." / "2." visually, but their
// saved HTML can contain only <ol><li> text, without literal step numbers.
// The first agency action may also be a plain "1." rather than "1.1".
const visualNumbering=copy();
visualNumbering.processOverview[0].clientSteps=
  '<ol><li>Submit Job Order Request Form to IMISS Office</li></ol>';
visualNumbering.processOverview[0].agencyActions=
  '<p>1. Receive and verify Job Order Request Form</p>';
visualNumbering.processOverview.push(
  {
    clientSteps:'<p>&nbsp;</p>',
    agencyActions:'<p>1.2Assess and classify request and endorse to IMISS Head</p>',
    feesToBePaid:'None',processingTime:'10 minutes',
    personResponsible:'<p>Nursing Attendant II</p><p>IMISS Office</p>'
  },
  {
    clientSteps:'',
    agencyActions:'<p>1.3 Evaluate Job Order Request</p>',
    feesToBePaid:'None',processingTime:'10 minutes',
    personResponsible:'<p>Supervising Health Program Officer</p><p>IMISS Office</p>'
  },
  {
    clientSteps:'<p></p>',
    agencyActions:'<p>1.4 Troubleshooting and corrective actions</p>',
    feesToBePaid:'None',processingTime:'10 minutes',
    personResponsible:'<p>Computer Maintenance Technologist III</p><p>IMISS Office</p>'
  },
  {
    clientSteps:'<ol><li>Answer the Client Experience Survey Form</li></ol>',
    agencyActions:'<p>2. IHOMS staff administer the Client Experience Survey</p>',
    feesToBePaid:'None',processingTime:'10 minutes',
    personResponsible:'<p>Nursing Attendant II</p><p>IMISS Office</p>'
  }
);
assert.equal(validate(visualNumbering).length,0,
  'Visually numbered first Client Step with plain 1. agency action must allow blank 1.2–1.4 rows');
assert(!validate(visualNumbering).some(issue=>/Step [234]: Client Steps/.test(issue.label)),
  'Do not warn that continuation rows need Client Steps when the first row uses CKEditor ordered lists');

const visualSecondGroup=JSON.parse(JSON.stringify(visualNumbering));
visualSecondGroup.processOverview.push({
  clientSteps:'',agencyActions:'<p>2.2 Record survey responses</p>',
  feesToBePaid:'None',processingTime:'10 minutes',
  personResponsible:'<p>Administrative Aide IV</p><p>IMISS Office</p>'
});
assert.equal(validate(visualSecondGroup).length,0,
  'Next visually numbered Client Step establishes group 2 for 2.2 continuation');

const wrongMajorWithVisualList=JSON.parse(JSON.stringify(visualNumbering));
wrongMajorWithVisualList.processOverview[1].agencyActions='<p>2.2 Assess the request</p>';
assert(validate(wrongMajorWithVisualList).some(issue=>issue.label.includes('Step 2: Client Steps')),
  'Do not mistakenly accept 2.2 as a continuation of visually numbered Client Step 1');

const trulyMissingStart=JSON.parse(JSON.stringify(visualNumbering));
trulyMissingStart.processOverview[0].clientSteps='';
assert(validate(trulyMissingStart).some(issue=>issue.label.includes('Step 1: Client Steps')),
  'Still require the first Client Step rather than bypassing all completeness checks');

const suggestionSanity=sandbox.window.ccReplaceSuggestedPlantillaTitle(
  '<p>Information System Analyst III</p><p>IMISS Office</p>',
  'Information System Analyst III','Information Systems Analyst III');
assert.equal(suggestionSanity.changed,true,
  'Previous plantilla suggestion feature must continue to work after regex repair');
assert(suggestionSanity.html.includes('<p>Information Systems Analyst III</p>'));
assert(suggestionSanity.html.includes('<p>IMISS Office</p>'));

console.log('CKEditor visual numbered-list continuation: 7 checks passed.');
