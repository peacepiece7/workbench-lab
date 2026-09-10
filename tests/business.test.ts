import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES,
  requests,
  emptyBusiness,
  transition,
  replay,
  restoreBusiness,
  metrics,
  report,
  type Mode,
  type Action,
  type Run,
} from '../lib/business.ts';

function approve(run: Run, id = 'CS-101'): Run {
  const ticket = run.tickets.find((t) => t.id === id)!;
  return transition(run, {
    type: 'review',
    mode: run.mode,
    id,
    decision: 'approve',
    draft: ticket.draft || '담당자가 문의를 확인하고 안내하겠습니다.',
    team: requests.find((t) => t.id === id)!.expected,
    reason: '현행 정책과 담당 팀을 확인했습니다.',
  });
}
for (const mode of MODES) {
  void test(`${mode}: duplicate input creates five tickets and repeated ingest is idempotent`, () => {
    const run = transition(undefined, { type: 'start', mode });
    assert.equal(run.tickets.length, 5);
    assert.equal(run.duplicateEvents, 1);
    assert.equal(transition(run, { type: 'start', mode }), run);
    assert.equal(run.outbox.length, 0);
  });
  void test(`${mode}: no sending before approval; blocked cases cannot be approved`, () => {
    const run = transition(undefined, { type: 'start', mode });
    for (const t of run.tickets)
      assert.throws(() =>
        transition(run, { type: 'send', mode, id: t.id, loseAck: false }),
      );
    for (const id of ['CS-102', 'CS-103'])
      assert.throws(() => approve(run, id));
    assert.equal(run.outbox.length, 0);
  });
  void test(`${mode}: approval snapshots edited content and ack-loss recovery cannot duplicate delivery`, () => {
    const initial = transition(undefined, { type: 'start', mode });
    const approved = approve(initial);
    assert.equal(initial.tickets[0].status, 'pending');
    assert.equal(approved.outbox.length, 0);
    const lost = transition(approved, {
      type: 'send',
      mode,
      id: 'CS-101',
      loseAck: true,
    });
    assert.equal(lost.outbox.length, 1);
    assert.equal(lost.tickets[0].status, 'retry');
    assert.equal(lost.outbox[0].body, approved.tickets[0].draft);
    const restored = transition(lost, {
      type: 'send',
      mode,
      id: 'CS-101',
      loseAck: false,
    });
    assert.equal(restored.tickets[0].status, 'sent');
    assert.equal(
      transition(restored, { type: 'send', mode, id: 'CS-101', loseAck: true }),
      restored,
    );
    assert.equal(restored.outbox.length, 1);
    assert.throws(() => approve(restored));
  });
}
void test('rejecting hands off without sending and blocks later approval', () => {
  let run = transition(undefined, { type: 'start', mode: 'ai' });
  run = transition(run, {
    type: 'review',
    mode: 'ai',
    id: 'CS-103',
    decision: 'reject',
    draft: '',
    team: '보안팀',
    reason: '보안팀으로 수동 인계합니다.',
  });
  assert.equal(metrics(run).rejected, 1);
  assert.equal(run.outbox.length, 0);
  assert.throws(() =>
    transition(run, { type: 'send', mode: 'ai', id: 'CS-103', loseAck: false }),
  );
  assert.throws(() => approve(run, 'CS-103'));
});
void test('empty review reason or blank approval fails without changing state', () => {
  const run = transition(undefined, { type: 'start', mode: 'manual' });
  for (const [draft, reason] of [
    ['', '검토 사유가 있습니다'],
    ['답변을 작성했습니다.', ''],
  ]) {
    assert.throws(() =>
      transition(run, {
        type: 'review',
        mode: 'manual',
        id: 'CS-101',
        decision: 'approve',
        draft,
        reason,
        team: '결제팀',
      }),
    );
  }
  assert.equal(run.tickets[0].status, 'pending');
});
void test('rules misroute ambiguous intent; reviewer correction changes the measured error', () => {
  const run = transition(undefined, { type: 'start', mode: 'rules' });
  const t = run.tickets.find((t) => t.id === 'CS-104')!;
  assert.equal(t.team, '결제팀');
  const wrong = transition(run, {
    type: 'review',
    mode: 'rules',
    id: t.id,
    decision: 'approve',
    draft: t.draft,
    team: t.team,
    reason: '키워드만 확인했습니다.',
  });
  assert.equal(metrics(wrong).wrong, 1);
  assert.equal(metrics(approve(run, t.id)).wrong, 0);
});
void test('all cases can reach terminal state with three deliveries and two handoffs', () => {
  for (const mode of MODES) {
    let run = transition(undefined, { type: 'start', mode });
    for (const t of run.tickets) {
      if (t.status === 'blocked')
        run = transition(run, {
          type: 'review',
          mode,
          id: t.id,
          decision: 'reject',
          draft: t.draft,
          team: requests.find((r) => r.id === t.id)!.expected,
          reason: '예외 사유를 담당자에게 인계합니다.',
        });
      else {
        run = approve(run, t.id);
        run = transition(run, { type: 'send', mode, id: t.id, loseAck: false });
      }
    }
    assert.equal(metrics(run).pending, 0);
    assert.equal(metrics(run).wrong, 0);
    assert.equal(metrics(run).sent, 3);
    assert.equal(metrics(run).rejected, 2);
  }
});
void test('replay restores independent modes and durable approval/retry state', () => {
  const actions: Action[] = [
    { type: 'start', mode: 'ai' },
    { type: 'start', mode: 'rules' },
    {
      type: 'review',
      mode: 'ai',
      id: 'CS-101',
      decision: 'approve',
      team: '결제팀',
      draft: '승인된 답변은 변경되지 않습니다.',
      reason: '정책과 내용을 확인했습니다.',
    },
    { type: 'send', mode: 'ai', id: 'CS-101', loseAck: true },
  ];
  const state = {
    ...emptyBusiness(),
    actions,
    goal: '잘못된 업무 배정을 줄이기',
  };
  assert.deepEqual(restoreBusiness(JSON.stringify(state)), state);
  const runs = replay(restoreBusiness(JSON.stringify(state)).actions);
  assert.equal(runs.ai!.tickets[0].status, 'retry');
  assert.equal(runs.rules!.outbox.length, 0);
  assert.equal(
    transition(runs.ai, {
      type: 'send',
      mode: 'ai',
      id: 'CS-101',
      loseAck: false,
    }).outbox.length,
    1,
  );
  const md = report(state);
  assert.ok(md.includes(state.goal));
  assert.ok(md.includes('실제 ROI가 아니며'));
  assert.ok(md.includes('CS-101'));
});
void test('corrupt, newer, malformed, and impossible stored actions are rejected', () => {
  const valid = emptyBusiness();
  assert.deepEqual(restoreBusiness(null), valid);
  for (const value of [
    'not json',
    JSON.stringify({ ...valid, version: 2 }),
    JSON.stringify({ ...valid, goal: 123 }),
    JSON.stringify({
      ...valid,
      actions: [{ type: 'send', mode: 'ai', id: 'CS-101', loseAck: false }],
    }),
    JSON.stringify({
      ...valid,
      actions: [{ type: 'start', mode: 'bad' as Mode }],
    }),
    JSON.stringify({
      ...valid,
      actions: Array(501).fill({ type: 'start', mode: 'ai' }),
    }),
  ])
    assert.throws(() => restoreBusiness(value));
});
