// Run: node tests/json-open-regression.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const main = fs.readFileSync('assets/main.js','utf8');
const inspector = fs.readFileSync('assets/import-inspector.js','utf8');
const html = fs.readFileSync('main.html','utf8');
const a = main.indexOf('function normalizeCitizenCharterImport(raw) {');
const b = main.indexOf('\n\t\tfunction getCitizenCharterData() {',a);
assert(a > -1 && b > a,'Importer/normalizer must be in the Builder');
const snippet = main.slice(a,b);
const create = new Function('window','FileReader','collectCurrentFormData','hasSubstantialData',
  'applyFormData','scheduleAutoSave','requirementEditors','processOverviewEditors',
  'console','isRestoringDraft','currentOpenedFileName',
  snippet+'\nreturn {normalizeCitizenCharterImport, importFormData};');
const existingData = {
  serviceName:'Issuance of Clearance',description:'<p>Testing</p>',office:'Records',
  classification:'Simple',transaction_type:['Government to Citizen (G2C)'],who_may_avail:'All',
  feesToBePaid:'None',processingTime:'15 minutes',
  requirements:[{checklist:'None',where:'None'}],
  processOverview:[{
    clientSteps:'Submit request',agencyActions:'Review',feesToBePaid:'None',
    processingTime:'15 minutes',personResponsible:'Administrative Officer V, Records Section'
  }]
};
const legacy = {
  ...existingData,who_may_avail:undefined,whoMayAvail:'All',transaction_type:undefined,
  transactionTypes:'Government to Citizen (G2C)',
  requirements:[{requirement:'None',whereToSecure:'None'}],
  processOverview:[{clientSteps:'',agencyActions:'Review',fees:'None',time:'15 minutes',person:'John Doe'}]
};
let loadCount=0,checkCount=0,modal=null,confirmCount=0,autosaveCount=0;
class FakeReader {
  readAsText(file) {
    this.result=file.contents;
    this.onload();
  }
}
const settings = {
  ccImportReview:{present(...args){modal=args;}},
  validateCharterData(data){
    return data.processOverview.some(row=>!row.clientSteps)?
      [{section:'Process Overview',label:'Step 1: Client Steps',message:'Enter a step',target:'#processOverviewTableBody tr:nth-child(1) td:nth-child(1)'}]:[];
  },
  resetCharterReadiness(){},
  checkCharterReadiness(){checkCount++;},
  confirm(){confirmCount++;return true;},
  alert(message){throw new Error('Unexpected alert: '+message);},
  setTimeout(fn){fn();}
};
const req=[{},{}],steps=[{},{},{},{},{}];
const {normalizeCitizenCharterImport,importFormData}=create(
  settings,FakeReader,()=>({serviceName:''}),()=>false,
  ()=>{loadCount++;},()=>{autosaveCount++;},req,steps,console,false,''
);
const normalized=normalizeCitizenCharterImport(legacy);
assert.equal(normalized.who_may_avail,'All');
assert.deepEqual(normalized.transaction_type,['Government to Citizen (G2C)']);
assert.equal(normalized.requirements[0].checklist,'None');
assert.equal(normalized.requirements[0].where,'None');
assert.equal(normalized.processOverview[0].feesToBePaid,'None');
assert.equal(normalized.processOverview[0].personResponsible,'John Doe');
assert.equal(normalized.processOverview[0].clientSteps,'');
assert.equal(normalizeCitizenCharterImport(existingData).processOverview[0].clientSteps,'Submit request');
assert.throws(()=>normalizeCitizenCharterImport({foo:'bar'}),/requirements/);
assert.throws(()=>normalizeCitizenCharterImport({...existingData,processOverview:'wrong'}),/lists/);
assert.throws(()=>normalizeCitizenCharterImport({...existingData, requirements:[null]}),/requirements\[0\]/);
assert.throws(()=>normalizeCitizenCharterImport({...existingData,requirements:[{checklist:42,where:'A'}]}),/requirements\[0\]\.checklist/);
const input={files:[{name:'old.json',contents:JSON.stringify(legacy)}],value:'old.json'};
importFormData({currentTarget:input,target:input});
assert.equal(loadCount,0,'Incomplete JSON should offer correction before replacement');
assert.equal(input.value,'','File input must reset so the same file can be selected again');
assert.equal(modal[0],'old.json');
assert.equal(modal[3],true,'Incomplete files must remain correctable');
assert.equal(typeof modal[4],'function');
modal[4]();
assert.equal(loadCount,1,'The correction action must load the document');
assert.equal(checkCount,1,'The loader must run the field-by-field readiness navigator');
assert.equal(autosaveCount,1,'The imported draft should be saved in the current session');
modal=null;
const input2={files:[{name:'complete.json',contents:JSON.stringify(existingData)}],value:'complete.json'};
importFormData({currentTarget:input2,target:input2});
assert.equal(loadCount,2,'Complete files must load directly');
assert.equal(modal,null,'Complete file must not be blocked by an error modal');
assert(!inspector.includes('window.importFormData=function(event)'),'Inspector may not override file reader');
assert(html.includes('onchange="window.ccMainImportFile(event)"'),'Open file control must bind to the sole importer');
assert(main.includes('window.ccMainImportFile = importFormData;'),'Builder must expose the handler');
console.log('JSON Open regression: normal and incomplete/legacy imports passed.');
