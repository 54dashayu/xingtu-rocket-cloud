import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {attachArchiveEvidence,hasReplayEvidence} from '../public/map/archive-evidence.js';
import {simulationProfile} from '../public/map/prediction.js';
import {mapLaunch} from '../public/map/model.js';
import {cloudStatus} from '../public/cloud-status.js';
const records=JSON.parse(readFileSync(new URL('../public/map/observation-archive.json',import.meta.url))).records;
const now=Date.parse('2026-10-27T00:00:00Z');
test('curated evidence requires matching UUID and minute; never increments user reports',()=>{
 for(const record of records.filter(r=>r.launchId)){
  const l={id:record.launchId,timing:{net:record.time},observationReportCount:0,result:{code:'success'}};
  const linked=attachArchiveEvidence(l,records,now);
  assert.equal(linked.observationReportCount,0);assert.equal(linked.archiveEvidence.length,1);assert.ok(hasReplayEvidence(linked));
  assert.equal(cloudStatus(linked,now).code==='observed',record.evidence.status==='confirmed');
  assert.equal(attachArchiveEvidence({...l,id:'wrong'},records,now).archiveEvidence,undefined);
  assert.equal(attachArchiveEvidence({...l,timing:{net:'2020-01-01T00:00:00Z'}},records,now).archiveEvidence,undefined);
  assert.equal(attachArchiveEvidence(l,records,Date.parse(record.time)-1).archiveEvidence,undefined);
 }
});
test('evidence enables reference simulation without inventing actual flight data',()=>{
 const record=records.find(r=>r.id==='f9-crs35-20261013');
 const launch=mapLaunch(attachArchiveEvidence({id:record.launchId,timing:{net:record.time,precision:'精确到分钟'},pad:{latitude:28.56,longitude:-80.57},observationReportCount:0,result:{code:'success'}},records,now));
 const p=simulationProfile(launch,{historical:true,target:150});
 assert.ok(p.full.length>0);assert.equal(p.kind,'predicted');assert.equal(p.source,null);
 const unknown={...launch,archiveEvidence:[],cloudEvidence:null};
 assert.equal(simulationProfile(unknown,{historical:true,target:150}).full.length,0);
 assert.ok(simulationProfile({...unknown,observationReportCount:1},{historical:true}).full.length>0);
});
