# Native Antigravity Subagent Observability — Corrected Goal and Research Handoff

**Date:** 2026-11-01  
**Status:** Corrected research direction, no live patches or configuration changes  
**Authoritative user requirement:** Native Antigravity does the orchestration. T3 Code is the excellent desktop/mobile user interface.

> **New public-source findings (2026-11-01):** See [GOOGLE-ACP-SOURCE-AUDIT.md](GOOGLE-ACP-SOURCE-AUDIT.md). Google's published native protocol **already carries** `trajectory_id`, `parent_trajectory_id`, `STATE_WAITING_FOR_SUBAGENTS`, per-trajectory tool ownership, and event sequence/timestamps. The SDK explicitly ignores separate child state notifications on its normal step queue, and older ACP source inspections show an additional projection loss. The first job is now to verify and instrument the precise **official ACP 1.4.3 event producer/filter**, not to hypothesize that native child identity may not exist or to enable T3 delegation. The full standalone ACP server remains proprietary; the official download can be independently obtained from Google's CDN rather than requiring the user to provide it.

## 0. Correction to the earlier report

The earlier [RESEARCH-REPORT.md](RESEARCH-REPORT.md) recommended restoring T3 Code's app-owned `delegate_task` mechanism. **That recommendation is not aligned with the user's goal.** T3's injected orchestration instructions and `t3-code` MCP tools are not wanted. The wrapper's deliberate removal of them is part of the intended product design, **not a bug to reverse**. Do not turn them back on in an implementation candidate unless the user explicitly changes that requirement.

Keep the factual source findings from the earlier report where valid (pinned code paths, upstream event handling, native batch status, release compatibility risks). Disregard its route selection, T3 delegate-task acceptance plan, and any argument that additional T3-owned provider sessions are the target solution.

> Desired architecture: **one native Antigravity parent session, its existing native subagents and commands, truthful telemetry from that native runtime, displayed and persisted by T3's desktop and mobile interfaces. No T3-injected agent orchestration.**

This is an **observability / adapter / protocol instrumentation problem**, not a request to build a second agent framework.

## 1. What the user needs to see

The native harness already launches and uses its own subagents. Today, their behavior is opaque from T3:

1. **Who is working?** Every native agent/subagent with a real stable ID, purpose/task, parent relationship, and actual progress state.
2. **What is the parent doing?** Is it executing tools, thinking, dispatching children, waiting for child completion, blocked on a command, or genuinely finished? Never guess from silence alone.
3. **What commands are running?** Exact command (subject to safe redaction), working directory when appropriate, queued/start/finish times, elapsed duration, exit status, and a bounded stream/preview of stdout/stderr where feasible.
4. **What are children doing?** Their native reasoning/progress summaries if available, child tool call ownership, tool inputs/outputs at reasonable granularity, errors, and completion results.
5. **How concurrent is execution?** Whether children work in parallel; which parent tasks depend on which children; distinguish root turn finished from child finished, background shell still running, or task idle/waiting.
6. **What happened after reload?** Accurate persistence/replay in T3 history and near-real-time event delivery through its existing mobile interface.

Read-only visibility is the priority. Independent native child cancellation/follow-up is **optional** and must only be advertised if supported by the native runtime. Do not fabricate individual agents from one batch event or use arbitrary tool call titles as identities.

## 2. Non-negotiable constraints

- **Do not enable or inject `t3-code` MCP** or T3 orchestration XML, terminal fallback, `delegate_task`, or new app-owned child sessions. Keep existing stripping as intended.
- **Do not alter the actual Antigravity planner/orchestrator**, its native subagent selection, child prompts, tools, quotas, or execution semantics. Telemetry must be passive, bounded, and ideally feature-gated.
- Preserve the **existing patched official ACP 1.4.3 runtime**, current generic `acpRegistry` launch path and native Argon model mapping. A future ACP 1.4.5 port is a separate project.
- Preserve current proxy/account pool, prompt/identity behavior, context-window/compaction settings, multimodal `view_file`, attachment passing, Parallel Search MCP, and full-access workspace behavior.
- Prefer existing T3 event sourcing, projection and mobile transport over custom UI architectures.
- Never leak authentication tokens, system prompts, private model reasoning, client messages or credentials into diagnostic traces. Respect what the native harness actually permits for progress display.
- Document any local native patch as optional and rollback-safe. Do not silently change production.

## 3. Established static observations vs open questions

### Confirmed by inspected published source

