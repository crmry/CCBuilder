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
assert(validate(skippedSubaction).some(issue=>issue.label.includes('Step 2: Client Steps')),
  'Skipped sub-action number must not silently authorize a blank Client Step');

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
