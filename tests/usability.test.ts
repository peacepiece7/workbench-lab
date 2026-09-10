import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState,
  recordRun,
  trashRuns,
  restoreRun,
  restoreState,
} from '../lib/learning-state.ts';
import {
  emptyBusiness,
  restartBusiness,
  restoreBusinessArchive,
  restoreBusiness,
  replay,
} from '../lib/business.ts';

void test('deleted history and proof remain recoverable after reload without resetting choices', () => {
  const state = recordRun(emptyState(), 'context', {
    id: 'ux-1',
    at: '2026-09-10T00:00:00Z',
    choices: [1, 1, 1],
    profile: 'balanced',
    suite: 'practice',
    note: '규정에 근거한 답변만 허용하도록 선택합니다.',
  });
  const deleted = trashRuns(state, 'context', 'ux-1');
  assert.equal(deleted.lessons.context.history.length, 0);
  assert.equal(deleted.lessons.context.proofs.length, 0);
  assert.equal(deleted.lessons.context.trash.length, 1);
  assert.deepEqual(deleted.lessons.context.choices, [1, 1, 1]);
  const restored = restoreRun(
    restoreState(JSON.stringify(deleted)),
    'context',
    'ux-1',
  );
  assert.equal(restored.lessons.context.history.length, 1);
  assert.equal(restored.lessons.context.proofs.length, 1);
  assert.equal(restored.lessons.context.trash.length, 0);
});
void test('bulk deletion is isolated and preserves previous trash', () => {
  let state = emptyState();
  for (const id of ['context', 'rag'])
    for (let i = 0; i < 3; i++)
      state = recordRun(state, id, {
        id: `${id}-${i}`,
        at: '2026-09-10T00:00:00Z',
        choices: [0, 0, 0],
        profile: 'balanced',
        suite: 'practice',
        note: '',
      });
  state = trashRuns(trashRuns(state, 'context', 'context-0'), 'context');
  assert.equal(state.lessons.context.trash.length, 3);
  assert.equal(state.lessons.context.history.length, 0);
  assert.equal(state.lessons.rag.history.length, 3);
  assert.equal(
    restoreState(JSON.stringify(state)).lessons.context.trash.length,
    3,
  );
});
void test('old learning state without trash migrates without loss', () => {
  const state = emptyState(),
    old = JSON.parse(JSON.stringify(state));
  for (const lesson of Object.values(old.lessons) as Record<string, unknown>[])
    delete lesson.trash;
  assert.deepEqual(restoreState(JSON.stringify(old)), state);
});
void test('restart archives drafts and events, preserves other modes and report, and restores', () => {
  const s = emptyBusiness();
  s.goal = '업무 병목 줄이기';
  s.actions = [
    { type: 'start', mode: 'ai' },
    { type: 'start', mode: 'rules' },
  ];
  s.drafts['ai:CS-101'] = {
    draft: '영수증을 확인해주세요.',
    team: '결제팀',
    reason: '현행 규정을 확인했습니다.',
  };
  const reset = restartBusiness(s, 'ai', 'attempt-1');
  assert.equal(replay(reset.actions).ai, undefined);
  assert.ok(replay(reset.actions).rules);
  assert.equal(reset.goal, s.goal);
  assert.deepEqual(reset.drafts, {});
  const restored = restoreBusinessArchive(
    restoreBusiness(JSON.stringify(reset)),
    'attempt-1',
  );
  assert.ok(replay(restored.actions).ai);
  assert.deepEqual(restored.drafts, s.drafts);
  assert.equal(restored.archives.length, 0);
});
void test('restoring an archive swaps the current attempt without losing it', () => {
  let s = emptyBusiness();
  s.actions = [{ type: 'start', mode: 'ai' }];
  s = restartBusiness(s, 'ai', 'attempt-2');
  s.actions = [
    { type: 'start', mode: 'ai' },
    {
      type: 'review',
      mode: 'ai',
      id: 'CS-102',
      decision: 'reject',
      draft: '',
      team: '고객지원',
      reason: '수동 인계가 필요합니다.',
    },
  ];
  const restored = restoreBusinessArchive(s, 'attempt-2');
  assert.equal(restored.actions.length, 1);
  assert.equal(restored.archives[0].actions.length, 2);
  assert.equal(restoreBusinessArchive(restored, 'attempt-2').actions.length, 2);
});
void test('old business storage migrates; malformed drafts and archives fail closed', () => {
  const s = emptyBusiness();
  assert.deepEqual(
    restoreBusiness(
      JSON.stringify({
        version: 1,
        actions: [],
        goal: '',
        rationale: '',
        operations: '',
      }),
    ),
    s,
  );
  assert.throws(() =>
    restoreBusiness(
      JSON.stringify({ ...s, drafts: { 'ai:CS-101': { draft: 3 } } }),
    ),
  );
  assert.throws(() =>
    restoreBusiness(
      JSON.stringify({
        ...s,
        archives: [
          {
            id: 'bad',
            mode: 'ai',
            actions: [
              { type: 'send', mode: 'ai', id: 'CS-101', loseAck: false },
            ],
            drafts: {},
          },
        ],
      }),
    ),
  );
});
