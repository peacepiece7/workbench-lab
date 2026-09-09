import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessons, evaluate } from '../lib/course.ts';
test('six unique lessons, four cases each, complete teaching material', () => {
  assert.equal(lessons.length, 6);
  assert.equal(new Set(lessons.map((l) => l.id)).size, 6);
  for (const l of lessons) {
    assert.equal(l.controls.length, 3);
    assert.equal(l.tests.length, 4);
    assert.equal(l.notes.length, 3);
    assert.ok(l.quiz.correct >= 0 && l.quiz.correct < l.quiz.options.length);
    assert.ok(l.source.url.startsWith('https://'));
  }
});
for (const l of lessons) {
  test(`${l.id}: default is incomplete; at least one complete design exists`, () => {
    assert.ok(evaluate(l, [0, 0, 0]).some((t) => !t.pass));
    let solved = false;
    for (let a = 0; a < l.controls[0].options.length; a++)
      for (let b = 0; b < l.controls[1].options.length; b++)
        for (let c = 0; c < l.controls[2].options.length; c++)
          if (evaluate(l, [a, b, c]).every((t) => t.pass)) solved = true;
    assert.ok(solved);
  });
  test(`${l.id}: every variable changes at least one test outcome`, () => {
    for (let i = 0; i < 3; i++) {
      const base = l.controls.map((c) => c.options.length - 1);
      const expected = evaluate(l, base);
      let useful = false;
      for (let v = 0; v < l.controls[i].options.length; v++) {
        const next = [...base];
        next[i] = v;
        if (JSON.stringify(evaluate(l, next)) !== JSON.stringify(expected))
          useful = true;
      }
      assert.ok(useful, `control ${i}`);
    }
  });
  test(`${l.id}: invalid inputs are rejected`, () => {
    for (const values of [
      [],
      [1, 1],
      [-1, 0, 0],
      [99, 0, 0],
      [0.5, 0, 0],
      [NaN, 0, 0],
    ])
      assert.throws(() => evaluate(l, values));
  });
}
