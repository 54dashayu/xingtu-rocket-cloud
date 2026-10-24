import test from 'node:test';
import assert from 'node:assert/strict';
import { displayName } from '../public/name-display.js';

test('generic rideshare descriptions translate without provisional labels', () => {
  assert.deepEqual(displayName('猎鹰9号｜Bandwagon 5 （Dedicated Mid-Inclination Rideshare）'), {
    text: '猎鹰9号｜拼车任务 5 （中倾角轨道专用拼车发射）', provisional: false
  });
});
test('reference names are marked, identifiers and unknown names preserved', () => {
  assert.deepEqual(displayName('电子号｜The Sea God Surveys (iQPS Launch 9)'), {
    text: '电子号｜海神巡测 (iQPS 第 9 次发射)', provisional: true
  });
  assert.deepEqual(displayName('AayulSAT-1A & others'), {text: 'AayulSAT-1A & 其他载荷', provisional: false});
  assert.deepEqual(displayName('长征12A｜第 2 次飞行'), {text: '长征12A｜第 2 次飞行', provisional: false});
});

