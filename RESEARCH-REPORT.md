# Antigravity ACP + T3 Code: Integration Architecture Research

**Date:** 2026-11-01  
**Status:** Read-only source research; production unchanged  
**Owner repository:** https://github.com/leacvikas0/antigravity-acp-t3-integration  
**Decision:** Restore and validate T3-owned delegation first; do not claim native Antigravity child parity.

> **Important evidence limit.** This report inspects a published source snapshot and upstream T3/ACP code. It does not validate the exact installed T3 build, execute the modified proprietary Antigravity binary, read private transcripts, or make any Argon/proxy requests. Source facts, external issue reports, hypotheses, and proposed tests are differentiated below.

## 1. Executive diagnosis and recommended route

There are **two separate observability paths**, and each has a different failure:

1. **T3-owned delegation is deliberately disabled by our wrapper.** The Node adapter defaults to stripping T3's orchestration prompt block, filtering the authenticated session-scoped MCP server named **t3-code**, and removing T3_ACP_MCP_ENDPOINT / AUTHORIZATION / ENTRYPOINT / NODE from the child's environment. The launcher independently deletes a saved global t3-code MCP entry. The first set of filters prevents the intended app-owned delegation transport from reaching Argon in the normal integration.
2. **Native Antigravity subagents lack individually exposed lineage in inspected ACP/T3 code.** Dedicated Antigravity flavor identifies native start/invoke-subagent *batches* using specific tool titles and sets childSessionId to null. Generic ACP does not even perform that Antigravity-specific classification. No inspected public evidence establishes complete native child IDs, independent child session notifications, tool ownership, and transcript retrieval across the official ACP 1.4.3 boundary.

**Smallest sustainable route:** Keep the existing Argon gateway/proxy, patched ACP 1.4.3, user behavior/context/media customizations, and the generic acpRegistry adapter as production. Create an isolated candidate restoring T3's authenticated orchestration connection and the minimum required instructions. Prove app-owned child thread identity, tool attribution, cancellation, status, persisted results, and parent completion using deterministic mocks *before* live requests. Only propose targeted T3 continuation/background fixes if tests demonstrate them. Treat native Antigravity subagents as opaque batches until official structured child lineage exists.

Do **not** treat a batch badge, fake child record, or final prose summary as native child parity.

## 2. Source revisions and evidence matrix

The repository contains a publication snapshot, not a live synchronization with the installed machine.

