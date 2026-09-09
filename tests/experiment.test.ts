import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog } from '../lib/catalog.ts';
import { simulate } from '../lib/experiment.ts';
import {
  emptyState,
  recordRun,
  restoreState,
  completed,
  reviewQuestion,
  type Run,
} from '../lib/learning-state.ts';
test('ten lessons; evaluation precedes retrieval; each has achievable practice goals', () => {
  assert.equal(catalog.length, 10);
  assert.equal(catalog[1].id, 'evals');
  for (const l of catalog) {
    let good = false;
    for (let a = 0; a < l.controls[0].options.length; a++)
      for (let b = 0; b < l.controls[1].options.length; b++)
        for (let c = 0; c < l.controls[2].options.length; c++) {
          const r = simulate(l.id, [a, b, c]);
          if (r.goal) good = true;
          assert.equal(r.passed, r.cases.filter((x) => x.pass).length);
          assert.equal(
            r.units,
            r.cases.reduce((s, x) => s + x.units, 0),
          );
          assert.ok(
            r.cases.every((x) => x.trace.length > 0 && x.expected && x.actual),
          );
        }
    assert.ok(good, l.id);
  }
});
test('RAG filters real candidate objects and checks selected evidence', () => {
  const weak = simulate('rag', [2, 0, 1]);
  assert.ok(!weak.cases[0].pass);
  assert.ok(
    weak.cases[0].evidence.find((e) => e.id === 'TR-204-old')?.selected,
  );
  const fixed = simulate('rag', [2, 1, 1]);
  assert.ok(fixed.goal);
  assert.equal(
    fixed.cases[0].evidence.find((e) => e.id === 'TR-204-old')?.excluded,
    '폐기된 문서',
  );
  assert.ok(fixed.cases[0].evidence.find((e) => e.id === 'TR-204')?.selected);
  assert.equal(
    fixed.cases[2].actual,
    '확인 가능한 근거가 없어 답변을 보류합니다.',
  );
});
test('RAG has meaningful tradeoffs and different winning configurations', () => {
  assert.ok(
    !simulate('rag', [2, 2, 2]).goal,
    'strict threshold loses valid answer',
  );
  assert.ok(
    !simulate('rag', [2, 1, 1], 'fast').goal,
    'hybrid exceeds fast budget',
  );
  assert.ok(simulate('rag', [0, 1, 1], 'fast').goal);
  assert.ok(
    !simulate('rag', [0, 1, 1], 'balanced').goal,
    'keyword loses synonym',
  );
  assert.ok(simulate('rag', [2, 2, 1], 'restricted').goal);
  assert.ok(simulate('rag', [2, 1, 1], 'restricted').risks > 0);
  for (const p of ['balanced', 'fast', 'restricted'] as const) {
    const c = p === 'fast' ? [0, 1, 1] : [2, 2, 1];
    assert.ok(simulate('rag', c, p, 'review').goal);
  }
});
test('evaluation compares generated verdicts to human rubric', () => {
  const baseline = simulate('evals', [0, 0, 0]);
  assert.ok(baseline.cases[2].actual.includes('누락'));
  assert.ok(!baseline.goal);
  const quality = simulate('evals', [1, 1, 0]);
  assert.ok(quality.cases[1].pass);
  assert.ok(!quality.cases[3].pass);
  assert.ok(quality.risks > 0);
  const full = simulate('evals', [1, 1, 1]);
  assert.ok(full.goal);
  assert.equal(full.cases[2].actual, '통과 판정');
  assert.equal(full.cases[3].actual, '실패 판정');
  assert.ok(simulate('evals', [1, 1, 1], 'balanced', 'review').goal);
});
test('invalid input fails without state mutations', () => {
  const s = emptyState();
  assert.throws(() => simulate('missing', [0, 0, 0]));
  assert.throws(() => simulate('rag', [2, 99, 1]));
  assert.throws(() => simulate('rag', [2, 1, 1], 'unknown' as never));
  assert.equal(JSON.stringify(s), JSON.stringify(emptyState()));
});
test('per-lesson state, notes, runs and active lesson survive serialization', () => {
  let s = emptyState();
  s.lessons.rag.note = '최신 문서 필터로 구버전 근거를 제외하겠습니다.';
  const r: Run = {
    id: 'one',
    at: '2026-09-09T00:00:00Z',
    choices: [2, 1, 1],
    profile: 'balanced',
    suite: 'practice',
    note: s.lessons.rag.note,
  };
  s = recordRun(s, 'rag', r);
  s.lessons.rag.answer = '1';
  s.lessons.rag.checked = true;
  assert.equal(completed('rag', s.lessons.rag), false);
  s = recordRun(s, 'rag', { ...r, id: 'two', suite: 'review' });
  assert.equal(completed('rag', s.lessons.rag), true);
  const restored = restoreState(JSON.stringify(s));
  assert.deepEqual(restored, s);
  assert.equal(restored.active, 'rag');
  assert.equal(restored.lessons.context.history.length, 0);
});
test('bad saved data is bounded and isolated; broken JSON rejected', () => {
  assert.throws(() => restoreState('{bad'));
  assert.throws(() => restoreState('{"version":1}'));
  const s = emptyState();
  s.lessons.rag.choices = [99, 99, 99];
  s.lessons.context.note = 'kept';
  const restored = restoreState(JSON.stringify(s));
  assert.deepEqual(restored.lessons.rag.choices, [0, 0, 0]);
  assert.equal(restored.lessons.context.note, 'kept');
});
test('completed lesson requires a rationale and transfer review', () => {
  let s = emptyState();
  const r: Run = {
    id: 'test',
    at: '2026-09-09T00:00:00Z',
    choices: [1, 1, 1],
    profile: 'balanced',
    suite: 'practice',
    note: '',
  };
  s = recordRun(s, 'memory', r);
  s.lessons.memory.answer = '1';
  s.lessons.memory.checked = true;
  s.lessons.memory.reviewChecked = true;
  s.lessons.memory.reviewAnswer = reviewQuestion('memory').correct;
  assert.equal(completed('memory', s.lessons.memory), false);
  s = recordRun(s, 'memory', {
    ...r,
    id: 'next',
    note: '최신 조건과 소유권을 모두 유지하도록 기억을 분리합니다.',
  });
  assert.equal(completed('memory', s.lessons.memory), true);
});
