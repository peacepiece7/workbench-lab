'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Download,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  BUSINESS_KEY,
  MODES,
  modeNames,
  requests,
  teams,
  statusNames,
  emptyBusiness,
  restoreBusiness,
  replay,
  transition,
  metrics,
  report,
  type BusinessState,
  type Mode,
  type Action,
  type Ticket,
  type Team,
} from '@/lib/business';
import './business.css';

function Review({
  ticket,
  mode,
  dispatch,
}: {
  ticket: Ticket;
  mode: Mode;
  dispatch: (action: Action) => void;
}) {
  const [draft, setDraft] = useState(ticket.draft);
  const [team, setTeam] = useState<Team>(ticket.team);
  const [reason, setReason] = useState(ticket.reason);
  const editable = ticket.status === 'pending' || ticket.status === 'blocked';
  const input = requests.find((r) => r.id === ticket.id)!;
  return (
    <article
      className="business-card review-panel"
      aria-labelledby="review-title"
    >
      <div className="business-row">
        <h2 id="review-title">{ticket.id} 검토</h2>
        <span className="business-tag">{statusNames[ticket.status]}</span>
      </div>
      <section>
        <h3>1. 고객 입력</h3>
        <blockquote>{input.text}</blockquote>
        <p className="business-muted">
          주문번호: {input.order || '누락'} · 고객 입력은 실행 명령이 아닌 검토
          대상입니다.
        </p>
      </section>
      <section>
        <h3>2. 판단 근거</h3>
        <p className="business-evidence">{input.evidence}</p>
        <p className="business-muted">
          평가 기준 팀: {input.expected} · 교육용 기준을 공개합니다.
        </p>
      </section>
      <section className="business-form">
        <h3>3. 사람이 확인하고 결정하기</h3>
        <p className="business-muted">
          승인·반려하면 저장됩니다. 확정 전 입력은 다른 문의나 처리 방식으로
          이동하면 초기화됩니다.
        </p>
        <label htmlFor="review-team">담당 팀</label>
        <NativeSelect
          id="review-team"
          value={team}
          disabled={!editable}
          onChange={(e) => setTeam(e.target.value as Team)}
        >
          {teams.map((t) => (
            <NativeSelectOption key={t}>{t}</NativeSelectOption>
          ))}
        </NativeSelect>
        <label htmlFor="review-draft">
          답변 초안 · 승인 뒤에는 변경할 수 없습니다
        </label>
        <Textarea
          id="review-draft"
          value={draft}
          disabled={!editable}
          maxLength={4000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="근거에 맞는 답변을 직접 작성하거나 초안을 수정하세요."
          rows={4}
        />
        <label htmlFor="review-reason">검토 사유 · 최소 5자</label>
        <Textarea
          id="review-reason"
          value={reason}
          disabled={!editable}
          maxLength={1000}
          onChange={(e) => setReason(e.target.value)}
          placeholder="어떤 근거로 승인하거나 수동 인계하나요?"
          rows={2}
        />
        {editable ? (
          <>
            <p className="business-muted">
              {ticket.status === 'blocked'
                ? '정보 누락·보안 문의는 승인할 수 없습니다. 필요한 후속 조치를 사유에 적고 반려하여 수동 담당자에게 인계하세요.'
                : '정책과 담당 팀을 확인하세요. 글자 수는 검사하지만 답변의 의미적 정확성을 자동 채점하지는 않습니다.'}
            </p>
            <div className="business-actions">
              <Button
                disabled={
                  ticket.status === 'blocked' ||
                  draft.trim().length < 10 ||
                  reason.trim().length < 5
                }
                onClick={() =>
                  dispatch({
                    type: 'review',
                    mode,
                    id: ticket.id,
                    decision: 'approve',
                    draft,
                    team,
                    reason,
                  })
                }
              >
                <Check size={16} />
                승인 · 발송은 다음 단계
              </Button>
              <Button
                variant="outline"
                disabled={reason.trim().length < 5}
                onClick={() =>
                  dispatch({
                    type: 'review',
                    mode,
                    id: ticket.id,
                    decision: 'reject',
                    draft,
                    team,
                    reason,
                  })
                }
              >
                반려 · 수동 인계
              </Button>
            </div>
          </>
        ) : (
          <p className="business-muted">
            검토가 확정되었습니다. 반려는 고객 문제 해결 완료가 아니라 수동
            인계입니다.
          </p>
        )}
      </section>
      <section>
        <h3>4. 모의 발송과 복구</h3>
        <p className="business-muted">
          실제 메일을 보내지 않습니다. 장애 실험은 발송 성공 후 응답만 유실되는
          상황입니다.
        </p>
        <div className="business-actions">
          <Button
            disabled={!['approved', 'retry', 'sent'].includes(ticket.status)}
            onClick={() =>
              dispatch({ type: 'send', mode, id: ticket.id, loseAck: false })
            }
          >
            {ticket.status === 'approved' ? '모의 발송' : '같은 요청 재시도'}
          </Button>
          <Button
            variant="outline"
            disabled={ticket.status !== 'approved'}
            onClick={() =>
              dispatch({ type: 'send', mode, id: ticket.id, loseAck: true })
            }
          >
            응답 유실 장애로 발송
          </Button>
        </div>
      </section>
      <details open>
        <summary>실행 기록 · {ticket.trace.length}단계</summary>
        <ol className="business-trace">
          {ticket.trace.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </details>
    </article>
  );
}

export default function BusinessPage() {
  const [state, setState] = useState<BusinessState>(emptyBusiness);
  const [ready, setReady] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [notice, setNotice] = useState('기록을 불러오고 있습니다.');
  const [mode, setMode] = useState<Mode>('ai');
  const [selected, setSelected] = useState('CS-101');
  useEffect(() => {
    try {
      // oxlint-disable-next-line react/react-compiler -- Hydrate browser-only storage after SSR; the ready guard prevents overwriting it.
      setState(restoreBusiness(localStorage.getItem(BUSINESS_KEY)));
      setNotice('이 브라우저에만 자동 저장 · 기초 실습 기록과 별도');
    } catch {
      setStorageBlocked(true);
      setNotice(
        '저장 기록을 읽지 못했습니다. 원본은 보존하며 이번 세션에서만 진행합니다.',
      );
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || storageBlocked) return;
    try {
      localStorage.setItem(BUSINESS_KEY, JSON.stringify(state));
    } catch {
      // oxlint-disable-next-line react/react-compiler -- A storage failure disables subsequent writes and exposes the recovery state once.
      setStorageBlocked(true);
      setNotice(
        '저장 공간 또는 권한 문제로 이번 세션에서만 진행합니다. 보고서를 내려받아 보관하세요.',
      );
    }
  }, [state, ready, storageBlocked]);
  const runs = replay(state.actions);
  const run = runs[mode];
  const ticket = run?.tickets.find((t) => t.id === selected);
  function dispatch(action: Action) {
    try {
      if (state.actions.length >= 500)
        throw new Error(
          '학습 기록 한도에 도달했습니다. 보고서를 내려받아 보관하세요.',
        );
      const next = transition(runs[action.mode], action);
      if (next === runs[action.mode]) {
        setNotice(
          '기존 처리 기록을 확인했습니다. 티켓과 발송은 추가되지 않았습니다.',
        );
        return;
      }
      setState((s) => ({ ...s, actions: [...s.actions, action] }));
      setNotice(
        action.type === 'start'
          ? '6개 접수 이벤트를 처리했습니다. 중복 1건을 제외한 문의 5건을 검토하세요.'
          : '처리 결과와 실행 기록을 갱신했습니다.',
      );
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : '처리하지 못했습니다.',
      );
    }
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([report(state)], { type: 'text/markdown;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer-support-process-report.md';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="business-page">
      <header className="business-header">
        <Link href="/" className="business-back">
          <ArrowLeft size={17} />
          기초 실습 10개
        </Link>
        <span>
          <ShieldCheck size={16} />
          합성 데이터 · 외부 전송 없음
        </span>
      </header>
      <div className="business-heading">
        <div>
          <p className="eyebrow">BUSINESS PROCESS LAB / 01</p>
          <h1>고객 문의를 업무 흐름으로 바꾸기</h1>
          <p>AI가 초안을 제안하고, 규칙이 실행을 막고, 사람이 승인합니다.</p>
        </div>
        <BriefcaseBusiness size={36} aria-hidden="true" />
      </div>
      <section className="business-brief" aria-label="업무 브리프">
        <div>
          <h2>업무 상황</h2>
          <p>
            교육용 SaaS 고객지원팀. 문의를 읽고 담당 팀을 찾느라 대응이 늦어지고
            있습니다.
          </p>
        </div>
        <div>
          <h2>이번 목표</h2>
          <p>
            6개 접수 이벤트 → 문의 5건. 올바르게 인계하고 승인 없이 발송하지
            않기.
          </p>
        </div>
        <div>
          <h2>성공 기준</h2>
          <p>
            미처리 0건 · 승인된 오배정 0건 · 중복 발송 0건. 반려 사유와 후속
            담당자를 남기세요.
          </p>
        </div>
      </section>
      <ol className="business-flow" aria-label="업무 단계">
        {[
          '접수·중복 검사',
          '정보·권한 확인',
          '분류·초안',
          '사람 승인',
          '발송·복구',
        ].map((s, i) => (
          <li key={s}>
            <span>{i + 1}</span>
            {s}
            {i < 4 && <ArrowRight size={16} aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <section className="business-toolbar" aria-label="처리 방식 선택">
        <div>
          <label htmlFor="business-mode">처리 방식</label>
          <NativeSelect
            id="business-mode"
            value={mode}
            disabled={!ready}
            onChange={(e) => setMode(e.target.value as Mode)}
          >
            {MODES.map((m) => (
              <NativeSelectOption key={m} value={m}>
                {modeNames[m]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <p>
          {mode === 'manual'
            ? '근거를 읽고 분류와 답변을 직접 작성합니다.'
            : mode === 'rules'
              ? '키워드 규칙과 공통 답변을 사용합니다. 애매한 문의를 주의하세요.'
              : '사전 작성된 AI 예시를 검토합니다. 실제 모델 응답이 아닙니다.'}
        </p>
        <Button
          disabled={!ready}
          onClick={() => dispatch({ type: 'start', mode })}
        >
          <Play size={16} />
          {run ? '같은 접수 재실행' : '문의 6건 접수하기'}
        </Button>
      </section>
      <output
        className={
          'business-notice' + (storageBlocked ? ' business-warning' : '')
        }
      >
        {notice}
        {storageBlocked
          ? ' · 세션 임시 기록'
          : ready
            ? ' · 브라우저 자동 저장'
            : ''}
      </output>
      {run ? (
        <div className="business-workspace">
          <aside
            className="business-card business-inbox"
            aria-label="문의 목록"
          >
            <div className="business-row">
              <h2>검토할 문의</h2>
              <span className="business-tag">{run.tickets.length}건</span>
            </div>
            <p className="business-muted">
              중복 접수 차단 {run.duplicateEvents}건
            </p>
            {run.tickets.map((t) => (
              <button
                key={t.id}
                className={
                  'business-ticket' + (selected === t.id ? ' selected' : '')
                }
                aria-pressed={selected === t.id}
                onClick={() => setSelected(t.id)}
              >
                <span>
                  {t.id} · {requests.find((r) => r.id === t.id)!.kind}
                </span>
                <strong>{t.team}</strong>
                <small>{statusNames[t.status]}</small>
              </button>
            ))}
          </aside>
          {ticket && (
            <Review
              key={`${mode}-${ticket.id}`}
              ticket={ticket}
              mode={mode}
              dispatch={dispatch}
            />
          )}
        </div>
      ) : (
        <section className="business-card business-empty">
          <h2>먼저 같은 문의를 한 방식으로 처리해보세요.</h2>
          <p>
            접수 후 문의를 선택해 근거를 읽고 승인하거나 반려하세요. 다른
            방식으로 전환하면 별도 실행 결과가 남습니다.
          </p>
        </section>
      )}
      <section className="business-card business-comparison">
        <h2>업무 결과 비교</h2>
        <p className="business-muted">
          같은 5건의 문의입니다. 미처리가 남아 있는 실행끼리는 최종 효율을
          비교하지 마세요.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                '방식',
                '모의 발송',
                '수동 인계',
                '미처리',
                '승인된 오배정',
                '누적 작업량*',
                '가상 비용*',
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {MODES.map((m) => {
              const r = runs[m],
                k = r ? metrics(r) : null;
              return (
                <TableRow key={m}>
                  <TableCell>{modeNames[m]}</TableCell>
                  {k ? (
                    <>
                      <TableCell>{k.sent}건</TableCell>
                      <TableCell>{k.rejected}건</TableCell>
                      <TableCell>{k.pending}건</TableCell>
                      <TableCell>{k.wrong}건</TableCell>
                      <TableCell>{k.minutes}분</TableCell>
                      <TableCell>{k.units}단위</TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={6}>아직 실행하지 않았습니다.</TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <p className="business-muted">
          * 실측이 아닌 학습용 가정: 접수 시 수동 8분/건 · 규칙 1분/건 · AI 보조
          0.5분/건, 검토할 때 2분, 수정하면 1분 추가. AI 비용은 3 가상
          단위/건입니다. 실제 비용·ROI가 아닙니다.
        </p>
        <details>
          <summary>평가에서 놓치지 말아야 할 것</summary>
          <p>
            오배정은 승인된 건의 담당 팀을 공개 기준과 비교합니다. 답변 품질은
            직접 검토해야 합니다. 장애로 응답이 유실되면 발송 기록은 있지만
            미처리에도 포함됩니다. 재시도하여 상태를 복구하세요. 수동 인계는
            해결 완료가 아니며 이후의 담당자 작업 시간은 이 실험에 포함하지
            않습니다.
          </p>
        </details>
      </section>
      <section className="business-card business-report">
        <div className="business-row">
          <h2>나의 업무 설계서</h2>
          <Button variant="outline" disabled={!ready} onClick={download}>
            <Download size={16} />
            보고서 내려받기
          </Button>
        </div>
        <p className="business-muted">
          설계 근거와 세 방식의 실행 결과를 Markdown 문서로 보관합니다.
          민감정보는 입력하지 마세요.
        </p>
        {(
          [
            [
              'goal',
              '1. 업무 목표와 기준선',
              '누가 어떤 병목을 겪나요? 현재 처리량·시간·오류를 무엇으로 측정할까요?',
            ],
            [
              'rationale',
              '2. AI·규칙·사람의 역할',
              '어떤 판단만 AI에 맡기나요? 승인 위치와 선택한 방식의 근거를 설명하세요.',
            ],
            [
              'operations',
              '3. 운영·중단·인계 계획',
              '승인 지연이나 장애가 생기면 누가 이어받나요? 자동화를 중단할 기준은 무엇인가요?',
            ],
          ] as const
        ).map(([key, title, placeholder]) => (
          <div className="business-form" key={key}>
            <label htmlFor={`report-${key}`}>{title}</label>
            <Textarea
              id={`report-${key}`}
              disabled={!ready}
              rows={3}
              maxLength={4000}
              value={state[key]}
              placeholder={placeholder}
              onChange={(e) =>
                setState((s) => ({ ...s, [key]: e.target.value }))
              }
            />
          </div>
        ))}
      </section>
      <section className="business-card business-sources">
        <h2>실습과 연결되는 공식 자료</h2>
        <p className="business-muted">
          아래 자료의 설계 패턴을 교육용으로 재구성했습니다. 이 시나리오와
          수치는 자체 제작이며 실제 서비스 사례의 성과가 아닙니다.
        </p>
        <ul>
          <li>
            <a
              href="https://platform.claude.com/docs/en/about-claude/use-case-guides/ticket-routing"
              target="_blank"
              rel="noreferrer"
            >
              Claude · 문의 분류와 업무 성공 지표 ↗
            </a>
            <span>현재 업무 → 분류 기준 → 평가 지표 순서로 읽기</span>
          </li>
          <li>
            <a
              href="https://developers.openai.com/cookbook/examples/agents_sdk/security_scanners_with_agents_sdk"
              target="_blank"
              rel="noreferrer"
            >
              OpenAI · 에이전트 제안과 코드 검증 분리 ↗
            </a>
            <span>AI의 판단과 실행 권한을 분리하는 패턴 찾기</span>
          </li>
          <li>
            <a
              href="https://help.zapier.com/hc/en-us/articles/38731463206029-Request-approval-to-keep-your-workflow-running-with-Human-in-the-Loop"
              target="_blank"
              rel="noreferrer"
            >
              Zapier · 승인·수정·거절 후 흐름 이어가기 ↗
            </a>
            <span>우리 실습의 검토 단계를 실제 자동화에 대응하기</span>
          </li>
          <li>
            <a
              href="https://n8n.io/workflows/10928-qualify-and-auto-reply-to-leads-with-openai-airtable-and-gmail/"
              target="_blank"
              rel="noreferrer"
            >
              n8n · 잠재고객 평가 워크플로 예제 ↗
            </a>
            <span>
              공식 갤러리의 커뮤니티 템플릿 · 자동 발송 앞에 승인 단계를
              설계해보기
            </span>
          </li>
        </ul>
      </section>
      <footer className="business-footer">
        학습 기록은 이 브라우저에만 저장됩니다. 기기 간 동기화·실제 AI 호출·CRM
        연결·메일 발송은 하지 않습니다.
      </footer>
    </main>
  );
}
