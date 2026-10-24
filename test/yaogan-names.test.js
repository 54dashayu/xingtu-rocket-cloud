import test from 'node:test';
import assert from 'node:assert/strict';
import { translateMissionName } from '../src/translate.js';
test('Yaogan names preserve satellite and group identifiers in Chinese',()=>{
 assert.equal(translateMissionName('Long March 6A | Yaogan 50-03'),'长征6A｜遥感五十号03星');
 assert.equal(translateMissionName('Yaogan 53-07 to 09/56-19 to 21'),'遥感五十三号07星至09星、遥感五十六号19星至21星');
 assert.equal(translateMissionName('Yaogan 40 Group 05'),'遥感四十号05组卫星');
 assert.equal(translateMissionName('YAOGAN-42 02'),'遥感四十二号02星');
 assert.equal(translateMissionName('Yaogan 50'),'遥感五十号');
 assert.equal(translateMissionName('遥感五十号03星'),'遥感五十号03星');
 assert.equal(translateMissionName('Yaogan 50-03 & Yaogan 51-01'),'遥感五十号03星 & 遥感五十一号01星');
});
