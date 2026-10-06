import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateHumanCertification } from './lib/v1-certification.mjs';

const path=process.argv[2]??'docs/v1-human-certification.json';
const cert=JSON.parse(fs.readFileSync(path,'utf8'));
const errors=validateHumanCertification(cert);

let rcSha='';
try {
  rcSha=execFileSync('git',['rev-parse','origin/release/v1.0.0-rc.1'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
} catch {
  try {
    rcSha=execFileSync('git',['rev-parse','release/v1.0.0-rc.1'],{encoding:'utf8'}).trim();
  } catch {}
}

if(rcSha&&cert.candidateSha!==rcSha) errors.push('candidateSha '+cert.candidateSha+' does not match release/v1.0.0-rc.1 '+rcSha);

if(errors.length){
  console.error('V1 human certification is not ready:');
  for(const error of errors) console.error('- '+error);
  process.exit(1);
}

console.log('V1 human certification PASS for '+cert.candidate+' at '+cert.candidateSha);
