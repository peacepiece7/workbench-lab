'use client';
import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Database,
  FlaskConical,
  GitBranch,
  Play,
  RotateCcw,
  Sparkles,
  Terminal,
  History,
  FileText,
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
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { catalog } from '@/lib/catalog';
import { simulate, profiles, type Profile, type Suite } from '@/lib/experiment';
import {
  emptyState,
  restoreState,
  recordRun,
  trashRuns,
  restoreRun,
  completed,
  reviewQuestion,
  STORAGE_KEY,
  type LessonState,
  type Run,
} from '@/lib/learning-state';

function Lab() {
  const [state, setState] = useState(emptyState);
  const [ready, setReady] = useState(false);
  const [storageStatus, setStorageStatus] = useState('기록 불러오는 중');
  const [blocked, setBlocked] = useState(false);
  const [tab, setTab] = useState('results');
  const [selectedRun, setSelectedRun] = useState('');
  const [baseline, setBaseline] = useState('');
  const [journalNotice, setJournalNotice] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);
  const { setOpenMobile } = useSidebar();
  useEffect(() => {
    try {
      setState(restoreState(localStorage.getItem(STORAGE_KEY)));
      setStorageStatus('이 브라우저에 자동 저장');
    } catch {
      setBlocked(true);
      setStorageStatus(
        '저장 기록을 읽지 못했습니다. 원본을 보존하고 이번 세션에서만 진행합니다.',
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || blocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageStatus('이 브라우저에 자동 저장');
    } catch {
      setBlocked(true);
      setStorageStatus(
        '저장 공간 또는 권한 문제로 이번 세션에서만 진행합니다.',
      );
    }
  }, [state, ready, blocked]);
  const lesson = catalog.find((l) => l.id === state.active)!;
  const index = catalog.indexOf(lesson),
    s = state.lessons[lesson.id],
    values = s.choices;
  const activeRun = s.history.find((r) => r.id === selectedRun) ?? s.history[0];
  const result = activeRun
    ? simulate(lesson.id, activeRun.choices, activeRun.profile, activeRun.suite)
    : null;
  const stale =
    !!activeRun &&
    (activeRun.profile !== s.profile ||
      activeRun.choices.some((v, i) => v !== values[i]));
  const compareRun =
    s.history.find((r) => r.id === baseline) ??
    s.history.find(
      (r) =>
        r.id !== activeRun?.id &&
        r.profile === activeRun?.profile &&
        r.suite === activeRun?.suite,
    );
  const comparison = compareRun
    ? simulate(
        lesson.id,
        compareRun.choices,
        compareRun.profile,
        compareRun.suite,
      )
    : null;
  const comparable =
    !!activeRun &&
    !!compareRun &&
    activeRun.profile === compareRun.profile &&
    activeRun.suite === compareRun.suite;
  const deep = ['rag', 'evals'].includes(lesson.id);
  const count = catalog.filter((l) =>
    completed(l.id, state.lessons[l.id]),
  ).length;
  const canReview = [...s.history, ...s.proofs].some(
    (r) =>
      r.suite === 'practice' &&
      r.profile === s.profile &&
      r.choices.every((v, i) => v === values[i]) &&
      simulate(lesson.id, r.choices, r.profile, r.suite).goal,
  );
  function patch(change: Partial<LessonState>) {
    setState((old) => ({
      ...old,
      lessons: {
        ...old.lessons,
        [lesson.id]: { ...old.lessons[lesson.id], ...change },
      },
    }));
  }
  function select(id: string) {
    setState((old) => ({ ...old, active: id }));
    setSelectedRun('');
    setBaseline('');
    setTab('results');
    setOpenMobile(false);
    window.setTimeout(
      () =>
        document
          .querySelector('.quick-start')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      80,
    );
  }
  function execute(
    id: string,
    choices: number[],
    profile: Profile,
    suite: Suite,
  ) {
    if (!ready) throw new Error('학습 기록을 불러오는 중입니다.');
    const out = simulate(id, choices, profile, suite);
    const run: Run = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      choices: [...choices],
      profile,
      suite,
      note: state.lessons[id].note,
    };
    setState((old) => recordRun(old, id, run));
    setSelectedRun(run.id);
    setBaseline('');
    setTab('results');
    window.setTimeout(
      () =>
        resultRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        }),
      80,
    );
    return out;
  }
  const executeRef = useRef(execute);
  executeRef.current = execute;
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
              'Configure and run a practice lesson, displaying authored evidence and results. Saves a local-browser learning run; no AI API calls. Does not complete a lesson or run a hidden review.',
            inputSchema: {
              type: 'object',
              properties: {
                lessonId: { type: 'string', enum: catalog.map((l) => l.id) },
                choices: {
                  type: 'array',
                  items: { type: 'integer', minimum: 0 },
                  minItems: 3,
                  maxItems: 3,
                },
                profile: {
                  type: 'string',
                  enum: ['balanced', 'fast', 'restricted'],
                },
              },
              required: ['lessonId', 'choices'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input) {
              if (!input || typeof input !== 'object' || Array.isArray(input))
                throw new Error('입력 객체가 필요합니다.');
              const d = input as Record<string, unknown>;
              if (
                Object.keys(d).some(
                  (k) => !['lessonId', 'choices', 'profile'].includes(k),
                ) ||
                typeof d.lessonId !== 'string' ||
                !Array.isArray(d.choices)
              )
                throw new Error('입력 형식이 잘못됐습니다.');
              const id = d.lessonId,
                choices = d.choices as number[],
                profile = (d.profile ?? 'balanced') as Profile;
              simulate(id, choices, profile);
              let response;
              flushSync(() => {
                const r = executeRef.current(id, choices, profile, 'practice');
                response = {
                  lessonId: id,
                  passed: r.passed,
                  total: r.cases.length,
                  risks: r.risks,
                  units: r.units,
                  goal: r.goal,
                  simulation: true,
                };
              });
              return response;
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Manual UI remains available. */
    }
    return () => lifecycle.abort();
  }, []);
  const review = reviewQuestion(lesson.id);
  return (
    <>
      <Sidebar>
        <SidebarHeader className="p-6">
          <a className="brand" href="/">
            <span className="brand-icon">
              <FlaskConical size={22} />
            </span>
            <span>
              AI Native<span className="brand-small">LEARNING LAB 02</span>
            </span>
          </a>
        </SidebarHeader>
        <SidebarContent className="px-3">
          <a
            href="/business"
            className="objective"
            style={{ margin: '8px 0', fontSize: 14 }}
          >
            <GitBranch size={20} />
            <span>
              업무 자동화 실습
              <br />
              <strong>고객 문의 → 승인 → 인계</strong>
            </span>
          </a>
          <div className="nav-caption">
            설계하고 검증하기 <span>10 LABS</span>
          </div>
          <SidebarMenu>
            {catalog.map((l, i) => (
              <SidebarMenuItem key={l.id}>
                <SidebarMenuButton
                  isActive={lesson.id === l.id}
                  className="lesson-nav"
                  onClick={() => select(l.id)}
                >
                  <span
                    className={
                      'nav-number ' +
                      (completed(l.id, state.lessons[l.id]) ? 'done' : '')
                    }
                  >
                    {completed(l.id, state.lessons[l.id]) ? (
                      <Check size={15} />
                    ) : (
                      String(i + 1).padStart(2, '0')
                    )}
                  </span>
                  <span className="nav-copy">
                    <span>{l.short}</span>
                    <small>
                      {['rag', 'evals'].includes(l.id)
                        ? '심화 실험 · 근거 분석'
                        : l.tag}
                    </small>
                  </span>
                  {lesson.id === l.id && <ChevronRight size={16} />}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-5">
          <div className="progress-label">
            <span>실습·복습 완료</span>
            <strong>
              {count} / {catalog.length}
            </strong>
          </div>
          <Progress
            value={(count / catalog.length) * 100}
            className="h-1.5"
            aria-label="학습 완료율"
          />
          <p
            className={'micro ' + (blocked ? 'storage-warning' : '')}
            role="status"
          >
            {storageStatus}
          </p>
          <p className="micro">
            기기 간 동기화 없음 · 민감정보는 기록하지 마세요.
          </p>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <SidebarTrigger className="md:hidden" />
            <span>워크스페이스</span>
            <ChevronRight size={14} />
            <strong>AI Native 실전 기초</strong>
          </div>
          <span className="live-label">
            <span />
            교육 데이터 · API 호출 없음
          </span>
        </header>
        <div className="page-content">
          <section className="quick-start" aria-label="실습 사용 방법">
            <div>
              <strong>
                여기서 하는 일: AI의 답변 조건을 바꾸고 결과 비교하기
              </strong>
              <p>
                ① 기본 설계 실행 → ② 실패 사례 펼치기 → ③ 선택지 변경 후 다시
                실행. 실제 AI 채팅이나 자유로운 노드 편집기는 아닙니다.
              </p>
            </div>
            <button
              className="primary-button"
              disabled={!ready}
              onClick={() => execute(lesson.id, values, s.profile, 'practice')}
            >
              {result ? '현재 설계로 다시 실행' : '첫 실험 실행하기'}
            </button>
            <a href="/business">고객 문의를 직접 승인하는 업무 실습 →</a>
          </section>
          <div className="lesson-heading">
            <div>
              <div className="eyebrow">
                LAB {String(index + 1).padStart(2, '0')} /{' '}
                {lesson.tag.toUpperCase()}
              </div>
              <h1>{lesson.title}</h1>
              <p>{lesson.description}</p>
            </div>
            <span className="level-pill">
              {deep ? '심화 실험' : '설계 실험'}
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
                    설계 흐름 · 아래 선택지를 바꿔보세요
                  </span>
                  <span className="micro">
                    {deep ? '근거와 판정을 직접 대조' : '작성된 정책 시나리오'}
                  </span>
                </div>
                <div className="interactive-flow">
                  {lesson.controls.map((c, ci) => (
                    <div className="interactive-node" key={c.label}>
                      <label htmlFor={`flow-${ci}`}>
                        단계 {ci + 1} · {c.label}
                      </label>
                      <NativeSelect
                        id={`flow-${ci}`}
                        aria-label={`흐름: ${c.label}`}
                        value={String(values[ci])}
                        onChange={(e) =>
                          patch({
                            choices: values.map((v, i) =>
                              i === ci ? Number(e.target.value) : v,
                            ),
                          })
                        }
                      >
                        {c.options.map((o, oi) => (
                          <NativeSelectOption value={String(oi)} key={o.label}>
                            {o.label}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <p>{c.options[values[ci]].description}</p>
                    </div>
                  ))}
                </div>
                <div className="context-strip">
                  <Database size={16} />
                  {lesson.controls.slice(1).map((c, i) => (
                    <span key={c.label}>
                      {c.label} ·{' '}
                      <strong>{c.options[values[i + 1]].label}</strong>
                    </span>
                  ))}
                </div>
                <div className="canvas-footer">
                  <span>
                    <span className="status-dot" />
                    합성 데이터 · 규칙으로 재현되는 결과
                  </span>
                  <span>ENGINE / 2.0</span>
                </div>
              </div>
              <div ref={resultRef} className="execution-next" role="status">
                {stale
                  ? '설계가 변경됐습니다. 다시 실행하면 아래 결과가 바뀝니다.'
                  : result
                    ? `실행 완료: ${result.passed}/${result.cases.length} 성공. 아래 사례에서 근거를 확인하세요.`
                    : '위에서 첫 실험을 실행하면 사례별 결과가 여기에 나타납니다.'}
                {stale && (
                  <button
                    className="text-action"
                    onClick={() =>
                      execute(lesson.id, values, s.profile, 'practice')
                    }
                  >
                    변경한 설계 실행 →
                  </button>
                )}
              </div>
              <Tabs
                value={tab}
                onValueChange={(v) => setTab(String(v))}
                className="result-tabs"
              >
                <TabsList variant="line" className="tabbar">
                  <TabsTrigger value="results">
                    <Terminal size={16} />
                    실험·근거
                  </TabsTrigger>
                  <TabsTrigger value="learn">
                    <BookOpen size={16} />
                    개념 노트
                  </TabsTrigger>
                  <TabsTrigger value="quiz">
                    <CircleHelp size={16} />
                    확인·복습
                  </TabsTrigger>
                  <TabsTrigger value="history">
                    <History size={16} />
                    기록 {s.history.length}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="results">
                  <div className="results-head">
                    <div>
                      <h2>
                        {result
                          ? result.goal
                            ? '업무 조건을 충족했어요'
                            : '실행 근거에서 개선 지점을 찾으세요'
                          : '설계를 실행하고 판단 근거를 확인하세요'}
                      </h2>
                      <p>
                        {stale
                          ? '표시된 결과는 이전 설계입니다. 현재 변수로 다시 실행하세요.'
                          : result
                            ? `${activeRun?.suite === 'review' ? '검증 문제' : '연습 문제'} · ${new Date(activeRun!.at).toLocaleString('ko-KR')} · ${lesson.id === 'rag' ? profiles.find((p) => p.id === activeRun?.profile)?.label : '기본 업무 조건'}`
                            : '실행 후 각 사례를 펼치면 기대 행동, 응답, 단계별 기록과 근거를 볼 수 있습니다.'}
                      </p>
                    </div>
                  </div>
                  {result && (
                    <>
                      <div className="metric-grid">
                        <div>
                          <small>
                            {lesson.id === 'evals'
                              ? '평가 판정 일치'
                              : '업무 성공'}
                          </small>
                          <strong>
                            {result.passed}
                            <span> / {result.cases.length}</span>
                          </strong>
                        </div>
                        <div className={result.risks ? 'metric-risk' : ''}>
                          <small>위험 사례</small>
                          <strong>
                            {result.risks}
                            <span> 건</span>
                          </strong>
                        </div>
                        <div
                          className={
                            result.units > result.budget ? 'metric-risk' : ''
                          }
                        >
                          <small>교육용 작업 단위</small>
                          <strong>
                            {result.units}
                            <span> / {result.budget}</span>
                          </strong>
                        </div>
                      </div>
                      <details className="assumption">
                        <summary>
                          작업 단위와 성공 조건은 어떻게 계산하나요?
                        </summary>
                        <p>
                          실제 비용·시간·토큰이 아닙니다. RAG: 사례당 키워드 1 /
                          의미 2 / 하이브리드 3단위 + 필터 1단위. 평가: 포함된
                          사례당 기본 1 / 업무 기준 2단위 + 치명적 실패 검사
                          1단위. 다른 실험: 사례당 기본 1 + 관련 조건 수. 모든
                          사례가 기대 행동에 맞고 위험 0건이며 예산 이내일 때
                          목표를 충족합니다.
                        </p>
                      </details>
                      {comparison && (
                        <div className="compare-card">
                          <label htmlFor="baseline">비교 기준</label>
                          <NativeSelect
                            id="baseline"
                            value={compareRun?.id}
                            onChange={(e) => setBaseline(e.target.value)}
                          >
                            {s.history
                              .filter((r) => r.id !== activeRun?.id)
                              .map((r, i) => (
                                <NativeSelectOption key={r.id} value={r.id}>
                                  {new Date(r.at).toLocaleTimeString('ko-KR')} ·{' '}
                                  {r.suite === 'review' ? '검증' : '연습'} ·
                                  기록 {s.history.length - i}
                                </NativeSelectOption>
                              ))}
                          </NativeSelect>
                          <p>
                            {comparable
                              ? `업무 성공 ${comparison.passed} → ${result.passed} · 위험 ${comparison.risks} → ${result.risks} · 작업 단위 ${comparison.units} → ${result.units}`
                              : '업무 조건 또는 문제 세트가 달라 직접적인 개선 비교는 할 수 없습니다.'}
                          </p>
                          <div className="config-diff">
                            {lesson.controls.map((c, i) => (
                              <span key={c.label}>
                                {c.label}:{' '}
                                {c.options[compareRun!.choices[i]].label} →{' '}
                                {c.options[activeRun!.choices[i]].label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <div className="test-list" aria-live="polite">
                    {result
                      ? result.cases.map((c, i) => (
                          <details
                            className="case-detail"
                            key={`${activeRun?.id}-${i}`}
                            open={undefined}
                          >
                            <summary>
                              <span
                                className={
                                  'test-marker ' + (c.pass ? 'pass' : 'fail')
                                }
                              >
                                {c.pass ? <Check size={15} /> : '!'}
                              </span>
                              <span>
                                <strong>{c.name}</strong>
                                <small>{c.input}</small>
                              </span>
                              <span className="case-status">
                                {c.pass ? '일치' : '개선 필요'}{' '}
                                <ChevronRight size={14} />
                              </span>
                            </summary>
                            <div className="case-body">
                              <div className="answer-pair">
                                <div>
                                  <span>기대 행동</span>
                                  <p>{c.expected}</p>
                                </div>
                                <div>
                                  <span>실제 결과</span>
                                  <p>{c.actual}</p>
                                </div>
                              </div>
                              <h3>
                                실행 기록{' '}
                                <small>
                                  내부 사고 과정이 아닌 관측 가능한 단계
                                </small>
                              </h3>
                              <ol className="trace-list">
                                {c.trace.map((t, j) => (
                                  <li key={j} className={t.status}>
                                    <span>
                                      {String(j + 1).padStart(2, '0')}
                                    </span>
                                    <div>
                                      <strong>{t.stage}</strong>
                                      <p>{t.detail}</p>
                                    </div>
                                  </li>
                                ))}
                              </ol>
                              <h3>근거 자료</h3>
                              <div className="evidence-list">
                                {c.evidence.map((d) => (
                                  <article
                                    key={d.id}
                                    className={
                                      d.selected ? 'selected-evidence' : ''
                                    }
                                  >
                                    <div>
                                      <strong>{d.title}</strong>
                                      <span>
                                        {d.excluded ??
                                          (d.selected ? '사용된 근거' : '후보')}
                                      </span>
                                    </div>
                                    <p>{d.text}</p>
                                    <small>
                                      {d.id}
                                      {lesson.id === 'rag'
                                        ? ` · 고정 관련도 ${d.score.toFixed(2)}`
                                        : ''}
                                    </small>
                                  </article>
                                ))}
                              </div>
                              <p className="case-hint">
                                <Sparkles size={16} />
                                {c.hint}
                              </p>
                            </div>
                          </details>
                        ))
                      : lesson.tests.map((t, i) => (
                          <article className="test-row" key={t.name}>
                            <span className="test-marker">{i + 1}</span>
                            <div>
                              <h3>{t.name}</h3>
                              <p className="test-input">{t.input}</p>
                            </div>
                          </article>
                        ))}
                  </div>
                  {result && (
                    <div className="run-note">
                      <strong>이 실행의 설계 이유</strong>
                      <p>
                        {activeRun?.note ||
                          '기록한 이유가 없습니다. 다음 실행 전에 가설과 실행 영역에 이유를 적어보세요.'}
                      </p>
                    </div>
                  )}
                  <div className="results-foot">
                    <span>
                      결과는 교육용 가정입니다. 실제 모델 성능을 보장하지
                      않습니다.
                    </span>
                    {result?.goal && !stale && (
                      <button
                        className="text-action"
                        onClick={() => setTab('quiz')}
                      >
                        이해도 확인과 복습 <ArrowRight size={15} />
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
                      더 읽기 · {lesson.source.label}
                      <ArrowRight size={15} />
                    </a>
                    <p className="micro">
                      자료를 읽은 뒤 핵심 개념을 현재 실험의 실패 사례에
                      연결해보세요.
                    </p>
                    {lesson.id === 'tools' && (
                      <div className="reading-note">
                        <h3>MCP는 도구 연결의 공통 규약</h3>
                        <p>
                          호스트·클라이언트·서버, 도구 목록과 입력 스키마, 결과
                          전달을 구분해보세요. 연결 규약이 권한 검사나 안전한
                          실행을 대신하지는 않습니다.
                        </p>
                        <a
                          className="source-link"
                          href="https://modelcontextprotocol.io/docs/learn/architecture"
                          target="_blank"
                          rel="noreferrer"
                        >
                          MCP 아키텍처 읽기 <ArrowRight size={15} />
                        </a>
                      </div>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="quiz">
                  <div className="quiz">
                    <div className="eyebrow">CHECK & TRANSFER</div>
                    <h2>{lesson.quiz.question}</h2>
                    <RadioGroup
                      value={s.answer}
                      onValueChange={(v) =>
                        patch({ answer: String(v), checked: false })
                      }
                      aria-label="이해도 선택지"
                    >
                      {lesson.quiz.options.map((o, i) => (
                        <label
                          key={o}
                          className={
                            'quiz-option ' +
                            (s.answer === String(i) ? 'selected' : '')
                          }
                        >
                          <RadioGroupItem value={String(i)} />
                          {o}
                        </label>
                      ))}
                    </RadioGroup>
                    <button
                      className="primary-button"
                      disabled={!s.answer}
                      onClick={() => patch({ checked: true })}
                    >
                      정답 확인 <ArrowRight size={16} />
                    </button>
                    {s.checked && (
                      <div
                        className={
                          'quiz-feedback ' +
                          (s.answer === String(lesson.quiz.correct)
                            ? 'correct'
                            : '')
                        }
                        role="status"
                      >
                        <strong>
                          {s.answer === String(lesson.quiz.correct)
                            ? '정확해요.'
                            : '다시 생각해보세요.'}
                        </strong>
                        <p>{lesson.quiz.explanation}</p>
                      </div>
                    )}
                    <section className="review-section">
                      <h2>새로운 상황에 적용하기</h2>
                      {deep ? (
                        <>
                          <p>
                            연습 문제와 표현이 다른 검증 질문으로 같은 설계를
                            평가합니다. 최초 실행 전에는 내용을 보여주지
                            않습니다. 교육용 고정 문제이며 보안상 비밀인
                            평가셋은 아닙니다.
                          </p>
                          <button
                            className="primary-button"
                            disabled={!canReview || s.note.trim().length < 12}
                            onClick={() =>
                              execute(lesson.id, values, s.profile, 'review')
                            }
                          >
                            검증 문제 실행 <ArrowRight size={16} />
                          </button>
                          <p className="micro">
                            현재 설계로 연습 목표를 충족하고 설계 이유를 12자
                            이상 기록하면 실행할 수 있습니다.
                          </p>
                        </>
                      ) : (
                        <>
                          <h3>{review.question}</h3>
                          <RadioGroup
                            value={s.reviewAnswer}
                            onValueChange={(v) =>
                              patch({
                                reviewAnswer: String(v),
                                reviewChecked: false,
                              })
                            }
                            aria-label="복습 선택지"
                          >
                            {review.options.map((o, i) => (
                              <label
                                className={
                                  'quiz-option ' +
                                  (s.reviewAnswer === String(i)
                                    ? 'selected'
                                    : '')
                                }
                                key={o}
                              >
                                <RadioGroupItem value={String(i)} />
                                {o}
                              </label>
                            ))}
                          </RadioGroup>
                          <button
                            className="primary-button"
                            disabled={!s.reviewAnswer}
                            onClick={() => patch({ reviewChecked: true })}
                          >
                            복습 정답 확인
                          </button>
                          {s.reviewChecked && (
                            <div className="quiz-feedback" role="status">
                              <strong>
                                {s.reviewAnswer === review.correct
                                  ? '새 상황에도 적용했어요.'
                                  : '새 상황의 차이를 살펴보세요.'}
                              </strong>
                              <p>{review.explanation}</p>
                            </div>
                          )}
                        </>
                      )}
                    </section>
                    <div className="completion-card">
                      <Check size={19} />
                      <div>
                        <strong>
                          {completed(lesson.id, s)
                            ? '이 실험의 학습과 복습을 완료했어요'
                            : '완료 조건'}
                        </strong>
                        <p>
                          설계 이유를 기록한 목표 충족 실행 + 이해도 정답 +{' '}
                          {deep ? '검증 문제 목표 충족' : '새 상황 복습 정답'}.
                          글자 수만 검사하며 서술의 타당성을 AI가 채점하지
                          않습니다.
                        </p>
                        {completed(lesson.id, s) && (
                          <button
                            className="text-action"
                            onClick={() =>
                              select(catalog[(index + 1) % catalog.length].id)
                            }
                          >
                            {index === catalog.length - 1
                              ? '첫 실험 다시 보기'
                              : '다음 실험으로'}{' '}
                            <ArrowRight size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="history">
                  <div className="notes">
                    <div className="eyebrow">EXPERIMENT JOURNAL</div>
                    <h2>이 실험의 기록 · 최근 20회</h2>
                    <button
                      className="text-action"
                      disabled={!s.history.length}
                      onClick={() => {
                        try {
                          setState(trashRuns(state, lesson.id));
                          setSelectedRun('');
                          setBaseline('');
                          setJournalNotice(
                            '기록을 휴지통으로 옮겼습니다. 아래에서 복원할 수 있습니다.',
                          );
                        } catch (e) {
                          setJournalNotice((e as Error).message);
                        }
                      }}
                    >
                      이 실험 기록 모두 삭제
                    </button>
                    <output className="execution-next">{journalNotice}</output>
                    <p className="micro">
                      기록을 열면 당시 설정·근거·판정을 확인할 수 있습니다. 설정
                      복원은 현재 변수만 바꾸며 기록은 삭제하지 않습니다.
                    </p>
                    {!s.history.length && (
                      <p className="journal-empty">
                        아직 실행 기록이 없습니다. 가설을 적고 첫 실험을
                        실행해보세요.
                      </p>
                    )}
                    {s.history.map((r) => {
                      const out = simulate(
                        lesson.id,
                        r.choices,
                        r.profile,
                        r.suite,
                      );
                      return (
                        <article className="journal-entry" key={r.id}>
                          <header>
                            <strong>
                              {r.suite === 'review' ? '검증' : '연습'} ·{' '}
                              {out.goal
                                ? '목표 충족'
                                : `${out.passed}/${out.cases.length} 일치`}
                            </strong>
                            <time>
                              {new Date(r.at).toLocaleString('ko-KR')}
                            </time>
                          </header>
                          <p>{r.note || '설계 이유 미작성'}</p>
                          <small>
                            {lesson.controls
                              .map((c, i) => c.options[r.choices[i]].label)
                              .join(' / ')}{' '}
                            · 작업 {out.units}/{out.budget}
                          </small>
                          <div className="journal-actions">
                            <button
                              className="text-action"
                              aria-label={`기록 삭제 ${r.id}`}
                              onClick={() => {
                                try {
                                  setState(trashRuns(state, lesson.id, r.id));
                                  setSelectedRun('');
                                  setBaseline('');
                                  setJournalNotice(
                                    '기록 1개를 휴지통으로 옮겼습니다.',
                                  );
                                } catch (e) {
                                  setJournalNotice((e as Error).message);
                                }
                              }}
                            >
                              삭제 · 휴지통으로
                            </button>
                            <button
                              className="text-action"
                              onClick={() => {
                                setSelectedRun(r.id);
                                setBaseline('');
                                setTab('results');
                              }}
                            >
                              근거 보기 <FileText size={15} />
                            </button>
                            <button
                              className="text-action"
                              onClick={() => {
                                patch({
                                  choices: [...r.choices],
                                  profile: r.profile,
                                });
                                setSelectedRun(r.id);
                                setTab('results');
                              }}
                            >
                              설정 복원 <RotateCcw size={15} />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    <details className="journal-trash">
                      <summary>
                        휴지통 {s.trash.length}개 · 삭제한 기록 복원
                      </summary>
                      <p>
                        삭제한 실행은 결과와 완료 판정에서 제외됩니다. 복원하면
                        다시 반영됩니다. 영구 삭제하지 않습니다.
                      </p>
                      {s.trash.map((r) => (
                        <div className="journal-entry" key={r.id}>
                          <span>
                            {new Date(r.at).toLocaleString('ko-KR')} ·{' '}
                            {r.note || '설계 이유 미작성'}
                          </span>
                          <button
                            className="text-action"
                            onClick={() => {
                              try {
                                setState(restoreRun(state, lesson.id, r.id));
                                setJournalNotice('기록을 복원했습니다.');
                              } catch (e) {
                                setJournalNotice((e as Error).message);
                              }
                            }}
                          >
                            기록 복원
                          </button>
                        </div>
                      ))}
                    </details>
                  </div>
                </TabsContent>
              </Tabs>
            </section>
            <aside className="design-panel">
              <div className="panel-title">
                <h2>
                  <FlaskConical size={18} />
                  가설과 실행
                </h2>
                <button
                  className="icon-button"
                  aria-label="현재 설계를 기본값으로 변경"
                  title="기록을 보존하고 변수만 초기화"
                  onClick={() => patch({ choices: [0, 0, 0] })}
                >
                  <RotateCcw size={16} />
                </button>
              </div>
              <p className="panel-intro">예측 → 실행 → 근거 확인 → 수정</p>
              {lesson.id === 'rag' && (
                <fieldset className="control task-profile">
                  <legend>업무 조건</legend>
                  <RadioGroup
                    aria-label="업무 조건"
                    value={s.profile}
                    onValueChange={(v) => patch({ profile: v as Profile })}
                  >
                    {profiles.map((p) => (
                      <label
                        className={
                          'design-option ' +
                          (s.profile === p.id ? 'selected' : '')
                        }
                        key={p.id}
                      >
                        <RadioGroupItem value={p.id} />
                        <span>
                          <strong>{p.label}</strong>
                          <small>{p.description}</small>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </fieldset>
              )}
              <div className="hypothesis">
                <label htmlFor="design-reason">왜 이 설계를 선택했나요?</label>
                <Textarea
                  id="design-reason"
                  value={s.note}
                  onChange={(e) =>
                    patch({ note: e.target.value.slice(0, 2000) })
                  }
                  maxLength={2000}
                  placeholder="예: 구버전이 선택된 것이 원인 같아 최신 문서 필터를 적용한다."
                />
                <small>완료 기록은 12자 이상 · {s.note.length}/2000</small>
              </div>
              <button
                className="run-button"
                disabled={!ready}
                onClick={() =>
                  execute(lesson.id, values, s.profile, 'practice')
                }
              >
                <Play size={16} fill="currentColor" />
                {ready ? '연습 실험 실행' : '기록 불러오는 중'}
                <kbd>RUN</kbd>
              </button>
              <p className="micro centered">
                실행 시 설정과 가설을 함께 기록합니다.
              </p>
            </aside>
          </div>
          <footer className="page-footer">
            <span>AI NATIVE LAB / 근거로 설명하고 실험으로 검증하기</span>
            <span>10개 실험 · 로컬 학습 기록 · 실제 AI 호출 없음</span>
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