- Local published snapshot pinned to `ce80a2a726d630a78528d7822b3e330a37eef269`. Relevant files: [wrapper](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/adapter.cjs), [launcher](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/launch.cjs), [native patch](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/harness/bin/1.4.3/acp_patch.py), and [original research brief](https://github.com/leacvikas0/antigravity-acp-t3-integration/blob/ce80a2a726d630a78528d7822b3e330a37eef269/RESEARCH-PROMPT.md).
- `harness/adapter.cjs` normally forwards incoming `session/update` notifications, except limited config projection. It does not indiscriminately erase all native subagent notifications.
- The generic `acpRegistry` flavor has no native Antigravity-specific child-ID extractor at pinned T3 revision `b50d8a1b15eed3a75e1e0969765e14c6436d80d7`: [registry adapter](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/provider-acp-registry/src/server/adapter.ts).
- Dedicated `AntigravityAdapterV2.ts` recognizes `start_subagent`/`invoke_subagent` tool *batches* and projects `childSessionId: null`, `model: null`, and a batch toolCallId: [implementation L85-L107](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/Adapters/AntigravityAdapterV2.ts#L85-L107).
- T3's shared ACP adapter *can* represent child sessions if real child IDs/notifications arrive and are mapped; its event ingestor, projections, persistent store, and client reducers already provide relevant primitives: [shared ACP L2787-L2975](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/packages/provider-acp/src/server/adapter.ts#L2787-L2975), [ingestor](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/ProviderEventIngestor.ts), [projections](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/ProjectionStore.ts).
- Local native patches currently focus on media, context, behavior and file access. The published source does **not** implement a native child telemetry bridge in `acp_patch.py`.
- Codex's dedicated adapter has native, stable child IDs and separately attributed activity. Codex is a **UX reference**, not proof Antigravity's ACP exposes identical data: [CodexAdapterV2.ts](https://github.com/pingdotgg/t3code/blob/b50d8a1b15eed3a75e1e0969765e14c6436d80d7/apps/server/src/orchestration-v2/Adapters/CodexAdapterV2.ts).

### Source-derived but not independently runtime-verified

- The original local research brief says inspected official ACP 1.4.3 code suppresses child-trajectory assistant/thought deltas from the parent chat stream to avoid cross-agent interleaving. Locate the actual native producer/filter and verify that claim against the installed binary/extracted code.
- The precise internal native subagent identifiers, event callbacks, child-state machine, command state, background task IDs, parent dependencies, and correlation path have **not** been captured in this investigation.
- The exact installed T3 code and official ACP binary hashes have not been verified against pinned source commits.

### Separate upstream issues, not proof of local bugs

- [T3 #16442](https://github.com/pingdotgg/t3code/issues/16442) and [#28415](https://github.com/pingdotgg/t3code/issues/28415) concern foreground/background commands, turn completion and wake events. These affect truthful telemetry but have not been reproduced in this installation.
- [T3 #17412](https://github.com/pingdotgg/t3code/issues/17412) concerns T3-owned delegation, **not our desired mode**. It was closed for missing reproduction and should not drive this project.
- [T3 #28448](https://github.com/pingdotgg/t3code/issues/28448) concerns app-owned delegated-result delivery; background reliability principles may transfer, but it is **not** a reason to restore T3 MCP.

## 4. Research the loss point before designing a bridge

Trace this exact pipeline:

    Antigravity native scheduler / agent worker / tool runner
       | [native events with real child/parent identity?]
       v
    official Antigravity ACP server (1.4.3)
       | [filters? emits root-only session/update?]
       v
    our patched ACP runtime and Node wrapper
       | [JSON-RPC session/update and any side channel]
       v
    T3 generic ACP adapter / possible targeted native-aware extension
       | [normalized child tool/turn/background events]
       v
    T3 event ingestion, persistence, projection, WebSocket transport
       v
    T3 desktop + mobile subagent views / command state

For each boundary **collect a redacted, structured event specimen** from a synthetic one-parent/two-child run, or explain why it cannot be collected. Record: native worker ID, parent ID, task/group ID, ACP session ID, child turn ID, tool call ID, event kind, start/end time, status and command state. Missing data is not implied by absent UI.

Identify whether each piece of desired telemetry is:

- generated natively but filtered at the ACP server;
- emitted over ACP but ignored/misclassified by our Node wrapper;
- available in T3 adapter but not mapped into child events;
- persisted but absent or collapsed in the UI/mobile views;
- genuinely **not produced** at any supported boundary.

**Highest-value next investigation:** inspect the **real native subagent scheduler/worker callbacks and the ACP child-trajectory suppression branch** from the actual 1.4.3 environment. Determine whether there is a stable worker/conversation/task ID and a supported place to add read-only event mirroring. Do not assume the name of a private symbol from third-party reports.

## 5. Candidate telemetry path (subject to discovery)

The preferred architecture is **native-owned execution, T3-owned presentation only**:

1. At the *native source of truth*, observe dispatch, worker created, child started, child tool start/update/end, native child output/progress, child terminal state, parent wait/unwait, and background command state. Never launch new workers for tracing.
2. Assign **stable observed IDs** from the native harness. If native IDs are not globally unique, define a deterministic namespaced composite: (ACP root session, native parent/child worker ID, tool ID), retaining original IDs. Do not use wall-clock time or tool title as the primary identity.
3. Mirror a bounded, structured event stream through a **documented extension where possible**. Compare:
   - A. Existing ACP session/update or supported metadata/extension carrying child identity, *without* corrupting root conversation content.
   - B. A narrowly scoped local side channel from the patched native server to our Node wrapper, plus a targeted T3 adapter ingestion path.
   - C. A T3 dedicated native-aware adapter only if it can preserve the entire custom launcher/auth/proxy/patch chain.
   
   No route should add `t3-code` MCP tools or prompt tokens. Do not assume T3's stock generic ACP normalizer will recognize custom JSON-RPC notifications. Identify exact modification sites and capabilities for *both* producer and consumer.
4. Convert observed native events into T3's existing durable subagent and tool event model, preserving parent-child correlation. Avoid new frontend UI unless existing screens cannot show the semantics faithfully.
5. Surface the same persisted timeline on mobile. Reconnect/reload should reproduce correct status without live agent re-invocation.
6. Keep telemetry feature-gated, bounded, race-safe and nonblocking. Instrumentation failure must not crash the native agent or leak secrets.

### Minimum event contract to evaluate, not an assertion about current API

    NativeAgentEvent {
      rootSessionId: string,
      nativeAgentId: string,
      nativeParentAgentId?: string,
      nativeTaskId?: string,
      eventId: string,
      sequence?: number,
      timestamp: string,
      type: "agent_started" | "agent_progress" | "agent_waiting" |
            "tool_started" | "tool_updated" | "tool_completed" |
            "agent_completed" | "agent_failed" | "agent_cancelled",
      toolCallId?: string,
      toolName?: string,
      command?: { argvOrShell?: string, cwd?: string, pid?: number,
                  startedAt?: string, endedAt?: string, exitCode?: number,
                  background?: boolean },
      status?: string,
      payloadPreview?: string
    }

Treat every optional field as unknown if the native runtime does not expose it. A pending native agent does not imply the parent is waiting; parent waiting must come from explicit state, a verifiable dependency record, or be labeled **inferred**.

**Command visibility rules:** distinguish dispatched/scheduled, running, waiting, complete, failed, timed out and cancelled; show elapsed time from actual observed start. Preserve captured stdout/stderr with configurable caps/redaction and avoid exposing sensitive environment variables.

## 6. Minimal deterministic test program

Mocks first; test event transport, adapter mapping, persistence and mobile semantics without Argon calls:

| Test | Source event fixture | Required outcome |
| --- | --- | --- |
| N1 | Native parent dispatches child A/B | Two native children linked to **one** parent, no new T3 worker sessions |
| N2 | A/B overlapping tool calls with identical tool names | Correct native child owner, stable tool ID, no interleaving contamination |
| N3 | A command remains running after parent message/turn settles | UI still says command running/background, not completed |
| N4 | Parent explicitly waits on A and B | Parent displays waiting; child status remains independent |
| N5 | A succeeds, B fails; late child events arrive | Distinct terminal states, honest parent and aggregate state |
| N6 | Native child event lacks identity | Graceful **unattributed/batch** display, never invented child agent |
| N7 | Kill/restart T3 server and reconnect mobile | Child IDs, owner, command durations/status and result history persist |
| N8 | Duplicate, out-of-order and dropped events | Idempotent projection; state reconciliation; known-unknown states rather than false success |
| N9 | Cancel parent while child/command still running | Reflect actual observed cancellation/continuation; don't claim process stopped without proof |
| N10 | Telemetry transport fails/backpressure | Native model execution remains functional; bounded memory and no prompt contamination |
| N11 | Deliberately sensitive command/env sample | Mask secrets in logs and mobile UI; no auth leakage |
| N12 | Native media/search/context regression fixtures | Existing ACP output/launch/prompt behavior unchanged |

Only after these pass, perform **one small live native two-child trace** with user's approval, using existing account/proxy and no large attachment. Compare native internal trace, ACP JSON-RPC, T3 persisted events and both desktop/mobile. Avoid broad model benchmarks.

## 7. Realistic architecture decisions

| Option | Advantages | Costs / failure modes | Position |
| --- | --- | --- | --- |
| Use native child IDs already present in official ACP notifications | Minimal patch and no extra model calls | Only works if identifiers/tools actually cross the wire and T3 can parse them | **Investigate first** |
| Feature-gated read-only native ACP instrumentation, then a T3 adapter event bridge | Preserves native planning and offers real progress if callbacks exist | Private runtime patch fragility and ACP/T3 compatibility; needs producer+consumer implementation | **Primary candidate if ACP filters data** |
| Use a dedicated native-aware T3 adapter while retaining custom launch/profile | Potentially simpler projection changes | Existing dedicated spawn/profile path may bypass custom runtime/proxy/auth/media; higher migration risk | Evaluate, not default |
| Native log/trace sidecar | Could expose otherwise hidden native scheduling events | Hard to correlate; secrecy, version drift and polling; cannot invent missing lifecycle | Diagnostics or optional fallback |
| Enable T3 orchestration MCP / delegate_task | T3-owned child IDs and UI | **Changes execution ownership, context and tools; explicitly unwanted** | **Rejected** |
| Fake child cards from tool title/prose parsing | Looks good | Incorrect statuses, ownership and concurrency | **Rejected** |

No code change to Google's runtime should be proposed until the exact event source and distribution/patch feasibility are confirmed. Prefer supported protocol extension when real. If native internals expose no stable identity, state limitations rather than selling fake equivalence to Codex.

## 8. Questions for the local agent to answer precisely

1. Where is `start_subagent` or equivalent actually scheduled in **native** 1.4.3 code? What event object carries root/child IDs, task ID, status and tool ownership?
2. Is child trajectory suppression in the ACP server, agent runtime, or T3? Which fields are deliberately discarded? Can a **read-only** hook mirror them while preserving the ordinary root response?
3. Are native command executions child-scoped, and where can we observe shell command text, start/end/exit, background task ID and cancellation?
4. Can our present generic ACP integration consume an extension? If not, identify the narrowest safe adapter change and whether it requires a local T3 fork.
5. Will the proposed native events travel through T3's existing persistence/websocket/mobile UI without duplicating root tokens or mixing child output into root text?
6. How will you distinguish parent waiting from parent idle/thinking without inventing state?
7. What exactly differs between current installed versions and the pinned research snapshot? Can custom runtime patches and the existing proxy/model/context/media stack remain untouched?
8. What is the smallest **mocked** end-to-end demonstration proving a native child event shown in T3 before spending model quota?

## 9. Definition of done

- Argon continues to use **its own native** subagents and tool planner.
- T3 injections remain off; no `delegate_task`, app-owned child sessions or extra orchestration prompts.
- At least two actual native children show distinct, truthful identities and parent links.
- Their tool/command events, running/waiting/completed/failed state and bounded history are properly attributed.
- The parent accurately reflects its own state, including observed waits and live background work.
- Reloaded T3 desktop and mobile show consistent durable information; no secret leakage.
- All current proxy/Argon/behavior/context/media/search behavior is preserved.
- Missing native fields are explicitly marked unavailable rather than guessed.
- An isolated candidate, tests and rollback instructions exist. **Production remains unchanged until separately authorized.**

## 10. Copy-paste handoff prompt

> Read [NATIVE-OBSERVABILITY.md](NATIVE-OBSERVABILITY.md) first, then the pinned source links in that document, the repository's README.md, SNAPSHOT.json, and RESEARCH-PROMPT.md.
>
> **Critical clarification:** I DO NOT want T3's orchestration tools, MCP injection, `delegate_task`, or T3-owned child agents. The native Antigravity harness already owns the orchestration and runs its own subagents well. I want to keep T3 ONLY as the excellent desktop/mobile interface and make the native agent's internal child execution observable. Do not undo our intentional filtering of T3 tools.
>
> Find the exact point where native subagent identity/progress/tool/command/wait information is lost between Antigravity's native scheduler, official ACP server, wrapper, T3 adapter and UI. Inspect the *installed* native 1.4.3 runtime where authorized, not just upstream T3 code. Prove the producer event schema, stable child IDs, parent relationship, tool ownership, status transitions and background command lifecycle.
>
> Investigate the smallest **passive, read-only, feature-gated telemetry bridge** that can expose those native events through T3's existing persisted subagent timeline and mobile UI. A supported ACP metadata extension is preferred if possible; otherwise evaluate a minimal native-side mirror plus a T3 adapter consumer. Never fabricate child IDs or parse prose into fictional child states. Keep T3 orchestration disabled and preserve our current Argon/proxy/models/context/media/behavior/search and full-access configuration.
>
> Deliver an evidence table (verified/hypothesized/unavailable), exact source symbols and data boundaries, event contract, concrete adapter patch points, mock-first tests for two overlapping native children and running commands, UI/persistence mapping, version/compatibility risks and rollback. Prepare only isolated candidate changes; no production modifications, account changes or live Argon calls without my approval. If some visibility is genuinely impossible with the current native API, tell me exactly why and what upstream producer event would be needed.

**Scope authority:** This corrected goal takes precedence over conflicting route recommendations in RESEARCH-REPORT.md.