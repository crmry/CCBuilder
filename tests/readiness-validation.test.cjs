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
