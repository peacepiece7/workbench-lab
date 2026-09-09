# Validation scope

The learning engine is deterministic and uses synthetic scenario fixtures, not measured model behavior. No AI API calls or backend data mutations occur. Learner notes, configurations, quiz answers and bounded history are stored only in this browser under a versioned localStorage key. Nothing is synchronized to a server. Read/write failures fall back to session-only operation with a visible notice. The existing platform owner-only access policy remains in place.

The test suite covers the six legacy lessons and ten current lessons, all practice design combinations, reachable successful configurations, invalid configurations, actual candidate filtering, selected-evidence checks, RAG quality/budget/permission tradeoffs, evaluation verdicts against a human-authored rubric, review sets, state serialization, isolated corrupt lesson handling, and completion prerequisites. Successful completion evidence is retained separately from the last 20 run entries.

RAG uses fixture relevance scores and performs real filtering/selection/threshold operations over synthetic document objects. Evaluation compares calculated verdicts against fixed reference labels. The remaining eight lessons retain transparent policy-rule simulations; their displayed records are authored examples, not actual service or model execution. Work units are explicit educational accounting, not measured latency, tokens or monetary cost. Review questions are initially hidden in the UI but are bundled in the public source and are not confidential holdouts.

The optional WebMCP tool is feature-detected and uses the same execute action as the visible interface. Its schema and description now disclose local run recording. No supported live WebMCP validation context was available in this session. Registration and live invocation are therefore not claimed as verified. The manual interface remains available regardless of WebMCP support.

No browser visual or interaction testing was performed; it was not requested. Local HTTP rendering, TypeScript checks, scenario unit tests, and the production build are the validation scope.
