export const GUIDE_KEY = 'ai-native-guided-v1';
export const lessons = [
  {
    title: '고객 답변을 확인하고 보내기',
    goal: '규정에 맞는 답변인지 확인하고 연습 발송합니다.',
    question: '어제 결제한 주문 A-101의 영수증이 필요해요.',
    policy:
      '영수증은 계정의 결제 내역에서 내려받을 수 있습니다. 결제 취소는 별도 심사가 필요합니다.',
    draft:
      '안녕하세요. 주문 A-101의 영수증은 계정의 결제 내역에서 내려받으실 수 있습니다.',
    check: '영수증을 받는 방법이 규정과 일치합니다.',
    why: 'AI의 제안을 바로 실행하지 않고 사람이 확인하는 지점을 배웠습니다.',
    quiz: '이 업무에서 사람의 확인이 필요한 이유는 무엇인가요?',
    answers: [
      'AI 답변이 언제나 정확하기 때문에',
      '틀린 안내가 고객에게 전달되는 것을 막기 위해',
    ],
    correct: 1,
  },
  {
    title: '잘못된 답변 찾아 수정하기',
    goal: '이미 폐기된 환불 규정을 찾아 답변을 고칩니다.',
    question: '주문 A-105가 20일 지났어요. 예전 안내대로 무조건 환불되나요?',
    policy:
      '현재 규정은 14일 이내 신청 후 심사입니다. 예전의 30일 무조건 환불 규정은 폐기되었습니다. 기간이 지난 문의는 담당자가 검토합니다.',
    draft: '30일 이내에는 무조건 환불됩니다. 환불을 확정해드리겠습니다.',
    check: '무조건 환불 약속을 지우고 담당자 검토를 안내했습니다.',
    why: '문장이 자연스러워도 오래된 규정을 사용하면 업무에 실패한다는 점을 배웠습니다.',
    quiz: '이 답변의 문제를 찾으려면 무엇을 비교해야 하나요?',
    answers: ['현재 적용되는 규정과 답변 내용', '답변 길이와 말투만'],
    correct: 0,
  },
  {
    title: '정보가 부족한 문의 넘기기',
    goal: '확인되지 않은 환불을 약속하지 않고 담당자에게 전달합니다.',
    question: '결제 취소해주세요. 주문번호는 모르겠어요.',
    policy:
      '주문 확인 전 취소·환불을 약속하지 않습니다. 고객지원 담당자가 주문번호를 확인해야 합니다. 카드 비밀번호는 수집하지 않습니다.',
    draft:
      '주문번호를 확인할 수 없어 환불을 확정하지 않았습니다. 고객지원 담당자의 주문 확인이 필요합니다.',
    check: '환불을 약속하지 않고 주문 확인이 필요함을 확인했습니다.',
    why: '자동화의 성공에는 답변 발송뿐 아니라 안전하게 멈추고 사람에게 넘기는 것도 포함됩니다.',
    quiz: '담당자에게 넘긴 뒤 고객 문제가 해결된 상태인가요?',
    answers: [
      '아니요. 담당자의 주문 확인과 후속 처리가 남아 있습니다.',
      '네. 자동화가 멈췄으니 해결 완료입니다.',
    ],
    correct: 0,
  },
] as const;
export type Attempt = {
  step: number;
  draft: string;
  checked: boolean;
  answer: number | null;
  done: boolean;
  outcome: string;
};
export type Guide = { version: 1; selected: number; attempts: Attempt[] };
export const emptyGuide = (): Guide => ({
  version: 1,
  selected: 0,
  attempts: lessons.map((l) => ({
    step: 0,
    draft: l.draft,
    checked: false,
    answer: null,
    done: false,
    outcome: '',
  })),
});
export function restoreGuide(raw: string | null): Guide {
  if (!raw) return emptyGuide();
  const x = JSON.parse(raw);
  if (
    x?.version !== 1 ||
    !Number.isInteger(x.selected) ||
    x.selected < 0 ||
    x.selected >= lessons.length ||
    !Array.isArray(x.attempts) ||
    x.attempts.length !== lessons.length
  )
    throw new Error('저장 형식을 읽을 수 없습니다.');
  for (const a of x.attempts) {
    if (
      !a ||
      !Number.isInteger(a.step) ||
      a.step < 0 ||
      a.step > 4 ||
      typeof a.draft !== 'string' ||
      a.draft.length > 4000 ||
      typeof a.checked !== 'boolean' ||
      typeof a.done !== 'boolean' ||
      typeof a.outcome !== 'string' ||
      ![null, 0, 1].includes(a.answer)
    )
      throw new Error('저장 기록을 확인할 수 없습니다.');
  }
  return x;
}
export function advanceAttempt(a: Attempt, lesson: number): Attempt {
  if (a.step === 2 && (!a.checked || a.draft.trim().length < 10)) return a;
  if (a.step >= 4) return a;
  return {
    ...a,
    step: a.step + 1,
    outcome:
      a.step === 3
        ? lesson === 2
          ? '고객지원 담당자에게 전달됨 · 고객 문제 해결 전'
          : '연습 발송 완료 · 실제 전송 0건'
        : a.outcome,
  };
}
