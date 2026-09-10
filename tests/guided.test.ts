import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyGuide, restoreGuide, advanceAttempt } from '../lib/guided.ts';
test('new guide starts with one inquiry and isolated attempts', () => {
  const s = emptyGuide();
  assert.equal(s.selected, 0);
  assert.equal(s.attempts.length, 3);
  assert.equal(s.attempts[0].step, 0);
});
test('approval requires explicit confirmation and a meaningful length', () => {
  const a = { ...emptyGuide().attempts[0], step: 2 };
  assert.equal(advanceAttempt(a, 0), a);
  assert.equal(
    advanceAttempt({ ...a, checked: true, draft: '짧음' }, 0).step,
    2,
  );
  assert.equal(advanceAttempt({ ...a, checked: true }, 0).step, 3);
});
test('approval does not send; sending is idempotent at completion', () => {
  const approved = advanceAttempt(
    { ...emptyGuide().attempts[0], step: 2, checked: true },
    0,
  );
  assert.equal(approved.outcome, '');
  const sent = advanceAttempt(approved, 0);
  assert.match(sent.outcome, /실제 전송 0건/);
  assert.deepEqual(advanceAttempt(sent, 0), sent);
});
test('handoff is not marked as customer resolution', () => {
  const a = advanceAttempt({ ...emptyGuide().attempts[2], step: 3 }, 2);
  assert.match(a.outcome, /고객 문제 해결 전/);
  assert.equal(a.done, false);
});
test('draft and progress round-trip without altering other storage', () => {
  const s = emptyGuide();
  s.attempts[1].draft = '작성 중인 내 답변';
  s.attempts[1].step = 2;
  assert.deepEqual(restoreGuide(JSON.stringify(s)), s);
  assert.deepEqual(restoreGuide(null), emptyGuide());
});
test('corrupt or future guide state fails closed', () => {
  assert.throws(() => restoreGuide('{'));
  assert.throws(() =>
    restoreGuide(JSON.stringify({ ...emptyGuide(), selected: 99 })),
  );
  const s = emptyGuide();
  s.attempts[0].step = -1;
  assert.throws(() => restoreGuide(JSON.stringify(s)));
});
