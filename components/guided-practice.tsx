'use client';
/* oxlint-disable nextjs/no-html-link-for-pages -- Full navigation avoids the established Vinext prefetch runtime issue. */
/* oxlint-disable react/react-compiler -- Effects hydrate browser-only storage and report storage failures; the ready guard prevents overwrites. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  GUIDE_KEY,
  lessons,
  emptyGuide,
  restoreGuide,
  advanceAttempt,
  type Attempt,
} from '@/lib/guided';
import './guided-practice.css';

const stages = [
  '문의 읽기',
  '규정과 답변 비교',
  '결정하기',
  '실행하기',
  '배운 점 확인',
];
export default function GuidedPractice() {
  const [state, setState] = useState(emptyGuide);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('학습 기록 불러오는 중…');
  const [blocked, setBlocked] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    try {
      setState(restoreGuide(localStorage.getItem(GUIDE_KEY)));
      setNotice(
        '이 브라우저에 자동 저장됩니다. 다른 기기와는 동기화되지 않습니다.',
      );
    } catch {
      setBlocked(true);
      setNotice(
        '기존 기록을 읽지 못해 덮어쓰지 않습니다. 이번 화면에서만 연습할 수 있습니다.',
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || blocked) return;
    try {
      localStorage.setItem(GUIDE_KEY, JSON.stringify(state));
    } catch {
      setBlocked(true);
      setNotice(
        '저장 공간 문제로 새 진행을 저장하지 못했습니다. 창을 닫으면 새 진행이 사라질 수 있습니다.',
      );
    }
  }, [state, ready, blocked]);
  const index = state.selected;
  const lesson = lessons[index];
  const attempt = state.attempts[index];
  const handoff = index === 2;
  const update = (patch: Partial<Attempt>) =>
    setState((s) => ({
      ...s,
      attempts: s.attempts.map((a, i) =>
        i === s.selected ? { ...a, ...patch } : a,
      ),
    }));
  function focusTask() {
    requestAnimationFrame(() => {
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }
  function next() {
    update(advanceAttempt(attempt, index));
    focusTask();
  }
  function select(i: number) {
    setState((s) => ({ ...s, selected: i }));
    focusTask();
  }
  return (
    <main className="guide-page">
      <header className="guide-nav">
        <a href="/" className="guide-brand">
          AI 업무 자동화 배우기
        </a>
        <nav aria-label="학습 메뉴">
          <a href="/experiments">설정 비교 · 기존 기록</a>
          <a href="/business/advanced">심화 업무 실습</a>
        </nav>
      </header>
      <div className="guide-intro">
        <span className="guide-label">따라 하는 실습 / 고객 문의 처리</span>
        <h1>
          AI에게 맡길 일,
          <br />
          사람이 확인할 일을 배웁니다.
        </h1>
        <p>
          고객 문의를 직접 처리해보고, 개발자로서 어디를 자동화할지 판단하세요.
        </p>
        <p className="guide-safe">
          연습용 데이터와 미리 작성된 AI 답변 예시입니다. 실제 AI 호출·고객
          발송은 없습니다.
        </p>
      </div>
      <div className="guide-layout">
        <aside className="guide-curriculum" aria-label="실습 선택">
          <h2>한 가지씩 연습하기</h2>
          {lessons.map((l, i) => (
            <button
              key={l.title}
              disabled={!ready}
              aria-current={index === i ? 'step' : undefined}
              onClick={() => select(i)}
            >
              <span>{state.attempts[i].done ? '✓' : `0${i + 1}`}</span>
              <span>
                {l.title}
                <small>
                  {state.attempts[i].done
                    ? '학습 완료'
                    : state.attempts[i].step
                      ? '이어서 하기'
                      : '시작 전'}
                </small>
              </span>
            </button>
          ))}
          <div className="guide-path">
            <h3>그다음에는</h3>
            <a href="/business/advanced">04 오류 복구·처리 방식 비교 →</a>
            <a href="/experiments">05 AI 답변 조건 바꿔보기 →</a>
            <p>
              이전 실험과 업무 기록은 삭제하지 않았습니다. 각 메뉴에서 계속
              이용할 수 있습니다.
            </p>
          </div>
        </aside>
        <article className="guide-workspace" aria-busy={!ready}>
          <div className="guide-task-head">
            <span className="guide-label">실습 {index + 1} / 3</span>
            <h2 ref={heading} tabIndex={-1}>
              {lesson.title}
            </h2>
            <p>{lesson.goal}</p>
            <p>
              <strong>내 역할</strong> · 지금은 답변 검토 담당자입니다. 마지막에
              자동화 개발자의 관점으로 돌아봅니다.
            </p>
          </div>
          <ol className="guide-steps" aria-label="진행 단계">
            {stages.map((s, i) => (
              <li
                key={s}
                aria-current={attempt.step === i ? 'step' : undefined}
              >
                <span>{attempt.step > i ? '✓' : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          {!ready ? (
            <output>저장한 실습을 준비하고 있습니다.</output>
          ) : (
            <section className="guide-active">
              <p className="guide-label">지금 할 일 · {attempt.step + 1} / 5</p>
              {attempt.step === 0 && (
                <>
                  <h3>고객은 무엇을 요청했나요?</h3>
                  <div className="guide-message">
                    <span>예제 고객 문의</span>
                    <blockquote>{lesson.question}</blockquote>
                  </div>
                  <p>
                    먼저 요청을 읽으세요. 다음 화면에서 참고 규정과 답변 예시를
                    비교합니다.
                  </p>
                  <Button onClick={next}>
                    문의 읽었어요 · 답변 확인하기 →
                  </Button>
                </>
              )}
              {attempt.step === 1 && (
                <>
                  <h3>
                    {handoff
                      ? '지금 환불을 확정할 수 있을까요?'
                      : '이 답변을 그대로 보내도 될까요?'}
                  </h3>
                  <div className="guide-compare">
                    <div>
                      <h4>현재 적용되는 규정</h4>
                      <p>{lesson.policy}</p>
                    </div>
                    <div>
                      <h4>
                        {handoff
                          ? '담당자에게 전달할 내용 예시'
                          : 'AI 답변 예시 · 실제 생성 아님'}
                      </h4>
                      <p>{lesson.draft}</p>
                    </div>
                  </div>
                  <details>
                    <summary>어디를 확인하면 좋을까요?</summary>
                    <p>{lesson.check}</p>
                  </details>
                  <Button onClick={next}>
                    {handoff ? '전달할 내용 확인하기' : '답변 수정·승인하기'} →
                  </Button>
                </>
              )}
              {attempt.step === 2 && (
                <>
                  <h3>
                    {handoff
                      ? '환불을 약속하지 않고 담당자에게 넘깁니다.'
                      : '보낼 내용을 확인하고 승인하세요.'}
                  </h3>
                  <details>
                    <summary>고객 문의와 현재 규정 다시 보기</summary>
                    <p>{lesson.question}</p>
                    <p>{lesson.policy}</p>
                  </details>
                  <label htmlFor="guide-draft">
                    {handoff
                      ? '고객지원 담당자에게 전달할 내용'
                      : '고객에게 보낼 답변'}
                  </label>
                  <Textarea
                    id="guide-draft"
                    rows={5}
                    maxLength={4000}
                    value={attempt.draft}
                    onChange={(e) =>
                      update({ draft: e.target.value, checked: false })
                    }
                  />
                  {index === 1 && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        update({
                          draft:
                            '현재는 14일 이내 신청 후 심사하는 규정이 적용됩니다. 20일이 지난 주문은 결제팀의 검토가 필요하여 지금 환불을 확정할 수 없습니다.',
                          checked: false,
                        })
                      }
                    >
                      수정 예시 적용하기
                    </Button>
                  )}
                  <label className="guide-check">
                    <Checkbox
                      checked={attempt.checked}
                      onCheckedChange={(value) => update({ checked: value })}
                    />
                    {lesson.check}
                  </label>
                  <p className="guide-help">
                    {attempt.draft.trim().length < 10
                      ? '전달할 내용을 10자 이상 입력하세요.'
                      : !attempt.checked
                        ? '규정과 내용을 비교한 뒤 위 확인 항목을 체크하세요.'
                        : '확인했습니다. 아래 버튼으로 결정을 확정하세요.'}{' '}
                    답변 의미를 AI가 채점하지는 않습니다.
                  </p>
                  <Button
                    disabled={
                      !attempt.checked || attempt.draft.trim().length < 10
                    }
                    onClick={next}
                  >
                    {handoff ? '담당자 전달 결정하기' : '답변 승인하기'} →
                  </Button>
                  <p className="guide-help">
                    이 버튼은 결정을 저장합니다. 아직 발송하거나 전달하지
                    않습니다.
                  </p>
                </>
              )}
              {attempt.step === 3 && (
                <>
                  <h3>
                    {handoff
                      ? '담당자에게 전달하기 전 마지막 확인'
                      : '승인 완료. 이제 연습 답변을 보냅니다.'}
                  </h3>
                  <div className="guide-message">
                    <span>
                      받는 사람 ·{' '}
                      {handoff
                        ? '고객지원 담당자 (연습)'
                        : '예제 문의 고객 (연습)'}
                    </span>
                    <p>{attempt.draft}</p>
                  </div>
                  <p>
                    {handoff
                      ? '고객 문제는 아직 해결되지 않았습니다. 담당자가 주문번호를 확인하도록 전달합니다.'
                      : '아래 버튼을 누르면 사이트 안에 발송 완료 기록이 생깁니다. 실제 메일은 전송되지 않습니다.'}
                  </p>
                  <Button onClick={next}>
                    {handoff ? '연습 전달하기' : '연습 답변 보내기'} →
                  </Button>
                </>
              )}
              {attempt.step === 4 && (
                <>
                  <output className="guide-success">
                    ✓ {attempt.outcome}
                  </output>
                  <details>
                    <summary>
                      {handoff
                        ? '담당자에게 전달한 내용 보기'
                        : '보낸 답변 보기'}
                    </summary>
                    <p>{attempt.draft}</p>
                  </details>
                  <h3>개발자라면, 무엇을 자동화할까요?</h3>
                  <p>{lesson.why}</p>
                  <div className="guide-compare">
                    <div>
                      <h4>AI에 맡길 일</h4>
                      <p>문의 요약과 답변 초안 제안</p>
                    </div>
                    <div>
                      <h4>사람·규칙이 확인할 일</h4>
                      <p>현재 규정, 필수 정보, 발송 허용 여부</p>
                    </div>
                  </div>
                  <fieldset>
                    <legend>{lesson.quiz}</legend>
                    {lesson.answers.map((answer, i) => (
                      <Button
                        key={answer}
                        variant={attempt.answer === i ? 'default' : 'outline'}
                        onClick={() =>
                          update({ answer: i, done: i === lesson.correct })
                        }
                      >
                        {answer}
                      </Button>
                    ))}
                  </fieldset>
                  {attempt.answer !== null && (
                    <output
                      className={
                        attempt.done ? 'guide-success' : 'guide-feedback'
                      }
                    >
                      {attempt.done
                        ? '맞습니다. 실행 결과와 원리 확인까지 마쳤습니다.'
                        : `다시 생각해보세요. ${lesson.why}`}
                    </output>
                  )}
                  {attempt.done &&
                    (index < 2 ? (
                      <Button onClick={() => select(index + 1)}>
                        다음 실습 · {lessons[index + 1].title} →
                      </Button>
                    ) : (
                      <div className="guide-path">
                        <h4>이제 업무 전체를 설계해보세요.</h4>
                        <p>
                          심화 실습에서 처리 방식을 비교하고, 자동화할 범위·중단
                          조건·담당자를 보고서에 정리합니다. 처리 부담은 교육용
                          가정이며 실제 절감 시간이 아닙니다.
                        </p>
                        <a href="/business/advanced">
                          오류 복구·처리 방식 비교로 이동 →
                        </a>
                      </div>
                    ))}
                </>
              )}
              {attempt.step > 0 && attempt.step < 4 && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    update({ step: attempt.step - 1 });
                    focusTask();
                  }}
                >
                  ← 이전 단계
                </Button>
              )}
            </section>
          )}
          <output className="guide-save">
            {notice}
          </output>
        </article>
      </div>
      <footer className="guide-resources">
        <h2>이 실습을 실제 구현으로 연결하기</h2>
        <p>
          입문 실습 뒤에 참고하세요. 아래 자료는 외부 서비스이며 실제 실행에는
          계정·API 설정이 필요할 수 있습니다.
        </p>
        <a
          href="https://github.com/openai/openai-cs-agents-demo"
          target="_blank"
          rel="noreferrer"
        >
          OpenAI · 고객지원 실행 흐름과 공개 코드 ↗
        </a>
        <a
          href="https://platform.claude.com/docs/en/about-claude/use-case-guides/ticket-routing"
          target="_blank"
          rel="noreferrer"
        >
          Claude · 업무 정의와 문의 분류 기준 ↗
        </a>
        <a
          href="https://docs.n8n.io/build/integrate-ai/ai-examples/human-in-the-loop-for-tools"
          target="_blank"
          rel="noreferrer"
        >
          n8n · 사람 확인 후 자동화 이어가기 ↗
        </a>
      </footer>
    </main>
  );
}
