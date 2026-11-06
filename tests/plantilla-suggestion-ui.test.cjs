// Run with: node tests/plantilla-suggestion-ui.test.cjs
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

class Element {
  constructor(tag){
    this.tagName=tag.toUpperCase();
    this.id='';this.hidden=true;this.textContent='';this.style={};
    this.children=[];this.listeners={};this.className='';this.isConnected=true;
    this.classList={add(){},remove(){}};
    this.bySelector=new Map();
  }
  append(...els){this.children.push(...els);}
  appendChild(el){this.children.push(el);return el;}
  replaceChildren(...els){this.children=[...els];}
  addEventListener(event,cb){this.listeners[event]=cb;}
  setAttribute(key,value){this[key]=value;}
  removeAttribute(key){delete this[key];}
  matches(){return false;}
  querySelector(selector){
    if(!this.bySelector.has(selector))this.bySelector.set(selector,new Element('div'));
    return this.bySelector.get(selector);
  }
  focus(){}
  scrollIntoView(){}
}

const cell=new Element('td');
const rootDiv=new Element('div');
rootDiv.id='personResponsible-42';
cell.bySelector.set('[id^="personResponsible-"]',rootDiv);

const document={
  head:new Element('head'),body:new Element('body'),activeElement:new Element('button'),
  createElement:tag=>new Element(tag),
  addEventListener(){},
  querySelector:selector=>selector==='#processOverviewTableBody tr:nth-child(1) td:nth-child(5)'?cell:null,
  querySelectorAll:()=>[]
};
const window={setTimeout:fn=>fn(),clearTimeout(){}};
vm.runInNewContext(fs.readFileSync('assets/plantilla-positions.js','utf8'),{window});
const data={
  serviceName:'Example',description:'Description',office:'Office',classification:'Simple',
  transaction_type:['Government to Citizen (G2C)'],who_may_avail:'All',
  feesToBePaid:'None',processingTime:'10 minutes',
  requirements:[{checklist:'None',where:'None'}],
  processOverview:[{
    clientSteps:'1. Submit Request',agencyActions:'1.1 Receive request',
    feesToBePaid:'None',processingTime:'10 minutes',
    personResponsible:'<p>Nursing Attendant II</p>'+
      '<p>Information System Analyst III</p>'+
      '<p>Information System Analyst II</p>'+
      '<p>Information System Analyst I</p>'+
      '<p>IMISS Office</p>'
  }]
};
let applied=0;
const editor={
  getData:()=>data.processOverview[0].personResponsible,
  setData:html=>{applied++;data.processOverview[0].personResponsible=html;}
};
const processOverviewEditors=[{type:'personResponsible',index:42,editor}];
vm.runInNewContext(fs.readFileSync('assets/validation.js','utf8'),{
  window,document,processOverviewEditors,collectCurrentFormData:()=>data
});
const issues=window.validateCharterData(data).filter(issue=>issue.fix);
assert.equal(issues.length,3,'All three incorrect analyst titles need suggestions');
assert.equal(data.processOverview[0].personResponsible.includes('Information Systems Analyst III'),false,
  'Checking readiness must not silently mutate the form');
assert.equal(window.ccApplyPlantillaSuggestion(issues[0]),true);
assert.equal(applied,1,'One user action updates one editor');
assert.equal(window.validateCharterData(data).filter(issue=>issue.fix).length,2);
const modal=document.body.children.find(el=>el.id==='cc-readiness-dialog');
assert(modal,'Readiness modal must exist');
modal.querySelector('.cc-ready-apply-all').listeners.click();
assert.equal(window.validateCharterData(data).length,0,'Bulk approval clears all remaining title issues');
assert.equal(applied,3,'Bulk button changes only two remaining titles');
assert(data.processOverview[0].personResponsible.includes('<p>Nursing Attendant II</p>'),
  'Valid role must be retained');
assert(data.processOverview[0].personResponsible.includes('<p>IMISS Office</p>'),
  'Office must be retained');
for(const roman of ['I','II','III'])
  assert(data.processOverview[0].personResponsible.includes('<p>Information Systems Analyst '+roman+'</p>'),
    'Corrected title '+roman+' must be retained');
assert.equal(window.ccApplyPlantillaSuggestion(issues[0]),false,
  'A stale correction must not mutate already corrected data');
console.log('Plantilla suggestion UI: opt-in single/bulk corrections passed.');
