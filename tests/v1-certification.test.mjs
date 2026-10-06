import test from 'node:test';
import assert from 'node:assert/strict';
import { validateHumanCertification } from '../scripts/lib/v1-certification.mjs';

function passing(){
  return {
    candidate:'1.0.0-rc.1',
    candidateSha:'3dda96c86ceb58ad4824ac9ad8c7445da643562d',
    certificationStatus:'pass',
    tester:'Human Tester',
    date:'2026-10-06',
    productionUrl:'https://thiepn.dev/selah/',
    sessions:{
      epistle:{status:'pass',passage:'Philippians 2:5-11',minutes:60},
      poetryOrWisdom:{status:'pass',passage:'Psalm 23',minutes:30},
      narrative:{status:'pass',passage:'Genesis 22:1-14',minutes:45},
      apocalyptic:{status:'pass',passage:'Revelation 4:1-11',minutes:45}
    },
    devices:{
      desktop:{status:'pass',browser:'Firefox',minutes:60,keyboardPass:true,zoom200Pass:true},
      phone:{status:'pass',device:'Phone',browser:'Chrome PWA',minutes:30,pwaInstalled:true,softwareKeyboardPass:true,offlineReturn:true,reopenRestoresStudy:true},
      tablet:{status:'not-required',minutes:0,rotationPass:null},
      screenReader:{status:'not-certified',tool:''}
    },
    resilience:{backupCreated:true,backupExternalCopyConfirmed:true,restoreCompleted:true,restoredDatabaseWritable:true},
    ratings:{sustainedStudy:4,dataConfidence:5,physicalDeviceComfort:4},
    defects:[],
    decision:'pass',
    signoffNotes:'Completed the required field trial without blocking defects.'
  };
}

test('valid human field-trial evidence can pass the V1 gate',()=>{
  assert.deepEqual(validateHumanCertification(passing()),[]);
});

test('pending template cannot accidentally promote V1',()=>{
  const value=passing();
  value.certificationStatus='pending';
  value.decision='pending';
  value.devices.phone.offlineReturn=false;
  const errors=validateHumanCertification(value);
  assert.ok(errors.some((error)=>error.includes('certificationStatus')));
  assert.ok(errors.some((error)=>error.includes('decision')));
  assert.ok(errors.some((error)=>error.includes('offline return')));
});

test('open S0/S1 defects block promotion and accepted S2 requires rationale',()=>{
  const value=passing();
  value.defects=[
    {severity:'S1',summary:'Study save loses content',status:'open'},
    {severity:'S2',summary:'Repeated mobile friction',status:'accepted',acceptanceRationale:''}
  ];
  const errors=validateHumanCertification(value);
  assert.ok(errors.some((error)=>error.includes('S1 must be closed')));
  assert.ok(errors.some((error)=>error.includes('accepted S2 needs a release rationale')));
});
