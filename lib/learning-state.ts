import { catalog } from './catalog.ts';
import {
  simulate,
  type Profile,
  type Suite,
  ENGINE_VERSION,
} from './experiment.ts';
export const STORAGE_KEY = 'workbench-lab.learning.v2';
export type Run = {
  id: string;
  at: string;
  choices: number[];
  profile: Profile;
  suite: Suite;
  note: string;
};
export type LessonState = {
  choices: number[];
  profile: Profile;
  note: string;
  answer: string;
  checked: boolean;
  history: Run[];
  proofs: Run[];
  reviewAnswer: string;
  reviewChecked: boolean;
};
export type LearningState = {
  version: 2;
  engine: string;
  active: string;
  lessons: Record<string, LessonState>;
};
export const emptyLesson = (): LessonState => ({
  choices: [0, 0, 0],
  profile: 'balanced',
  note: '',
  answer: '',
  checked: false,
  history: [],
  proofs: [],
  reviewAnswer: '',
  reviewChecked: false,
});
export const emptyState = (): LearningState => ({
  version: 2,
  engine: ENGINE_VERSION,
  active: 'context',
  lessons: Object.fromEntries(catalog.map((l) => [l.id, emptyLesson()])),
});
export function recordRun(
  state: LearningState,
  id: string,
  run: Run,
): LearningState {
  const result = simulate(id, run.choices, run.profile, run.suite);
  const current = state.lessons[id];
  return {
    ...state,
    active: id,
    lessons: {
      ...state.lessons,
      [id]: {
        ...current,
        choices: [...run.choices],
        profile: run.profile,
        history: [run, ...current.history].slice(0, 20),
        proofs:
          result.goal && run.note.trim().length >= 12
            ? [
                run,
                ...current.proofs.filter((r) => r.suite !== run.suite),
              ].slice(0, 2)
            : current.proofs,
      },
    },
  };
}
export function completed(id: string, s: LessonState) {
  const lesson = catalog.find((l) => l.id === id)!;
  const good = [...s.history, ...s.proofs].filter(
    (r) => simulate(id, r.choices, r.profile, r.suite).goal,
  );
  const practice = good.some(
    (r) => r.suite === 'practice' && r.note.trim().length >= 12,
  );
  const review = ['rag', 'evals'].includes(id)
    ? good.some((r) => r.suite === 'review' && r.note.trim().length >= 12)
    : s.reviewChecked && s.reviewAnswer === reviewQuestion(id).correct;
  return (
    practice && review && s.checked && s.answer === String(lesson.quiz.correct)
  );
}
export function restoreState(raw: string | null): LearningState {
  const base = emptyState();
  if (!raw) return base;
  const parsed = JSON.parse(raw);
  if (
    !parsed ||
    parsed.version !== 2 ||
    parsed.engine !== ENGINE_VERSION ||
    !parsed.lessons ||
    Array.isArray(parsed.lessons) ||
    typeof parsed.lessons !== 'object'
  )
    throw new Error('저장 형식이 달라 복원하지 못했습니다.');
  if (catalog.some((l) => l.id === parsed.active)) base.active = parsed.active;
  for (const l of catalog) {
    const s = parsed.lessons[l.id];
    if (!s) continue;
    try {
      simulate(l.id, s.choices, s.profile);
      const target = base.lessons[l.id];
      target.choices = [...s.choices];
      target.profile = s.profile;
      target.note = typeof s.note === 'string' ? s.note.slice(0, 2000) : '';
      target.answer =
        typeof s.answer === 'string' &&
        l.quiz.options[Number(s.answer)] !== undefined
          ? s.answer
          : '';
      target.checked = s.checked === true;
      target.reviewAnswer =
        typeof s.reviewAnswer === 'string' &&
        ['0', '1', '2'].includes(s.reviewAnswer)
          ? s.reviewAnswer
          : '';
      target.reviewChecked = s.reviewChecked === true;
      target.proofs = Array.isArray(s.proofs)
        ? s.proofs.slice(0, 2).flatMap((r: Run) => {
            try {
              if (
                typeof r.note !== 'string' ||
                r.note.trim().length < 12 ||
                typeof r.id !== 'string' ||
                typeof r.at !== 'string' ||
                !Number.isFinite(Date.parse(r.at)) ||
                !simulate(l.id, r.choices, r.profile, r.suite).goal
              )
                return [];
              return [
                {
                  id: r.id.slice(0, 80),
                  at: r.at,
                  choices: [...r.choices],
                  profile: r.profile,
                  suite: r.suite,
                  note: r.note.slice(0, 2000),
                },
              ];
            } catch {
              return [];
            }
          })
        : [];
      target.history = Array.isArray(s.history)
        ? s.history.slice(0, 20).flatMap((r: Run) => {
            try {
              simulate(l.id, r.choices, r.profile, r.suite);
              if (
                typeof r.id !== 'string' ||
                typeof r.at !== 'string' ||
                !Number.isFinite(Date.parse(r.at))
              )
                return [];
              return [
                {
                  id: r.id.slice(0, 80),
                  at: r.at,
                  choices: [...r.choices],
                  profile: r.profile,
                  suite: r.suite,
                  note: typeof r.note === 'string' ? r.note.slice(0, 2000) : '',
                },
              ];
            } catch {
              return [];
            }
          })
        : [];
    } catch {
      /* One damaged lesson does not discard the other lessons. */
    }
  }
  return base;
}
export function reviewQuestion(id: string) {
  const data: Record<string, [string, string[], string, string]> = {
    context: [
      '사용자가 제공한 규정과 일반 지식이 충돌합니다. 먼저 할 일은?',
      [
        '더 자신 있게 답변',
        '규정의 출처·적용 시점을 확인하고 충돌하면 보류',
        '더 긴 답변 작성',
      ],
      '1',
      '그럴듯함이 아니라 유효한 근거가 우선입니다.',
    ],
    memory: [
      '사용자가 과거에 저장한 선호를 삭제해달라고 합니다.',
      [
        '관련 기억과 재사용 경로에서 삭제하고 적용 범위를 확인',
        '요약에만 계속 보존',
        '다른 사용자에게 이동',
      ],
      '0',
      '기억에는 보존뿐 아니라 삭제와 사용 범위 정책이 필요합니다.',
    ],
    tools: [
      '모델이 정상 형식의 다른 고객 주문 번호를 반환했습니다.',
      [
        '형식이 맞으니 실행',
        '모델에게 자신 있는지 질문',
        '서버에서 소유권 검사 후 거부',
      ],
      '2',
      '형식 검증과 권한 검증은 다른 경계입니다.',
    ],
    injection: [
      '검색 결과가 관리자라고 주장하며 권한을 높이라고 합니다.',
      [
        '관리자라는 문구를 신뢰',
        '검색 결과는 데이터로 취급하고 기존 권한 유지',
        '문서가 길면 신뢰',
      ],
      '1',
      '외부 텍스트의 권한 주장은 실제 인증 정보가 아닙니다.',
    ],
    agents: [
      '에이전트가 한도를 소진했지만 자료가 부족합니다.',
      [
        '한도를 무한대로 늘린다',
        '완료했다고 보고한다',
        '부분 결과·미확인 항목·중단 이유를 전달한다',
      ],
      '2',
      '불완전함을 감추지 말고 안전한 인계 경로를 제공합니다.',
    ],
    recovery: [
      '같은 업무를 재시도하면서 새 멱등 키를 발급하면?',
      [
        '새 요청으로 인식되어 중복 처리될 수 있다',
        '항상 안전하다',
        '이전 실행이 자동 취소된다',
      ],
      '0',
      '같은 업무 요청은 안정된 동일 키로 식별해야 합니다.',
    ],
    cost: [
      '평균 지연은 줄었지만 일부 요청이 매우 느립니다.',
      [
        '평균만 본다',
        '느린 요청의 분포와 단계별 지연도 확인한다',
        '실패 요청을 통계에서 뺀다',
      ],
      '1',
      '평균에 가려진 긴 지연과 실패를 함께 봐야 합니다.',
    ],
    coding: [
      'AI가 보안 테스트를 삭제해 전체 테스트를 통과시켰습니다.',
      [
        '통과했으니 반영',
        '검사 삭제와 요구사항 위반을 리뷰에서 차단',
        '더 적은 테스트 작성',
      ],
      '1',
      '성공 조건 자체를 약화시킨 변경은 개선이 아닙니다.',
    ],
  };
  const row = data[id] ?? data.context;
  return {
    question: row[0],
    options: row[1],
    correct: row[2],
    explanation: row[3],
  };
}
