// Run: node tests/import-json-inspector.test.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('assets/import-inspector.js','utf8');
const fake={window:{},document:{createElement(){throw new Error('STOP_AT_DOM_SETUP');}}};
try {
  vm.runInNewContext(source,fake,{filename:'assets/import-inspector.js'});
  throw new Error('Expected the DOM creation stub to interrupt the script.');
} catch(error) {
  if(error.message!=='STOP_AT_DOM_SETUP')throw error;
}
const {jsonPath,displayValue,structureIssues,syntaxDetails}=fake.window.ccJsonDiagnostics;
const charter={
  serviceName:'Clearance',office:'Records',classification:'Simple',description:'Description',
  transaction_type:['Government to Citizen (G2C)'],who_may_avail:'All',
  requirements:[{checklist:'Valid ID (1 photocopy)',where:'Receiving Desk'}],
  processOverview:[
    {clientSteps:'<p>Submit forms</p>',agencyActions:'Review',feesToBePaid:'None',processingTime:'15 minutes',personResponsible:'Administrative Officer V, Records'},
    {clientSteps:'<p></p>',agencyActions:'Review',feesToBePaid:'None',processingTime:'15 minutes',personResponsible:'John Doe'}
  ],
  feesToBePaid:'None',processingTime:'30 minutes'
};
assert.deepEqual(Array.from(structureIssues(charter)),[],'Correct JSON shape should allow editing');
const clientIssue={target:'#processOverviewTableBody tr:nth-child(2) td:nth-child(1)'};
assert.equal(jsonPath(clientIssue),'processOverview[1].clientSteps');
assert.equal(displayValue(charter,jsonPath(clientIssue)),'(empty)');
const personIssue={target:'#processOverviewTableBody tr:nth-child(2) td:nth-child(5)'};
assert.equal(jsonPath(personIssue),'processOverview[1].personResponsible');
assert.equal(displayValue(charter,jsonPath(personIssue)),'John Doe');
const feeIssue={target:'#processOverviewTableBody tr:nth-child(1) td:nth-child(3)'};
assert.equal(jsonPath(feeIssue),'processOverview[0].feesToBePaid');
const whereIssue={target:'#requirementsTableBody tr:nth-child(1) td:nth-child(2)'};
assert.equal(jsonPath(whereIssue),'requirements[0].where');
assert.equal(jsonPath({target:'#FeesToBePaid'}),'feesToBePaid');
assert.equal(jsonPath({target:'#description-tour-target'}),'description');
assert.equal(displayValue({},'feesToBePaid'),'(missing)');
const invalidShape=structureIssues({requirements:[],processOverview:[null]});
assert.equal(invalidShape.length,1);
assert.equal(invalidShape[0].jsonPath,'processOverview[0]');
assert(structureIssues({notACharter:true}).length>0);
assert(structureIssues({requirements:'bad',processOverview:[]}).length>0);
assert(syntaxDetails(new SyntaxError('Unexpected token at position 7'),'abc\nxyzXYZ').includes('Line 2'));
console.log('Import diagnostics: 14 assertions passed.');
