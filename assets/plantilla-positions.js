/* Local plantilla reference supplied for CCMain; 130 entries, original spelling preserved. */
(function(){
  'use strict';
  const titles=Object.freeze(`Accountant I
Accountant II
Accountant III
Accountant IV
Administrative Aide I
Administrative Aide III
Administrative Aide IV
Administrative Aide V
Administrative Aide VI
Administrative Assistant I
Administrative Assistant II
Administrative Assistant III
Administrative Officer I
Administrative Officer II
Administrative Officer III
Administrative Officer IV
Administrative Officer V
Architect II
Artificial Limb and Brace Maker III
Attorney IV
Chemist III
Chief Administrative Officer
Chief Health Program Officer
Chief of Medical Professional Staff II
Computer Maintenance Technologist II
Computer Maintenance Technologist III
Cook II
Dental Aide
Dentist II
Dentist III
Dentist V
Dormitory Manager I
Dormitory Manager II
Dredgeman I
Engineer II
Engineer III
Engineer IV
Financial and Management Officer II
Health Education and Promotion Officer II
Health Education and Promotion Officer III
Health Physicist III
Hospital Housekeeper
Information Systems Analyst I
Information Systems Analyst II
Information Systems Analyst III
Laboratory Aide II
Laborer II
Laundry Worker I
Laundry Worker II
Laundry Worker III
Legal Assistant I
Legal Assistant II
Medical Center Chief II
Medical Equipment Technician I
Medical Equipment Technician II
Medical Equipment Technician III
Medical Equipment Technician IV
Medical Laboratory Technician III
Medical Officer III
Medical Officer IV
Medical Specialist II
Medical Specialist III
Medical Specialist III (PT)
Medical Specialist IV
Medical Technologist I
Medical Technologist II
Medical Technologist III
Medical Technologist IV
Medical Technologist V
Midwife I
Midwife II
Midwife III
Midwife IV
Nurse I
Nurse II
Nurse III
Nurse IV
Nurse V
Nurse VI
Nurse VII
Nursing Attendant I
Nursing Attendant II
Nutritionist-Dietitian I
Nutritionist-Dietitian II
Nutritionist-Dietitian III
Nutritionist-Dietitian IV
Nutritionist-Dietitian V
Occupational Therapist I
Occupational Therapist IV
Pharmacist I
Pharmacist II
Pharmacist III
Pharmacist IV
Pharmacist V
Physical Therapist I
Physical Therapist II
Physical Therapist III
Physical Therapist IV
Physical Therapy Technician I
Physical Therapy Technician II
Planning Assistant
Planning Officer I
Planning Officer III
Psychologist II
Psychologist III
Radiologic Technologist I
Radiologic Technologist II
Radiologic Technologist III
Radiologic Technologist IV
Radiologic Technologist V
Respiratory Therapist I
Respiratory Therapist II
Respiratory Therapist III
Seamstress
Seamtress
Security Guard I
Senior Health Program Officer
Social Welfare Assistant
Social Welfare Officer I
Social Welfare Officer II
Social Welfare Officer III
Social Welfare Officer IV
Statistician II
Statistician III
Supervising Administrative Officer
Supervising Health Program Officer
Training Assistant
Training Specialist IV
Ward Assistant
Warehouseman III`.split('\n').map(s=>s.trim()).filter(Boolean));

  const normalize=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('en')
    .replace(/[‐‑‒–—-]/g,' ').replace(/[.,;:]+/g,' ')
    .replace(/\s+/g,' ').trim();
  const byName=new Map(titles.map(title=>[normalize(title),title]));
  function distance(a,b){
    if(a===b)return 0;
    const old=Array.from({length:b.length+1},(_,j)=>j);
    for(let i=1;i<=a.length;i++){
      let previous=old[0];old[0]=i;
      for(let j=1;j<=b.length;j++){
        const saved=old[j];
        old[j]=Math.min(old[j]+1,old[j-1]+1,previous+(a[i-1]===b[j-1]?0:1));
        previous=saved;
      }
    }
    return old[b.length];
  }
  function closest(value){
    const query=normalize(value);
    if(!query||byName.has(query))return null;
    const suffix=query.match(/\b(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:\s+\(pt\))?$/);
    const matches=titles.map(title=>{
      const canonical=normalize(title);
      const score=1-distance(query,canonical)/Math.max(query.length,canonical.length);
      const rank=canonical.match(/\b(?:i|ii|iii|iv|v|vi|vii|viii|ix|x)(?:\s+\(pt\))?$/);
      return {title, score:score+(suffix&&rank&&suffix[0]===rank[0]?0.04:0)};
    }).sort((a,b)=>b.score-a.score);
    return matches[0]&&matches[0].score>=0.72?matches[0].title:null;
  }
  window.CCPlantillaPositions=Object.freeze({
    titles,normalize,match:(value)=>byName.get(normalize(value))||null,closest
  });
})();