| Claim | Source / pinned revision | Verified evidence | Confidence / remaining gap |
| --- | --- | --- | --- |
| Production snapshot selects generic ACP driver | [README](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/README.md), [SNAPSHOT](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/SNAPSHOT.json) | driver=acpRegistry, agentId=antigravity-acp; ACP 1.4.3; gateway model gemini-4-argon | High for published snapshot; current installed T3 executable unverified |
| Wrapper filters orchestration | [adapter.cjs](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/adapter.cjs), [launch.cjs](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/launch.cjs) | stripT3 defaults true unless ARGON_ACP_KEEP_T3_BLOAT=1; strips XML, session MCP and child env; launcher filters saved t3-code | High for published code; motive unverified |
| Wrapper preserves ordinary incoming ACP updates | [adapter.cjs](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/adapter.cjs) | fromAgent passes through non-config session/update messages | High for this code path; upstream server may have omitted data already |
| Generic ACP has no Antigravity-specific native child projection | [registry flavor](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/provider-acp-registry/src/server/adapter.ts) | generic flavor registers no Antigravity native subagent extractor; specialized mappings exist for other agents | High for pinned T3 main; installed build unverified |
| Dedicated Antigravity reports batches without child session IDs | [AntigravityAdapterV2.ts L85-L107](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.ts#L85-L107) | nativeTaskId derived from toolCallId; title is a batch; childSessionId=null; model=null | High for pinned main; not proof of runtime's hidden internal state |
| Codex has native child lineage | [CodexAdapterV2.ts](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts) | receiverThreadIds, subAgentActivity and agentsStates map children to independent turns/tools/status | High for pinned main |
| Shared ACP adapter *can* project a child if IDs exist | [shared ACP adapter L2787-L2975](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/provider-acp/src/server/adapter.ts#L2787-L2975) | links childSessionId to child thread, provider thread and pending notifications | High; Antigravity does not supply required IDs via inspected extractor |
| T3-owned delegate_task creates independent child thread/run | [orchestration MCP docs](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/docs/orchestration-v2/orchestrator-mcp-server.md#L457-L503), [schema](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/contracts/src/orchestratorMcp.ts#L168-L241) | app-owned lineage, task ID, child thread/run IDs, independent status and durable result | High for source; activation in our local runtime untested |
| Antigravity asynchronous parent wake is a risk | [issue #17412](https://github.com/pingdotgg/t3code/issues/17412) | submitted report; issue **closed as not planned on Oct 29 for missing reproduction**, not confirmed fixed | Low-medium for reported behavior; diagnostic hypothesis unproven |
| Background command lifecycle has known concerns | [issue #16442](https://github.com/pingdotgg/t3code/issues/16442), [issue #28415](https://github.com/pingdotgg/t3code/issues/28415) | mock reproduction and separate real-world problem report; both open at inspection | Medium for applicability to our local stack |
| Durable last result can differ from parent-delivered result | [issue #28448](https://github.com/pingdotgg/t3code/issues/28448) | reported Claude-to-Claude completion delivery failure, open at inspection | Medium as cross-provider failure mode, not evidence of Argon reproduction |
| ACP 1.4.5 is available | [official registry agent.json](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json) | published Windows x64 package version 1.4.5 | High for availability; patched hook compatibility untested |

**Pinned references:** our snapshot commit ce80a2a726d630a78528d7822b3e330a37eef269; inspected T3 commit b50d8a1b15eed3a75e1e0969765e14c6436d80d7; ACP upstream commit b4c72a80f32f4c61d87270d90891c7ce14511b9a. These are independent of any user's installed T3 build. The published snapshot records source-file hashes, but intentionally omits Google's proprietary binary and extracted server sources.

## 3. Boundary-by-boundary event trace

### A. Native Antigravity runtime → official ACP server

Local snapshot provenance reports that ACP 1.4.3 suppresses child-trajectory assistant/thought deltas from the root session's chat stream to avoid interleaving concurrent streams. **That statement is drawn from the snapshot's account of local proprietary source inspection; it is not independently reproduced from an official binary here.** This does not prove every child tool update is suppressed. The crucial missing evidence is a redacted ACP notification capture showing whether any child identity, parent identity, and tool ownership crosses the boundary.

Stable ACP tool-call identifiers are useful for individual *tool calls* but not automatically for independently controlled *child sessions*. The evolving ACP unstable-v2 subagent proposals should not be conflated with deployed ACP v1 or with similarly numbered Antigravity releases.

### B. Official ACP server → our adapter

The Node wrapper normally forwards upstream session/update tool calls without modification. It projects model and reasoning config updates and intercepts session setup, prompts and MCP lists. This means its principal observability offense is **outbound orchestration blocking**, not mass deletion of inbound ACP tool activity.

Relevant functions: stripT3PromptBlock, createAdapter.fromClient, createAdapter.fromAgent, run, createModeGate in harness/adapter.cjs.

### C. T3 → wrapper → ACP: the deliberate orchestration filter

Three filters work together:

- On session/prompt, stripT3PromptBlock removes the entire t3_code_instructions XML block and pull_request_linking; it unwraps user_request. This discards Plan/default interaction mode, delegation guidance and ACP terminal fallback.
- On session/new, session/load, session/resume and session/fork, the adapter removes a client MCP server whose name is t3-code. T3's dynamically injected server carries a session-scoped credential.
- On child spawn, run removes T3_ACP_MCP_ENDPOINT, T3_ACP_MCP_AUTHORIZATION, T3_ACP_MCP_ENTRYPOINT and T3_ACP_MCP_NODE from its environment, removing the terminal fallback.
- launch.cjs independently removes an existing *saved* t3-code entry from global MCP config. That is different from removing T3's *fresh per-session* authorized entry. The launcher filter alone need not block the dynamic entry, but the adapter filter does.

The documented escape hatch ARGON_ACP_KEEP_T3_BLOAT=1 disables the adapter's prompt/MCP/environment stripping. **It is a diagnostic switch, not proof that the official runtime exposes or can call the injected MCP.**

The original motivation has not been verified. The variable name suggests reducing T3 instruction bulk, but there is no inspected performance benchmark establishing it. The filter is disproportionate to that suspected goal.

T3's prompt-injection policy already sends ACP orchestration guidance on first turn and on relevant state changes, rather than duplicating it blindly every turn: [orchestrationInstructions.ts L76-L105](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/provider-core/src/server/orchestrationInstructions.ts#L76-L105).

### D. ACP → generic or dedicated T3 adapter

Generic acpRegistry normalizes ACP prompts, tool calls, turns, and session events. It does **not** install the dedicated Antigravity native subagent extractor. It therefore cannot assign a native start_subagent tool call to separate child session/tool streams by default.

Dedicated Antigravity recognizes exact tool titles (Running start_subagent / Run start_subagent? / Running invoke_subagent / Run invoke_subagent?) and excludes MCP tools using metadata. It projects one **batch** with toolCallId as nativeTaskId, childSessionId=null, model=null. When its root turn settles, unresolved batches may become idle; idle does not imply each underlying native child succeeded.

The shared ACP adapter supports real child projection when the flavor supplies childSessionId. It uses this to create child thread/provider records and attribute child notifications. An Antigravity batch classifier without child IDs is not enough.

### E. Normalized events → persistence → UI

T3's ProviderEventIngestor converts provider events into subagent.updated, turn-item.updated, node.updated and related stored events. ProjectionStore upserts and replays entities. WireProjection truncates oversized bodies for ordinary transfer and deduplicates repeated text. Client reducers update subagent state. Therefore, for T3-owned child threads, most underlying persistence/UI machinery already exists.

Key source locations: [ProviderEventIngestor L626-L669](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/ProviderEventIngestor.ts#L626-L669); [ProjectionStore L855-L921](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/ProjectionStore.ts#L855-L921); [WireProjection](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/WireProjection.ts); [client reducer](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/client-runtime/src/state/orchestrationV2Projection.ts).

A frontend patch cannot restore unreported child lineage. Conversely, if T3 owns the child thread/run, its history can already be recorded and displayed without native Antigravity child-session support.

## 4. Codex parity: what is real, feasible, and impossible

| UX requirement | Native Antigravity on inspected path | T3-owned delegation through Argon parent | Codex-native comparison |
| --- | --- | --- | --- |
| Stable per-child identity | Not established; batch tool ID only | Yes, T3 task/childThread/childRun IDs | Yes, native child thread IDs |
| Parent relationship | Batch-level only | App-owned lineage persisted | Native structured lineage |
| Live child tool attribution | Not reliable without child session events | Yes, child ACP session's tools belong to child thread | Yes |
| Running/completed/failed | Batch may be pending/running/failed/idle | Distinct durable statuses | Distinct native statuses |
| Individual transcript | Not established | Child T3 thread inspection | Native child thread inspection |
| Independent cancellation | Not established | T3 task_cancel / thread stop | Supported through Codex adapter |
| Child follow-up | Not established | Follow-up on child T3 thread | Supported where native provider permits |
| Native execution semantics | Preserved | Different ownership and new sessions | Codex-native |
| Context overhead | Low for batch | Extra child context/request, no automatic parent transcript copy | Native child context |
| Proxy concurrency/quota | Native runtime-defined | Each delegated Argon child costs separate work/session | Codex provider-defined |

T3-owned delegation is **not** secretly “native subagents with better UI.” It is a different orchestration mode: Argon explicitly requests app-owned children through the T3 MCP; T3 starts independent provider sessions with task prompts. This provides reliable lineage if transport and lifecycle tests pass, but can cost extra cold starts, tokens, proxy/account quota and workspace concurrency. The model may prefer native tools on same-provider tasks under T3's default orchestration guidance; a task that explicitly requests app-owned inspectable workers needs that distinction stated plainly, without teaching the model to fabricate them.

The actual delegate_task source schema includes optional target.providerInstanceId, target.model and target.options, role, mode, isolation (shared/worktree), timeoutMs, clientRequestId and permission modes: [contracts schema](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/contracts/src/orchestratorMcp.ts#L168-L196). The prose documentation omits isolation in its abbreviated type example; tests must use the pinned schema.

A child receives its own task plus optional role, **not the whole parent transcript**. Use short task context and a child link/result handoff rather than dumping full child streams into parent model context.

## 5. Dedicated Antigravity provider: not a free migration

T3's dedicated provider has useful Antigravity normalization, read-repair behavior, and batch recognition. But the dedicated driver constructs its own profile, authentication, runtime home, and executable spawn. It does not offer an arbitrary Node command entry identical to the generic local ACP driver. Pointing its “Binary path” at harness/launch.cjs is not a supported or proven replacement.

The custom stack depends on:

- Separate modified AIStudio2API v0.2.16 proxy and its current account pool/session state.
- Existing Argon model, low/medium/high reasoning mapping.
- Native behavior patch with templated identity and private preference/profile sections.
- Context patch: 1,048,576 context tokens; 650,000 compaction target; 131,072 output cap; cached-token accounting semantics.
- Multimodal view_file patch and attachment-to-resource-link promotion.
- Parallel Search MCP and intentionally disabled native search_web.
- Full-access policy and existing workspace behavior.
- Session resume and the current generic ACP provider identity.

Dedicated migration risks breaking these and does not by itself provide individual native child session IDs. **Defer migration until a controlled experiment demonstrates substantial benefit without losing this stack.**

## 6. Lifecycle, attribution and permission risks

### Asynchronous completion and parent wake

Current shared ACP source enables its post-settle continuation pathway only if the flavor sets enablePostSettleContinuation and has continuationRequests. The dedicated Antigravity flavor inspected does not set the flag. That is a real static source observation but **not proof that all T3-owned delegated-task wakeups depend on that specific flag**.

Upstream [#17412](https://github.com/pingdotgg/t3code/issues/17412) reported an Antigravity async-child parent stuck after children complete. **The issue was closed “not planned” on 2026-10-29 for lack of reproduction details**, not merged as a verified fix. A maintainer explicitly requested sanitized parent/child lifecycle logs and current versions. The correct next step is a minimal mocked reproduction of delegated result delivery and parent continuation, not a blind flag flip.

### Background commands and false success

[#16442](https://github.com/pingdotgg/t3code/issues/16442) reports a mock-reproduced command running after T3 marks the turn completed; Stop then cannot kill it. [#28415](https://github.com/pingdotgg/t3code/issues/28415) reports Antigravity background work marked completed too early and wake events not reflected. These were open when inspected. The shared ACP adapter terminalizes open foreground tools at completed turn settlement unless identified as background. This can be incorrect when an actual Antigravity command is still running.

Only implement a background-task classifier using structured, stable IDs and explicit lifecycle evidence; do not assume every long command is background. Treat “parent turn completed”, “background task finished”, and “child completed” as different states.

### Durable result versus delivered result

[#28448](https://github.com/pingdotgg/t3code/issues/28448) reports a Claude delegation where the last wake-turn result was stored but not delivered to the parent. It is not an Argon reproduction, but proves the test architecture must separate durable child result from parent notification and final response. A completed badge is insufficient acceptance evidence.

### Full-access mode conflict

The wrapper forces mode=yolo on session start and strips the redundant mode selector. The Python patches disable workspace containment under ARGON_ACP_FULL_ACCESS=1. T3-owned children may request inherited or narrower runtime modes. If our wrapper silently forces yolo, the UI could represent a child as approval-required while the native runtime executes unrestricted. **This is a release blocker.**

Until proven otherwise: either support only explicitly full-access child sessions with transparent UI semantics or implement genuine permission-mode alignment; never claim supervised execution if the wrapper overrides it.

## 7. Recommended staging and exact change surface

**Stage 0 — Backup and fingerprint (read-only):**

- Capture the installed T3 version/commit, ACP executable hash/version, Node version, wrapper hashes and capability negotiation with redacted metadata.
- Keep offline private backups of existing runtime, launcher, proxy supervisor and config. Do not upload cookies, keys, private profile files, SDK source or proprietary executables.
- Verify whether installed T3 code contains the same generic ACP MCP injection and delegation schema as the pinned upstream revision.

**Stage 1 — Mock only; no accounts or live Argon:**

- Add fake ACP and fake MCP fixtures in a separate local candidate.
- Test the existing ARGON_ACP_KEEP_T3_BLOAT=1 bypass end-to-end through Node pipes: T3 prompt blocks preserved, session-scoped t3-code server preserved, env fallback present, no duplicate MCP entries.
- Validate session/load, session/resume and session/fork re-inject fresh scoped credentials rather than stale persisted tokens.
- Test malformed metadata and cancellation explicitly.

**Stage 2 — Narrow selective preservation:**

- Avoid broad regex deletion of T3 instructions. Preserve mode, delegation contract and fallback. If context overhead matters, quantify actual injected bytes/token cost and consider upstream-safe selective policy instead of permanently deleting the entire block.
- Continue filtering a stale saved *global* t3-code MCP definition if necessary; accept the fresh *client-injected* one.
- Preserve all other MCP servers, prompt identity, context/media patches, proxy, and model mapping.
- Keep candidate changes outside production.

**Stage 3 — T3-owned child event tests:**

- Fake parent dispatches two app-owned children. Each has a distinct childThreadId/childRunId.
- Tool events interleave, including identical tool titles and IDs within different sessions. One child succeeds, another fails.
- Assert correct thread/node ownership, final results, parent relationship, and persistence/replay.
- Assert a native Antigravity batch without child IDs is displayed honestly as a batch.

**Stage 4 — Reliability fixes only if mock failures demonstrate them:**

- Test async parent wakeup with and without the post-settle ACP path; prove the causal mechanism before changing flags.
- Test background command completion, Stop, cancellation, timed-out wait, process crash and late notifications.
- If necessary, prepare a small upstream T3 PR with failing fixtures and a narrow fix rather than importing the full Codex adapter or patching Google's proprietary binary.

**Stage 5 — Tiny live acceptance (only after mocks):**

- Keep the current proxy/account pool unchanged.
- Use one read-only workspace and two tiny independent Argon child tasks at most. No large attachments and no broad benchmark.
- First check capabilities/MCP discovery; then a wait-mode child; finally async completion.
- Verify the real UI and reloaded persisted state, as well as concurrent proxy health and account usage.

**Stage 6 — Explicit cutover/rollback:**

- Use a separately named T3 provider candidate, launcher path and isolated runtime working directory.
- Cut over only after all acceptance gates pass.
- On failure stop candidate children, disable candidate provider, restore the original command/config. Do not mutate existing production T3 thread history or proxy account stores.

## 8. Deterministic mock acceptance tests

Use synthetic protocol fixtures, never personal conversations. For our Node wrapper, the existing baseline runs with Node's built-in test runner from the repository root; add dedicated orchestration fixture tests before live work:

    node --test harness/adapter.test.cjs harness/adapter-transport.test.cjs
    node --test harness/*orchestration*.test.cjs

(The second command is a **proposed** filename pattern, not an existing test.) For T3 internal mocks, use the pinned repository's test runner and existing ACP adapter / MCP orchestration testkits rather than inventing a new integration harness. Inspect its package scripts before choosing the exact command.

| ID | Fixture | Assertions | Distinguishes |
| --- | --- | --- | --- |
| M1 | session/new includes t3-code MCP with per-session auth and Parallel Search MCP | Neither lost; no duplicate; bearer never printed | Wrapper stripping vs runtime MCP rejection |
| M2 | First prompt has T3 XML, user_request, image/resource_link | Preserve user text, T3 orchestration and attachments; mode guidance retained | Prompt filtering vs native model behavior |
| M3 | Repeated prompts, mode change, compaction, load/resume/fork | No runaway prompt duplication; fresh credential on each new session | Context overhead vs correctness |
| M4 | Two children A/B issue interleaved tools with identical titles | Distinct child threads, tool owner and statuses | Structured ID routing vs title-based guessing |
| M5 | A fails while B succeeds | Distinct failed/completed states and truthful aggregate result | False batch success |
| M6 | Native start_subagent tool has no child ID | One opaque batch; no fabricated individual child sessions | Native parity claim vs real information |
| M7 | Parent settles before async child result | Child finishes; exactly one continuation and delivered result | Missing wake vs durable recording |
| M8 | Parent stop; child cancellation; late tool output | No reopened children; no fake success; no zombie processes | Stop lifecycle |
| M9 | Persist events, destroy in-memory state, restart/replay | Identical IDs, child timeline, terminal status, results | UI-only display vs durable observability |
| M10 | Malformed IDs/metadata, duplicate updates, out-of-order update | Reject or quarantine safely, idempotent replay | Fragile parser vs robust event sourcing |
| M11 | Child requests approval-required while yolo is forced | Explicit rejection or genuine enforcement; never hidden escalation | Security/permission mismatch |
| M12 | MCP endpoint unavailable, auth expires | Readable error and recoverable session; no credentials leaked | Graceful degradation |
| M13 | Context, media, models and search regressions | Existing policies retain outputs and configuration | Observability gain vs stack regression |

Canonical interleaving fixture:

    child-A/tool-1: started
    child-B/tool-1: started
    child-B/tool-1: completed
    child-A/tool-1: failed
    child-B: result, completed
    child-A: error, failed
    parent: truthful A-failed/B-completed summary

Required async wake fixture:

    parent: delegate_task(mode=async) -> task-A
    parent: end_turn
    child-A: completed (durable event)
    orchestrator: completion available
    parent: continuation offered and consumed once
    parent: result acknowledged, final answer persisted

Repeat both fixtures across cancellation points and server reconnect.

## 9. ACP 1.4.5: separate upgrade decision

The official Registry currently advertises Antigravity ACP 1.4.5. The local snapshot reports a prior static package inspection suggesting workspace and file-reader changes; that report was **not independently reproduced in this investigation**. The project's custom make_safe_view_file hook is tied to the 1.4.3 extracted Python integration, and the context/behavior patches wrap native harness config builders. An unmodified 1.4.5 swap would risk breaking native media, policy, and context calculations.

No inspected evidence shows that 1.4.5 offers the missing individually addressable native subagent event contract. Do not upgrade for a presumed subagent fix. If evaluating it separately, use a disposable official package, compare relevant APIs, port only compatible hooks, and require the entire media/context/permission regression suite before deployment.

Likewise ACP unstable-v2 subagent/background-work proposals are **not** promised compatibility for this Antigravity distribution. Pin advertised protocol capabilities from initialize responses in the local candidate instead of equating release numbers.

## 10. Compatibility, overhead and reversibility options

| Option | Attainable UX | Maintenance / risk | Context, quota, workspace | Reversibility | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Keep current generic ACP unchanged | Parent tool activity; no T3-owned child orchestration | Lowest maintenance, misses goal | No new child cost | Immediate | Rollback baseline only |
| Generic ACP + selective T3 orchestration | T3-owned individual child threads with meaningful tools, statuses, results; native remains batch | Smallest adapter/config change, must prove lifecycle/permissions | Additional Argon ACP sessions, calls; shared/worktree choice | High with separate provider | **Preferred first milestone** |
| Dedicated Antigravity migration | Better native batch/tool normalization, not native individual transcripts | High custom launch/auth/profile/media compatibility risk | May change account/session behavior | Medium if fully isolated | Defer |
| Custom native metadata bridge / T3 flavor | Potentially individual native child activity **only if** structured child events exist at source | Requires both ACP producer and T3 consumer; private hooks fragile | Potentially low extra model tokens | Low-medium | Research only after real wire evidence |
| Parse transcript files/prose into fake child cards | Superficial individual cards, unreliable status/attribution | Very fragile, races and security/privacy issues | Extra storage/polling | Medium | Reject |

## 11. What is impossible without upstream help

A native child transcript, independent child cancel, native child follow-up, or faithful per-child tool attribution **cannot be honestly derived** from one batch tool call with no child/session IDs and no child event stream. The actual Antigravity ACP producer must expose structured identity and lifecycle (through supported standard ACP extension or another documented mechanism), and T3's adapter must consume and persist it. Instrumenting proprietary process internals or scraping transcript files is not the smallest sustainable first step.

Potential upstream contributions after reproductions:

1. **T3:** Add an Antigravity-focused mock for async delegated result delivery and post-settle continuation, linked to issue #17412 but explaining that it was closed without reproduction.
2. **T3:** Add exact background-command lifecycle and cancellation fixtures from #16442/#28415, then a bounded fix using observed metadata.
3. **T3 / ACP:** Propose structured native child IDs, parent relationship, child tool session ID, state, and transcript access only with actual protocol evidence. Avoid requesting UI design based on unavailable fields.
4. **Our wrapper:** Add an orchestration-preserving policy with testable allow/deny decisions, clearly differentiating saved global MCP from per-session T3 MCP.

## 12. Required local evidence not yet obtained

To settle installed/upstream differences, ask the local agent for **redacted structured diagnostics only**:

- T3 exact version, commit/package ID, and provider driver registration.
- ACP executable version and SHA-256, wrapper hashes, Node version; no proprietary binary upload.
- Sanitized initialize result: protocolVersion, agentCapabilities and clientCapabilities (no credentials).
- For one synthetic prompt and session setup, the names/types of injected MCP servers *before and after* the wrapper, plus presence/absence booleans for fallback environment variables. Never print authorization values.
- For an optional two-child synthetic run, pseudonymized toolCallId, sessionId, parent/child identifiers if present, event kinds, statuses, and timestamps. No private conversations or screenshots necessary.
- T3's emitted domain event kinds and stored task status transitions, to locate any post-ACP loss.

## 13. Release acceptance and rollback

**Accept only if:** MCP discovery and fallback work; two app-owned children are distinct and inspectable; tool attribution is stable; success/failure/cancellation are accurate; parent wake/result delivery are proven if advertised; reload preserves state; permissions are not misrepresented; no orphan background work remains; Argon model/proxy/prompts/media/context/search retain existing behavior.

**Rollback:** stop candidate children, disable isolated candidate provider, restore original launcher/environment selection and known runtime, leave production proxy accounts and T3 thread data unchanged. No schema migration, token reuse, or replacement of the patched official binary.

**Final judgment:** The nearest practical approach to Codex-quality *individual* Argon agents is T3-owned delegation, because T3 already owns the durable child structure. Our wrapper currently blocks this path. Restore it selectively and test failure modes first. Do not conflate that achievement with native Antigravity child parity.

---

### Source register

- [Local project research brief](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/RESEARCH-PROMPT.md)
- [Local snapshot provenance](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/SNAPSHOT.json)
- [Local wrapper](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/adapter.cjs)
- [Local launcher](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/launch.cjs)
- [T3 dedicated Antigravity adapter](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.ts)
- [T3 generic ACP adapter](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/provider-acp/src/server/adapter.ts)
- [T3 registry flavor](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/provider-acp-registry/src/server/adapter.ts)
- [T3 Codex adapter](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts)
- [T3 orchestration MCP contract](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/contracts/src/orchestratorMcp.ts)
- [T3 orchestration MCP design](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/docs/orchestration-v2/orchestrator-mcp-server.md)
- [ACP upstream specification](https://github.com/agentclientprotocol/agent-client-protocol/tree/b4c72a80f32f4c61d87270d90891c7ce14511b9a)
- [ACP official Antigravity registry distribution](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json)
- [Reported async wake issue #17412 (closed for lack of reproduction)](https://github.com/pingdotgg/t3code/issues/17412)
- [Reported command-stop issue #16442](https://github.com/pingdotgg/t3code/issues/16442)
- [Reported background-task issue #28415](https://github.com/pingdotgg/t3code/issues/28415)
- [Reported delegated-result issue #28448](https://github.com/pingdotgg/t3code/issues/28448)
