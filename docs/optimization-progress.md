# Optimization implementation ledger

Plan: approved Generazione più veloce, recuperabile e con meno sprechi (2026-10-19).
Branch: codex/optimize-resumable-generation, based on main 69ab9d1.

- Generation: compact canon, separate prose, field-only repair, unchanged StoryData and lengths.
- Recovery: browser checkpoint drafts and accepted stages; shared two-request scheduler, quota cooldown, UI progress.
- API: phase caps, metadata, no prompt logging, medium reasoning initially.
- Integration: regression tests, build/types, controlled live comparisons, Preview then production.

Ruling: use current dedicated project checkout on a new feature branch, preserving existing untracked user scripts. No extra worktree is needed for disjoint file ownership.
Ruling: existing approval includes GitHub push, Preview, merge and production release; no new permission prompt is needed.
Interfaces: services/generationTypes.ts is coordinator-owned and shared by all workers. Agent generation owns groqService and staged tests; recovery owns runtime/storage/App/adapter/LoadingSpinner and recovery tests; API owns api/generate.js and API tests.

Completed: all three implementation streams; root integration tests exercise actual runtime with 5/8/12 guests, quota recovery and verification warnings.
Review: fixed rejection of valid repairs when previously hidden sibling errors surface; fixed sparse array holes during partially successful missing-item repairs. Scoped independent re-review found no remaining P1/P2 issues.
Verification: 69 tests passed; TypeScript and production build passed. Browser restored a completed fixture without API calls and downloaded common, solution and character PDFs.
Live observation: a five-player run against the prior production API preserved canonical plan, dossier, solution and partial cards when Groq paused the run after 21 attempts. It did not finish; usage was unavailable on that API version. No production latency or total-token reduction is claimed.
Measurement: deterministic fixtures show character prompt characters reduced 63–65%; total prompt characters reduced 3–6%. This is not a token or latency benchmark. Live comparison remains quota-dependent.
