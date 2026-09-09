# Validation scope

The learning engine is deterministic and uses authored scenario fixtures, not measured model behavior. There are no AI API calls, backend mutations, accounts, or saved learner records. Progress is held in the current React session only.

The test suite covers all six lessons, all possible design combinations, reachable successful configurations, effective controls, and rejection of invalid configuration values.

The optional WebMCP tool is feature-detected and uses the same applyRun action as the visible interface. No supported live WebMCP validation context was available in this session. Registration and live invocation are therefore not claimed as verified. The manual interface remains available regardless of WebMCP support.

No browser visual or interaction testing was performed; it was not requested. Local HTTP rendering, TypeScript checks, scenario unit tests, and the production build are the validation scope.
