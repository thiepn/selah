export function validateHumanCertification(cert){
  const errors=[];
  if(!cert||typeof cert!=='object') return ['Certification payload is missing or invalid'];
  const required=(condition,message)=>{if(!condition) errors.push(message);};

  required(cert.candidate==='1.0.0-rc.1','Candidate must be 1.0.0-rc.1');
  required(/^[0-9a-f]{40}$/.test(cert.candidateSha??''),'candidateSha must be an exact 40-character Git SHA');
  required(cert.certificationStatus==='pass','certificationStatus must be pass');
  required(typeof cert.tester==='string'&&cert.tester.trim().length>=2,'tester is required');
  required(/^\\d{4}-\\d{2}-\\d{2}$/.test(cert.date??''),'date must use YYYY-MM-DD');
  try {
    const url=new URL(cert.productionUrl);
    required(url.protocol==='https:','productionUrl must use HTTPS');
  } catch {
    errors.push('productionUrl must be a valid URL');
  }

  const sessions=cert.sessions??{};
  for(const [key,min] of [['epistle',60],['poetryOrWisdom',30],['narrative',45],['apocalyptic',45]]){
    const session=sessions[key]??{};
    required(session.status==='pass',key+' session must pass');
    required(Number.isFinite(session.minutes)&&session.minutes>=min,key+' session must record at least '+min+' minutes');
    required(typeof session.passage==='string'&&session.passage.trim().length>0,key+' passage is required');
  }

  const devices=cert.devices??{};
  const desktop=devices.desktop??{};
  required(desktop.status==='pass','desktop device pass is required');
  required(Number.isFinite(desktop.minutes)&&desktop.minutes>=60,'desktop field use must record at least 60 minutes');
  required(typeof desktop.browser==='string'&&desktop.browser.trim().length>0,'desktop browser is required');
  required(desktop.keyboardPass===true,'desktop keyboard pass is required');
  required(desktop.zoom200Pass===true,'desktop 200% zoom pass is required');

  const phone=devices.phone??{};
  required(phone.status==='pass','phone device pass is required');
  required(Number.isFinite(phone.minutes)&&phone.minutes>=30,'phone field use must record at least 30 minutes');
  required(typeof phone.device==='string'&&phone.device.trim().length>0,'phone device is required');
  required(typeof phone.browser==='string'&&phone.browser.trim().length>0,'phone browser is required');
  required(phone.pwaInstalled===true,'phone PWA installation is required');
  required(phone.softwareKeyboardPass===true,'phone software-keyboard pass is required');
  required(phone.offlineReturn===true,'phone offline return is required');
  required(phone.reopenRestoresStudy===true,'phone reopen/restore pass is required');

  const tablet=devices.tablet??{};
  required(['pass','not-required'].includes(tablet.status),'tablet status must be pass or not-required');
  if(tablet.status==='pass'){
    required(Number.isFinite(tablet.minutes)&&tablet.minutes>=20,'tablet pass must record at least 20 minutes');
    required(tablet.rotationPass===true,'tablet rotation pass is required when tablet is tested');
  }

  const sr=devices.screenReader??{};
  required(['pass','not-certified'].includes(sr.status),'screenReader status must be pass or not-certified');
  if(sr.status==='pass') required(typeof sr.tool==='string'&&sr.tool.trim().length>0,'screen-reader tool is required for a pass');

  const resilience=cert.resilience??{};
  required(resilience.backupCreated===true,'backup creation must pass');
  required(resilience.backupExternalCopyConfirmed===true,'backup external-copy confirmation must pass');
  required(resilience.restoreCompleted===true,'backup restore must pass');
  required(resilience.restoredDatabaseWritable===true,'restored database must remain writable');

  const defects=Array.isArray(cert.defects)?cert.defects:[];
  for(const [index,defect] of defects.entries()){
    const prefix='defect '+(index+1);
    required(['S0','S1','S2','S3'].includes(defect.severity),prefix+' has invalid severity');
    required(typeof defect.summary==='string'&&defect.summary.trim().length>0,prefix+' summary is required');
    required(['open','closed','accepted'].includes(defect.status),prefix+' status must be open, closed, or accepted');
    if(['S0','S1'].includes(defect.severity)) required(defect.status==='closed',prefix+' '+defect.severity+' must be closed before V1');
    if(defect.severity==='S2'&&defect.status!=='closed'){
      required(defect.status==='accepted',prefix+' S2 must be closed or explicitly accepted');
      required(typeof defect.acceptanceRationale==='string'&&defect.acceptanceRationale.trim().length>=10,prefix+' accepted S2 needs a release rationale');
    }
  }

  const ratings=cert.ratings??{};
  for(const key of ['sustainedStudy','dataConfidence','physicalDeviceComfort']){
    const value=ratings[key];
    required(Number.isFinite(value)&&value>=3&&value<=5,key+' rating must be 3–5 for a PASS');
  }

  required(cert.decision==='pass','decision must be pass');
  required(typeof cert.signoffNotes==='string'&&cert.signoffNotes.trim().length>=10,'signoffNotes must explain the V1 decision');
  return errors;
}
