# Validation scope

The learning engine is deterministic and uses synthetic scenario fixtures, not measured model behavior. No AI API calls or backend data mutations occur. Learner notes, configurations, quiz answers and bounded history are stored only in this browser under a versioned localStorage key. Nothing is synchronized to a server. Read/write failures fall back to session-only operation with a visible notice. The existing platform owner-only access policy remains in place.

The test suite covers the six legacy lessons and ten current lessons, all practice design combinations, reachable successful configurations, invalid configurations, actual candidate filtering, selected-evidence checks, RAG quality/budget/permission tradeoffs, evaluation verdicts against a human-authored rubric, review sets, state serialization, isolated corrupt lesson handling, and completion prerequisites. Successful completion evidence is retained separately from the last 20 run entries.

RAG uses fixture relevance scores and performs real filtering/selection/threshold operations over synthetic document objects. Evaluation compares calculated verdicts against fixed reference labels. The remaining eight lessons retain transparent policy-rule simulations; their displayed records are authored examples, not actual service or model execution. Work units are explicit educational accounting, not measured latency, tokens or monetary cost. Review questions are initially hidden in the UI but are bundled in the public source and are not confidential holdouts.

The optional WebMCP tool is feature-detected and uses the same execute action as the visible interface. Its schema and description now disclose local run recording. No supported live WebMCP validation context was available in this session. Registration and live invocation are therefore not claimed as verified. The manual interface remains available regardless of WebMCP support.

The initial releases were checked with local HTTP rendering, TypeScript, scenario unit tests, and production builds only. The usability revision below adds explicitly requested Computer Use checks in the built-in browser.

## Business process lab

The `/business` route adds a separate browser-local event log under `ai-native-business-v1`; the existing learning state is untouched. Fifteen additional tests (44 total) cover all three modes, duplicate ingestion, approval guards, locked exception cases, rejection/handoff, approved-content snapshots, delivery acknowledgement loss and idempotent recovery, assignment scoring, reachable terminal states, independent mode replay, report generation, and malformed/versioned storage rejection. Both `/` and `/business` return HTTP 200 locally.

This is a real deterministic state transition simulation, not an external workflow runner. AI drafts and policy evidence are authored fixtures; input threat detection is fixed to the included synthetic scenarios and must not be treated as a general security classifier. Assignment scores compare approved tickets to disclosed reference teams. Answer semantics are not automatically graded. Workload and cost units are disclosed assumptions, not actual labor measurements or model usage. Handoffs do not imply customer resolution, and subsequent manual work is excluded. Draft edits now persist independently from confirmed events. Restart archives the selected mode, and restoration swaps an existing attempt without dropping it.

## Usability revision · 2026-09-10

Computer Use used the existing Codex built-in browser tab. Production diagnosis found no delete control, a noninteractive flow illustration, and a Vinext Link prefetch error on the business route. The Link was replaced with normal full navigation. User production records were not deleted; disposable verification runs were created on localhost.

Verified interactively on localhost:

- First-run button, opening failure evidence, changing all three flow selects, and rerunning changed the context result from 0/4 to 4/4 with baseline comparison.
- Individual and bulk deletion move records to a visible trash; restoration survives reload.
- Business intake deduplicates six events to five tickets. Selecting missing/security tickets changes the displayed branch to blocked/manual handoff.
- Draft and reason edits survive ticket navigation and reload. Approval locks the fields and enables delivery.
- Lost delivery acknowledgement followed by retry keeps one delivery record. Two exceptions can be rejected and three normal cases delivered, reaching 3 sent / 2 handoffs / 0 pending / 0 approved misroutes.
- Restart confirmation, archived attempt restoration, reload, and switching between AI/rule modes preserve separate results.
- Report preview displays the actual active results; copy reports successful completion. The built-in browser did not expose a download completion event, so saving a physical file is not claimed as verified. Preview and copy provide the tested fallback.

Six additional regression tests cover trash/proof recovery, lesson isolation, old-state migration, archive swapping, draft preservation, and malformed archive rejection (50 tests total). Viewport screenshots were inspected at the user's existing built-in browser size; this is not a claim of exhaustive device/browser coverage.
