// Run with: node tests/readiness-validation.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const src = fs.readFileSync('assets/validation.js', 'utf8');
const sandbox = {
  window: {},
  document: { createElement() { throw new Error('TEST_SETUP_DONE'); } }
};
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

