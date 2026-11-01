# Research brief: Codex-quality agent observability for Antigravity ACP in T3

Repository: https://github.com/leacvikas0/antigravity-acp-t3-integration

Act as an independent senior engineer researching agent runtimes, ACP and T3 Code integration. Read this repository first. Research deeply, challenge its assumptions, and produce an evidence-backed architecture and implementation recommendation. Do not modify production or publish changes. The goal is a practical decision, not a generic protocol overview.

## Goal and user experience

Keep the existing Argon model and local proxy, but make the T3 experience as clear and dependable as its Codex integration. The user wants to see each child agent separately: purpose, stable identity, running/completed/failed status, live progress and tool activity, result, and parent relationship. Where supported, opening the child transcript, cancellation and follow-up should work. Do not claim parity if only a batch badge or final text summary is possible.

Prioritize native/subagent visibility and correct event attribution. The model's intelligence or system prompt is not the suspected primary problem. Keep context overhead modest; do not solve this by dumping all child transcripts into the parent model context. Prefer supported integration points and a small maintainable adapter over invasive runtime patches. A no-upgrade or partial-parity recommendation is acceptable if justified.

## Starting facts ? independently verify

- Production uses official Antigravity ACP 1.4.3 through a local Node wrapper, registered in T3 as `driver: acpRegistry`, `agentId: antigravity-acp`.
- T3 also has a dedicated Antigravity provider flavor. Determine its actual differences and whether the installed custom command/gateway configuration can be used there without replacing the proxy or losing features.
- Current public T3 main's `AntigravityAdapterV2.ts` recognizes native subagent batches but returns `childSessionId: null`. Do not assume main matches the installed build.
- Inspected official ACP code suppresses child-trajectory assistant/thought deltas in the parent chat stream. Determine what child identities, tools, lifecycle and transcript data exist internally and what crosses the ACP boundary.
- ACP 1.4.5 is available. Its multi-directory support is not the reason for this investigation. Native file-reader changes intersect the custom multimodal hook. Preserve the context accounting fix, 650k compaction, full-access intent, existing prompt/profile/preferences, reasoning controls, MCPs and media behavior.
- Google binaries and SDK/server source are intentionally not redistributed. Obtain public official packages yourself for lawful inspection if needed. No access to private transcripts or credentials should be necessary for the initial analysis.

## Required investigation

1. Map the complete event path: native Antigravity runtime -> official ACP server -> our local adapter -> generic/dedicated T3 adapter -> normalized events -> persisted child/run projections -> UI. Identify exactly where data is omitted, flattened, renamed or misattributed. Inspect our adapter rather than assuming it is transparent.
2. Pin source revisions and protocol versions. Compare the shipped ACP v1/v2 behavior with stable and unstable ACP subagent proposals. Separate published support, unmerged proposals and installed behavior. Do not infer capabilities from similarly numbered CLI releases.
3. Compare T3's Codex child handling, dedicated Antigravity handling and generic ACP handling. Cite exact files/functions/lines or immutable permalinks. Identify the minimum data required for a real child UI: child/session/task IDs, parent IDs, lifecycle events, tool ownership and transcript retrieval. State what Antigravity provides and what cannot be recovered honestly.
4. Determine whether routing our launcher through the dedicated provider improves observability today. Check custom executable support, gateway credentials/configuration, protocol negotiation, tool/schema normalization, permission controls and session compatibility. An unsupported UI/config hack is not a supported migration.
5. Evaluate T3-owned delegated tasks exposed through its MCP as an alternative. Can an Antigravity parent start Argon child tasks that T3 owns and displays individually? Check actual target/options support, model availability, how MCP reaches our generic provider, parent wake/completion behavior, cancellation, same-workspace versus worktree behavior, concurrency and quota costs. Distinguish these from native Antigravity subagents. Do not silently replace one with the other.
6. Evaluate a metadata/event bridge only if needed. Can existing child trajectory identity be emitted through a supported ACP extension that T3 consumes? Would both ends require changes? Would transcript-file observation be fragile? Do not fabricate individual child state from batch status or parse free-form prose when structured data exists.
7. Inspect ACP 1.4.5 only for relevant integration changes. Identify which local hooks survive, which become unnecessary and which must be adapted. Do not propose a stock binary swap or repeat stale byte patches. Assess whether an upgrade actually contributes to the user goal.
8. Review recent upstream issues, fixes, tests and roadmap discussions for these exact limitations. Prefer maintainers' statements and implementation evidence. Label community workarounds, speculation and unverified claims clearly.

## Validation design

Design a small, deterministic mock suite before spending model quota. One parent dispatches two children; they issue interleaved tool/progress events; one succeeds, one fails; an idle batch must not imply both succeeded. Assert separate identities, attribution, status, readable parent output and persistence/reload behavior. Cover cancellation, parent completion before child completion, reconnect/session resume and malformed/missing metadata. Use captured or synthetic protocol fixtures, not personal conversations. Explain how to run each test and what result discriminates the competing hypotheses.

Only after selecting a feasible route propose one tiny live acceptance task with a maximum of two concurrent children and no large attachments. No broad benchmarks or account changes. Account pool and browser sessions must remain intact.

## Deliverable

Lead with the diagnosis and recommended route. Then provide:
- An evidence matrix: claim, source/revision, observed fact, confidence and unresolved question.
- A boundary-by-boundary explanation of where visibility is lost.
- Options: dedicated provider migration; T3-owned delegation; adapter/extension work; staying as-is. Compare attainable UX, maintenance, context overhead, quota/concurrency, session compatibility and reversibility.
- A concrete staged plan: private backup, isolated candidate, mock tests, minimal live acceptance, explicit cutover and rollback. Specify the exact components that change and those that remain untouched.
- Findings on what is impossible without upstream work, plus precise issue/PR suggestions if appropriate.

Distinguish source inspection from executed tests. Do not say something works because a method exists. If you cannot access the installed T3 build, specify the smallest local diagnostic we should run and the exact redacted evidence needed. Do not request credentials, entire private transcripts or uploads of proprietary binaries to a public repository.

Useful primary starting points:
- https://github.com/pingdotgg/t3code/blob/main/apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.ts
- https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-antigravity.md
- https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-acp.md
- https://github.com/pingdotgg/t3code/blob/main/docs/orchestration-v2/orchestrator-mcp-server.md
- https://github.com/agentclientprotocol/agent-client-protocol
- https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json

Treat every starting conclusion as a hypothesis to verify. The final recommendation should maximize real user visibility and reliability with the smallest sustainable change.

## Additional finding during snapshot validation

The local adapter itself defaults `stripT3` to true unless `ARGON_ACP_KEEP_T3_BLOAT=1`. It strips T3 prompt blocks, removes the `t3-code` MCP from client server lists, and deletes T3_ACP_MCP_ENDPOINT/AUTHORIZATION/ENTRYPOINT/NODE from the child environment. The launcher also filters a saved t3-code MCP entry. Investigate both layers before assuming T3-owned delegation is available. Determine the original motivation and whether selective preservation can retain orchestration without restoring unrelated instruction bulk. No production change has been made.

Snapshot verification: 23 of 24 bundled Node tests passed. The remaining multimodal fixture invokes the deliberately omitted proprietary ACP executable; spawn returned no process exit status. This is not an accepted end-to-end multimodal run.
