// Remove this legacy adapter once all accepted shared snapshots include the fix.
export function adaptReportSummary(code) {
 const sharedImport=/import\s*\{[^}]*\breadReportSummary\b[^}]*\}\s*from\s*['"][^'"]*report-summary\.js/.test(code);
 if(sharedImport&&/\breadReportSummary\s*\(/.test(code)&&/prepareMission\s*\(\s*withReportCount\s*\(/.test(code))return code;
 if(code.includes('readReportSummary')||code.includes('withReportCount'))throw Error('Partial shared report-summary integration; review before packaging');
 if(code.includes('// Android legacy report-summary adapter'))return code;
 const marker='  if(generation!==catalogueGeneration)return;\n  missionRows=';
 const prepare='const row=prepareMission(l,records);';
 if(!code.includes(marker)||!code.includes(prepare))throw Error('3D catalogue changed; review Android report-summary integration');
 return code.replace(marker,`  // Android legacy report-summary adapter
  let reportCounts={};
  try{
   const response=await fetch('/xingtu-analytics/report-summary',{cache:'no-store',signal:AbortSignal.timeout(5000)});
   if(response.ok){const summary=await response.json();reportCounts=summary.counts||{};}
  }catch{}
  if(generation!==catalogueGeneration)return;
  missionRows=`).replace(prepare,'const count=reportCounts[l.id];const row=prepareMission({...l,observationReportCount:Number.isSafeInteger(count)&&count>0?count:0},records);');
}
