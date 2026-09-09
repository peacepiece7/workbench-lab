'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Cpu,
  Database,
  FlaskConical,
  GitBranch,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { lessons, evaluate } from '@/lib/course';
function Lab() {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<number[]>([0, 0, 0]);
  const [result, setResult] = useState<ReturnType<typeof evaluate> | null>(
    null,
  );
  const [runValues, setRunValues] = useState<number[] | null>(null);
  const [previous, setPrevious] = useState<number | null>(null);
  const [tab, setTab] = useState('results');
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const { setOpenMobile } = useSidebar();
  const lesson = lessons[index];
  const passed = result?.filter((r) => r.pass).length ?? 0;
  const stale = runValues !== null && values.some((v, i) => v !== runValues[i]);
  function select(next: number) {
    setIndex(next);
    setValues([0, 0, 0]);
    setResult(null);
    setRunValues(null);
    setPrevious(null);
    setTab('results');
    setAnswer('');
    setChecked(false);
    setOpenMobile(false);
  }
  function applyRun(next: number, config: number[]) {
    const nextResult = evaluate(lessons[next], config);
    setPrevious(next === index && result ? passed : null);
    setIndex(next);
    setValues([...config]);
    setResult(nextResult);
    setRunValues([...config]);
    setTab('results');
    setChecked(false);
    if (next !== index) setAnswer('');
    return {
      lesson: lessons[next].id,
      passed: nextResult.filter((r) => r.pass).length,
      total: 4,
      results: nextResult.map((r, i) => ({
        test: lessons[next].tests[i].name,
        ...r,
      })),
      simulation: true,
    };
  }
  function run() {
    applyRun(index, values);
  }
  const runRef = useRef(applyRun);
  runRef.current = applyRun;
  useEffect(() => {
    type Tool = {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => unknown;
    };
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: Tool,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'run_learning_experiment',
            description:
              'Select an AI Native lesson, configure its three design choices, run the educational tests, and display the results. Choices are zero-based option indices. Does not call an AI model or mark the lesson completed.',
            inputSchema: {
              type: 'object',
              properties: {
                lessonId: { type: 'string', enum: lessons.map((l) => l.id) },
                choices: {
                  type: 'array',
                  items: { type: 'integer', minimum: 0 },
                  minItems: 3,
                  maxItems: 3,
                },
              },
              required: ['lessonId', 'choices'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              if (!input || typeof input !== 'object' || Array.isArray(input))
                throw new Error('Expected an object.');
              const data = input as Record<string, unknown>;
              const next = lessons.findIndex((l) => l.id === data.lessonId);
              if (
                Object.keys(data).some(
                  (k) => !['lessonId', 'choices'].includes(k),
                ) ||
                next < 0 ||
                !Array.isArray(data.choices)
              )
                throw new Error('Invalid lesson or choices.');
              const config = data.choices as number[];
              evaluate(lessons[next], config);
              let response: ReturnType<typeof applyRun> | undefined;
              flushSync(() => {
                response = runRef.current(next, config);
              });
              return response;
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Unsupported hosts retain the complete manual interface. */
    }
    return () => lifecycle.abort();
  }, []);
  function quiz() {
    setChecked(true);
    if (
      Number(answer) === lesson.quiz.correct &&
      passed === 4 &&
      !stale &&
      !completed.includes(index)
    )
      setCompleted([...completed, index]);
  }
  return (
    <>
      <Sidebar>
        <SidebarHeader className="p-6">
          <a className="brand" href="/">
            <span className="brand-icon">
              <FlaskConical size={22} />
            </span>
            <span>
              AI Native<span className="brand-small">LEARNING LAB</span>
            </span>
          </a>
        </SidebarHeader>
        <SidebarContent className="px-3">
          <div className="nav-caption">
            학습 경로{' '}
            <span>{String(lessons.length).padStart(2, '0')} LABS</span>
          </div>
          <SidebarMenu>
            {lessons.map((l, i) => (
              <SidebarMenuItem key={l.id}>
                <SidebarMenuButton
                  isActive={index === i}
                  onClick={() => select(i)}
                  className="lesson-nav"
                >
                  <span
                    className={
                      'nav-number ' + (completed.includes(i) ? 'done' : '')
                    }
                  >
                    {completed.includes(i) ? (
                      <Check size={15} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  <span className="nav-copy">
                    <span>{l.short}</span>
                    <small>{l.tag}</small>
                  </span>
                  {index === i && <ChevronRight size={16} />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="path-note">
            <BookOpen size={17} />
            <p>
              좋은 답변을 넘어,
              <br />
              믿고 쓸 수 있는 시스템으로.
            </p>
          </div>
        </SidebarContent>
        <SidebarFooter className="p-5">
          <div className="progress-label">
            <span>이번 학습 진행</span>
            <strong>
              {completed.length} / {lessons.length}
            </strong>
          </div>
          <Progress
            value={(completed.length / lessons.length) * 100}
            aria-label="학습 진행률"
            className="h-1.5"
          />
          <p className="micro">진행 상태는 현재 세션에서만 유지됩니다.</p>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="md:hidden" />
            <span>워크스페이스</span>
            <ChevronRight size={14} />
            <strong>AI Native 기초</strong>
          </div>
          <span className="live-label">
            <span />
            교육용 시뮬레이션
          </span>
        </header>
        <div className="page-content">
          <div className="lesson-heading">
            <div>
              <div className="eyebrow">
                LAB {String(index + 1).padStart(2, '0')} <span>/</span>{' '}
                {lesson.tag.toUpperCase()}
              </div>
              <h1>{lesson.title}</h1>
              <p>{lesson.description}</p>
            </div>
            <span className="level-pill">
              {index < 2 ? '입문' : '응용'} · 약 10분
            </span>
          </div>
          <div className="objective">
            <CircleHelp size={20} />
            <div>
              <strong>이번 실험의 미션</strong>
              <p>{lesson.mission}</p>
            </div>
          </div>
          <div className="lab-grid">
            <section className="experiment">
              <div className="canvas">
                <div className="section-line">
                  <span>
                    <GitBranch size={16} />
                    시스템 흐름
                  </span>
                  <span className="micro">선택한 설계가 흐름에 반영됩니다</span>
                </div>
                <div className="flow">
                  <div className="flow-node">
                    <span className="node-type">INPUT</span>
                    <Terminal size={25} />
                    <strong>{lesson.nodes[0]}</strong>
                    <small>4개의 테스트 입력</small>
                  </div>
                  <ArrowRight className="flow-arrow" />
                  <div className="flow-node model-node">
                    <span className="node-type">INTELLIGENCE</span>
                    <Cpu size={28} />
                    <strong>{lesson.nodes[1]}</strong>
                    <small>{lesson.controls[0].options[values[0]].label}</small>
                  </div>
                  <ArrowRight className="flow-arrow" />
                  <div className="flow-node output-node">
                    <span className="node-type">OUTPUT</span>
                    <ShieldCheck size={25} />
                    <strong>{lesson.nodes[2]}</strong>
                    <small>
                      {stale
                        ? '변경 후 실행 필요'
                        : result
                          ? `${passed} / 4 테스트 통과`
                          : '실험 대기 중'}
                    </small>
                  </div>
                </div>
                <div className="context-strip">
                  <Database size={16} />
                  <span>{lesson.controls[1].label}</span>
                  <strong>{lesson.controls[1].options[values[1]].label}</strong>
                  <span className="context-divider" />
                  <span>{lesson.controls[2].label}</span>
                  <strong>{lesson.controls[2].options[values[2]].label}</strong>
                </div>
                <div className="canvas-footer">
                  <span>
                    <span className="status-dot" />
                    규칙 기반 실험 · API 호출 없음
                  </span>
                  <span>FLOW / {lesson.id.toUpperCase()}</span>
                </div>
              </div>
              <Tabs
                value={tab}
                onValueChange={(v) => setTab(String(v))}
                className="result-tabs"
              >
                <TabsList variant="line" className="tabbar">
                  <TabsTrigger value="results">
                    <Terminal size={16} />
                    실험 결과
                    {result && <span className="tab-count">{passed}/4</span>}
                  </TabsTrigger>
                  <TabsTrigger value="learn">
                    <BookOpen size={16} />
                    개념 노트
                  </TabsTrigger>
                  <TabsTrigger value="quiz">
                    <CircleHelp size={16} />
                    이해도 확인
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="results">
                  <div className="results-head">
                    <div>
                      <h2>
                        {result
                          ? passed === 4
                            ? '모든 조건을 통과했어요'
                            : '실패에서 설계 힌트를 찾아보세요'
                          : '먼저 기본 설계를 실험해보세요'}
                      </h2>
                      <p>
                        {stale
                          ? '설정이 바뀌었습니다. 아래는 이전 실행 결과예요. 다시 실행해 비교하세요.'
                          : result
                            ? '각 입력의 결과와 원인을 확인하고, 변수를 바꿔 다시 실행하세요.'
                            : '설계 변수를 선택하고 실험을 실행하면 아래 4개 상황을 검증합니다.'}
                      </p>
                    </div>
                    {result && (
                      <div className="score">
                        {passed}
                        <span>/4</span>
                      </div>
                    )}
                  </div>
                  {previous !== null && (
                    <div className="comparison">
                      이전 실행 {previous}/4 → 현재 {passed}/4{' '}
                      <strong>
                        {passed > previous
                          ? '개선됐어요'
                          : passed < previous
                            ? '어떤 조건을 놓쳤을까요?'
                            : '다른 조합도 비교해보세요'}
                      </strong>
                    </div>
                  )}
                  <div className="test-list" aria-live="polite">
                    {lesson.tests.map((test, i) => (
                      <article className="test-row" key={test.name}>
                        <span
                          className={
                            'test-marker ' +
                            (result ? (result[i].pass ? 'pass' : 'fail') : '')
                          }
                        >
                          {result ? (
                            result[i].pass ? (
                              <Check size={15} />
                            ) : (
                              '!'
                            )
                          ) : (
                            String(i + 1).padStart(2, '0')
                          )}
                        </span>
                        <div>
                          <div className="test-title">
                            <h3>{test.name}</h3>
                            <span>
                              {result
                                ? result[i].pass
                                  ? '통과'
                                  : '개선 필요'
                                : '대기'}
                            </span>
                          </div>
                          <p className="test-input">“{test.input}”</p>
                          {result && (
                            <div
                              className={
                                'test-detail ' +
                                (result[i].pass ? 'success' : '')
                              }
                            >
                              <strong>
                                {result[i].pass ? test.success : test.failure}
                              </strong>
                              <p>{test.hint}</p>
                            </div>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="results-foot">
                    <span>실제 모델 성능을 예측하는 결과가 아닙니다.</span>
                    {passed === 4 && !stale && (
                      <button
                        className="text-action"
                        onClick={() => setTab('quiz')}
                      >
                        이해도 확인하기 <ArrowRight size={15} />
                      </button>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="learn">
                  <div className="notes">
                    <div className="eyebrow">MENTAL MODEL</div>
                    <h2>{lesson.concept}</h2>
                    {lesson.notes.map((n, i) => (
                      <section key={n.title}>
                        <span className="note-number">0{i + 1}</span>
                        <div>
                          <h3>{n.title}</h3>
                          <p>{n.body}</p>
                        </div>
                      </section>
                    ))}
                    <div className="takeaway">
                      <Sparkles size={18} />
                      <p>{lesson.takeaway}</p>
                    </div>
                    <a
                      className="source-link"
                      href={lesson.source.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      더 읽기 · {lesson.source.label} <ArrowRight size={15} />
                    </a>
                  </div>
                </TabsContent>
                <TabsContent value="quiz">
                  <div className="quiz">
                    <div className="eyebrow">CHECK YOUR UNDERSTANDING</div>
                    <h2>{lesson.quiz.question}</h2>
                    <RadioGroup
                      value={answer}
                      onValueChange={(v) => {
                        setAnswer(String(v));
                        setChecked(false);
                      }}
                      aria-label="이해도 문제 선택지"
                    >
                      {lesson.quiz.options.map((o, i) => (
                        <label
                          className={
                            'quiz-option ' +
                            (answer === String(i) ? 'selected' : '')
                          }
                          key={o}
                        >
                          <RadioGroupItem value={String(i)} />
                          <span>{o}</span>
                        </label>
                      ))}
                    </RadioGroup>
                    <button
                      className="primary-button"
                      disabled={answer === ''}
                      onClick={quiz}
                    >
                      정답 확인 <ArrowRight size={16} />
                    </button>
                    {checked && (
                      <div
                        className={
                          'quiz-feedback ' +
                          (Number(answer) === lesson.quiz.correct
                            ? 'correct'
                            : '')
                        }
                        role="status"
                      >
                        <strong>
                          {Number(answer) === lesson.quiz.correct
                            ? '정확해요.'
                            : '다시 생각해볼까요?'}
                        </strong>
                        <p>{lesson.quiz.explanation}</p>
                        {Number(answer) === lesson.quiz.correct &&
                          (passed !== 4 || stale) && (
                            <p>
                              현재 설계로 4개 테스트를 통과한 뒤 정답을 확인하면
                              실험이 완료됩니다.
                            </p>
                          )}
                        {completed.includes(index) && (
                          <button
                            className="text-action"
                            onClick={() => select((index + 1) % lessons.length)}
                          >
                            {index === lessons.length - 1
                              ? '첫 실험 다시 보기'
                              : '다음 실험으로'}{' '}
                            <ArrowRight size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </section>
            <aside className="design-panel">
              <div className="panel-title">
                <h2>
                  <FlaskConical size={18} />
                  설계 변수
                </h2>
                <button
                  className="icon-button"
                  title="기본 설계로 초기화"
                  aria-label="기본 설계로 초기화"
                  onClick={() => {
                    setValues([0, 0, 0]);
                    setResult(null);
                    setRunValues(null);
                    setPrevious(null);
                  }}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              <p className="panel-intro">
                한 번에 하나씩 바꾸며
                <br />
                결과가 달라지는 이유를 발견하세요.
              </p>
              {lesson.controls.map((c, ci) => (
                <fieldset className="control" key={lesson.id + c.label}>
                  <legend>
                    <span>0{ci + 1}</span>
                    {c.label}
                  </legend>
                  <RadioGroup
                    value={String(values[ci])}
                    onValueChange={(v) =>
                      setValues(
                        values.map((n, i) => (i === ci ? Number(v) : n)),
                      )
                    }
                    aria-label={c.label}
                  >
                    {c.options.map((o, oi) => (
                      <label
                        className={
                          'design-option ' +
                          (values[ci] === oi ? 'selected' : '')
                        }
                        key={o.label}
                      >
                        <RadioGroupItem value={String(oi)} />
                        <span>
                          <strong>{o.label}</strong>
                          <small>{o.description}</small>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
              ))}
              <button className="run-button" onClick={run}>
                <Play size={16} fill="currentColor" />
                실험 실행<kbd>RUN</kbd>
              </button>
              <p className="micro centered">
                정해진 테스트 규칙으로 즉시 실행합니다.
              </p>
            </aside>
          </div>
          <footer className="page-footer">
            <span>
              AI NATIVE LAB <span>/</span> 생각을 설계로, 설계를 실험으로.
            </span>
            <span>
              {lessons.length}개 실험 · {lessons.length * 4}개 테스트 · 코드
              없이 학습
            </span>
          </footer>
        </div>
      </main>
    </>
  );
}
export default function Page() {
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '256px' } as React.CSSProperties}
    >
      <Lab />
    </SidebarProvider>
  );
}
