import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {localizeName,localizeAgency,localizeLaunch} from '../public/launch-localization.js';
import {translateMissionName,translateRocket,translateAgency} from '../src/translate.js';
const require=createRequire(import.meta.url);
const mini=null; // Mini Program is not distributed in this repository.
const samples=[
 ['Kinetica 2 | SpaceSail Polar Group #17','力箭二号｜千帆极轨17组卫星'],
 ['Hyperbola-3 | Demo Flight','双曲线三号｜验证飞行'],
 ['Ceres-2 | Unknown Payload','谷神星二号｜未公布载荷'],
 ['Shenzhou 24','神舟24号飞船'],
 ['Qingzhou Prototype Spacecraft','轻舟初样试飞船'],
 ['OSE HS-01 & 02','东方慧眼高光谱01、02星'],
 ['DEAR-5','迪迩五号空间试验器'],
 ['Traffic VDES A & B','交通VDES卫星A星、B星'],
 ['AlSat 3B','阿尔及利亚遥感三号B星'],
 ['SatNet LEO Group TBD?','卫星互联网低轨卫星（组别待定，计划待确认）'],
 ['ETS-9','技术试验卫星九号'],
 ['Aspera','星系气体紫外探测任务（阿斯佩拉）']
];
test('Chinese names cover rocket, payload and uncertainty without inventing group numbers',()=>{
 for(const [raw,expected] of samples){assert.equal(localizeName(raw),expected);if(mini)assert.equal(mini.localizeName(raw),expected);assert.equal(localizeName(expected),expected);}
 assert.equal(localizeName('Kinetica 20'), 'Kinetica 20');
 assert.equal(localizeName('Kinetica 2A'), 'Kinetica 2A');
});
test('provider names distinguish CAS Space and i-Space; raw identity is preserved',()=>{
 assert.equal(translateRocket('Kinetica 2'),'力箭二号');
 assert.equal(translateAgency('i-Space'),'星际荣耀');
 assert.equal(localizeAgency('CAS Space'),'中科宇航');
 const original={id:'mission-1',name:'Kinetica 2｜千帆极轨17组卫星',originalName:'Kinetica 2 | SpaceSail Polar Group #17',rocket:'Kinetica 2',agency:{name:'机构中文名称待核验',originalName:'i-Space'},mission:{name:'Qingzhou Prototype Spacecraft',originalName:'Qingzhou Prototype Spacecraft'},timing:{net:null},scheduleStatus:{code:'tentative'}};
 const before=JSON.stringify(original);const result=localizeLaunch(original);
 assert.equal(result.agency.name,'星际荣耀');assert.equal(result.mission.name,'轻舟初样试飞船');
 assert.equal(result.originalName,original.originalName);assert.equal(result.timing,original.timing);assert.equal(JSON.stringify(original),before);
 if(mini)assert.deepEqual(mini.localizeLaunch(original),result);
 assert.equal(translateMissionName('10 satellites','other-mission'),'10颗卫星');
});
test('generated mini vocabulary exactly matches shared source',{skip:'Mini Program source excluded from public repository'},async()=>{
 const source=await readFile(new URL('../public/launch-localization.js',import.meta.url),'utf8');
 const generated=await readFile(new URL('../miniprogram/utils/launch-localization.js',import.meta.url),'utf8');
 assert.ok(generated.includes(source.replace(/export /g,'')));
});
