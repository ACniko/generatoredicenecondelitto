# Generation performance and recovery

The pipeline keeps all existing word limits and `StoryData` fields. It plans compact canonical facts before writing the public dossier, solution, character cards and evidence. Repairs address up to four independent invalid fields per call. Successful siblings are preserved, including after reload.

## Recovery and limits

The latest generation is saved under `murder-mystery:generation:v1` in this browser's local storage. Reloading never starts billable work automatically. Resume revalidates saved drafts and requests unfinished fields only. Cancel preserves progress; delete starts a new run. Saved stories are local to this browser/device. If storage is unavailable, keep the page open to retain the in-memory copy.

The shared queue allows two concurrent requests and falls back to one after a quota response. All requests respect the same deadline. Waits over 120 seconds pause the generation for explicit resumption. A complete story remains available with a warning if narrative verification fails.

## Measurements

Run `node scripts/compare-prompt-footprints.mjs` for a deterministic fixture comparison against commit `69ab9d1`. This measures serialized prompt characters, **not tokens, latency or production quality**. In the current fixtures, character-writing prompts are about 63–65% smaller. Across the complete flow, including full-story verification and new evidence-writing calls, prompt characters fall by 3–6%. Additional savings from targeted corrections and cache depend on actual requests.

Run `node scripts/benchmark-generation.mjs --live --counts=5,8,12 --label=optimized` for a live comparison. This consumes Groq quota. Add `--base=https://deployment.example` to select a deployment. Reports and resumable checkpoints go to the ignored `output/benchmarks/` directory. Resume with `--resume` and the same label/counts. Use `--baseline-ref=69ab9d1 --label=baseline` for the prior implementation. Baseline has no resumable stage support.

Reports preserve unknown usage as `null`, record request failures, and distinguish a complete audited story from one with a narrative warning. Never describe a partial token sum as a complete cost estimate. Use repeated completed samples before claiming p50/p95 improvements; the initial three-case matrix is exploratory.

## Server configuration

Phase caps are enforced server-side: canonical facts 32,768; public dossier and solution 8,192 each; evidence 4,096; character pairs 16,384; repairs and verification 8,192. GPT-OSS 120B defaults to medium reasoning. `AI_PROSE_REASONING_EFFORT=low` is an opt-in experiment for prose and repairs, not an enabled quality assumption. `AI_PHASE_BUDGETS=legacy` restores the previous 65,536-token 120B cap for rollback.

API responses retain `{ content }` and add `metadata` with duration, phase, model, policy, finish reason and provider usage when available. Logs exclude prompts, story text and credentials. Cached tokens and reasoning tokens are not assumed to exist when omitted by the provider.
