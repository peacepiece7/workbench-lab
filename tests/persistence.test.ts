import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  recordRun,
  restoreState,
  completed,
  type Run,
} from '../lib/learning-state.ts';
test('completion survives capped history and reload', () => {
  let s = emptyState();
  const r: Run = {
    id: 'success',
    at: '2026-09-09T00:00:00Z',
    choices: [2, 1, 1],
    profile: 'balanced',
    suite: 'practice',
    note: '폐기 문서를 제외하고 관련 있는 최신 근거만 사용하겠습니다.',
  };
  s = recordRun(s, 'rag', r);
  s = recordRun(s, 'rag', { ...r, id: 'review', suite: 'review' });
  s.lessons.rag.answer = '1';
  s.lessons.rag.checked = true;
  for (let i = 0; i < 25; i++)
    s = recordRun(s, 'rag', { ...r, id: `fail-${i}`, choices: [0, 0, 0] });
  assert.equal(s.lessons.rag.history.length, 20);
  assert.equal(s.lessons.rag.proofs.length, 2);
  assert.ok(completed('rag', s.lessons.rag));
  assert.ok(completed('rag', restoreState(JSON.stringify(s)).lessons.rag));
});
test('missing data, invalid dates, malformed containers and oversize notes', () => {
  assert.deepEqual(restoreState(null), emptyState());
  assert.throws(() =>
    restoreState('{"version":2,"engine":"2.0","lessons":null}'),
  );
  const s = emptyState();
  s.lessons.context.note = 'a'.repeat(3000);
  s.lessons.context.history = [
    {
      id: 'bad',
      at: 'not a date',
      choices: [0, 0, 0],
      profile: 'balanced',
      suite: 'practice',
      note: '',
    },
  ];
  const r = restoreState(JSON.stringify(s));
  assert.equal(r.lessons.context.note.length, 2000);
  assert.equal(r.lessons.context.history.length, 0);
});
