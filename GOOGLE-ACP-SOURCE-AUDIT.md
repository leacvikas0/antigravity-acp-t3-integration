# Google's Native Antigravity ACP/Event Source: Public-Code Audit

**Date:** 2026-11-01  
**Scope:** Ground the desired *native* child-agent visibility in Google's actual public protocol/SDK code. No production modification.  
**Owner goal:** The Antigravity harness continues to run its own agents, commands and planning. T3 remains a desktop/mobile **presentation and persistence** layer; the `t3-code` orchestration MCP stays intentionally blocked.  
**Source revision inspected:** [google-antigravity/antigravity-sdk-python commit 75ba22bd00afae2f46393ff31f30c3f0df52982f](https://github.com/google-antigravity/antigravity-sdk-python/tree/75ba22bd00afae2f46393ff31f30c3f0df52982f). This is official Google SDK source, not the full public source of the separately distributed proprietary ACP server. [Google's product blog](https://antigravity.google/blog/introducing-google-antigravity-sdk) and [Google Cloud blog](https://cloud.google.com/blog/topics/developers-practitioners/choosing-your-surface-antigravity-20-antigravity-cli-antigravity-ide-or-antigravity-sdk) confirm the shared underlying harness.

## 1. The key new discovery

**Google's native wire protocol already carries identity and explicit waiting state.** These are real source fields, not hypothetical proposal attributes.

| Native event, field | Location | Meaning / visibility opportunity |
| --- | --- | --- |
| `OutputEvent.seq_num`, `timestamp_micros` | [localharness.proto L349-L361](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/proto/localharness.proto#L349-L361) | Native ordering and event timestamps. Better than UI wall-clock guesses. |
| `StepUpdate.trajectory_id`, `parent_trajectory_id`, `step_index` | [proto L378-L410](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/proto/localharness.proto#L378-L410) | Real native child-tool/action relationship; index scoped to trajectory. |
| `StepUpdate.state=ACTIVE/DONE/WAITING_FOR_USER/ERROR` | same | Grounded per-step lifecycle. |
| `TrajectoryStateUpdate.trajectory_id`, `parent_trajectory_id`, `depth` | [proto L563-L589](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/proto/localharness.proto#L563-L589) | Stable native agent relationships and nesting. |
| `TrajectoryStateUpdate.STATE_WAITING_FOR_SUBAGENTS` | same | The exact native state the user asked about: a parent waiting on child agents. |
| `TrajectoryStateUpdate.STATE_WAITING_FOR_TASKS` | same | Separate task wait from subagent wait. |
| `TrajectoryStateUpdate.STATE_RUNNING/FULLY_IDLE/CANCELLED` | same | Lifecycle; `FULLY_IDLE` is not identical to completion of a single tool step. |
| `ToolCall.id`, `name`, `trajectory_id` | [proto L601-L609](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/proto/localharness.proto#L601-L609) | Associate tool execution with real native owner, not with title-based heuristics. |
| `ActionRunCommand.command_line`, `working_dir`, `exit_code`, `combined_output` | [proto L508-L513](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/proto/localharness.proto#L508-L513) | Actual command and final outcome. Streaming stdout or a process PID are **not guaranteed** by these fields. |
| `UsageUpdate.agents[].trajectory_id` | [proto L589-L602](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/proto/localharness.proto#L589-L602) | Per-agent usage, if the ACP producer can pass it through. |

The Python SDK's public `types.Step` model also contains `trajectory_id`, `parent_trajectory_id`, `depth`, `status`, `tool_calls`, content deltas, and errors: [types.py L1427-L1488](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/types.py#L1427-L1488).

These fields establish that a native child tree is **representable in the official underlying protocol**. Whether the active `agy_acp_server_1.4.3` exposes them on ACP stdio is a separate question.

## 2. Proven SDK filter: child states are discarded from the normal turn stream

[Google SDK `LocalHarnessEventProcessor.process_event`](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/connections/local/event_processor.py#L941-L985):

- When it sees a `trajectory_state_update`, it checks whether `tsu.trajectory_id != self.main_trajectory_id`.
- On subagent state events it logs an error if present, then returns. It does **not** enqueue those events for the ACP layer and does not track individual child's state as an exposed event stream.
- For the *main* trajectory it handles RUNNING, FULLY_IDLE and CANCELLED, but there is no normal-step-queue handling of WAITING_FOR_SUBAGENTS or WAITING_FOR_TASKS. A parent may be known as non-idle yet the precise **reason for waiting disappears** from this consumer.
- **Important nuance:** in the *separate* `step_update` branch, the SDK enqueues steps through `_emit_step`, using the individual trajectory ID. That means child **step/tool updates may still pass through the SDK queue** even while child **state events are filtered**. Do not claim the SDK drops all child activity. See [event_processor.py L845-L928](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/connections/local/event_processor.py#L845-L928) and [L612-L655](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/connections/local/event_processor.py#L612-L655).
- `LocalConnection.receive_steps` yields that step queue and stops at root idle; it does **not** yield the original state-update event objects: [local_connection.py L480-L515](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/connections/local/local_connection.py#L480-L515).
- Google's [event_processor_test.py](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/connections/local/event_processor_test.py#L781-L805) explicitly tests that subagent state updates do not alter root idleness.

The newer `InteractionsEventProcessor` also records parent relationships from `sub_interaction_id` and `parent_interaction_id`, then returns on child state events. Its separate `step` assembly can retain child identity: [interactions_event_processor.py L507-L545](https://github.com/google-antigravity/antigravity-sdk-python/blob/75ba22bd00afae2f46393ff31f30c3f0df52982f/google/antigravity/connections/local/interactions_event_processor.py#L507-L545). Do not assume this newer GAOS event transport is already used by ACP 1.4.3.

**Best telemetry observation point:** just as native `OutputEvent` enters `LocalHarnessEventProcessor.process_event`, **before** the existing `is_subagent:return` in the trajectory-state branch; separately observe the step branch before the SDK queue/ACP projection loses identity. A low-overhead observer can preserve native IDs, event timestamps and waiting reason without interfering with root idle semantics.

## 3. Official standalone ACP server is distributed and patchable, not open-source on GitHub

- The [official ACP Registry](https://github.com/agentclientprotocol/registry/blob/main/antigravity-acp/agent.json) distributes Google's proprietary `agy_acp_server` as binaries for major OSs (current registry version independently fetched: **1.4.5**).
- **The user should not be asked to supply proprietary bytes as the default research path.** Fetch the 1.4.3 archive directly from the publicly documented Google CDN in an environment with network access and inspect its embedded Python code; verify its hash. Our current execution environment could read public SDK and GitHub source but could not download that large binary from `dl.google.com`.
- The public project [paperclipai/paperclip patch-antigravity-runtime.mjs](https://github.com/paperclipai/paperclip/blob/73cd8eb9a5480258e73e2dee42ca0894bf26f508/packages/paperclip-runner/scripts/patch-antigravity-runtime.mjs) **already demonstrates patching the official 1.4.3 distribution's embedded Python files**. It pins hashes and identifies the embedded paths:
  - `google3/cloud/developer_experience/antigravity_extensions/acp_server/server.py`
  - `google3/third_party/py/google/antigravity/connections/local/local_connection.py`
  - `google3/third_party/py/google/antigravity/connections/local/event_processor.py`
  
  Its patch addresses other tool lifecycle behavior, not native child observability, but demonstrates the exact source-level surface. It targets a pinned macOS ARM64 package; don't transplant its binary technique blindly to Windows.
- A separate [source audit of official 1.2.1](https://github.com/arpan404/ace/blob/bb0bb3b128dd915030d53c8bf794e1f942938b48/docs/research/providers/antigravity.md) inspected embedded ACP `server.py` and found that subagents appeared as opaque `start_subagent` tool calls; the ACP mapper did not send child IDs or lifecycle events. It noted that the SDK step queue still carries per-trajectory steps, but the ACP mapping ignored identity. **This is strong older-version evidence, not proof of identical code in 1.4.3.**
- The user's earlier [RESEARCH-PROMPT.md](RESEARCH-PROMPT.md) reports local 1.4.3 inspection found suppression of child assistant/thought deltas; reconfirm directly against the official downloaded 1.4.3 `server.py` rather than treating it as independently proven by this investigation.

## 4. Corrected architecture decision

**Do not touch T3's `t3-code` MCP exclusion.** Native Argon owns all orchestration.

Investigate in order:

1. **Source proof, no live account:** obtain official pinned 1.4.3 archive independently from Google's registry/CDN; extract embedded `server.py`, `local_connection.py`, `event_processor.py`. Locate `_stream_live_step`, parent-vs-child filtering, `session/update`, `prompt()`/turn state logic and tool progress mapping. Diff relevant sections against SDK revision; publish *source-path/function/line references or small snippets only*, not Google's proprietary package.
2. **One synthetic native event fixture:** construct `OutputEvent` instances using the public protobuf schema with root `STATE_WAITING_FOR_SUBAGENTS`, child A/B started/running/failed/done and interleaved `StepUpdate` tool calls. Observe that the current processor drops child states while emitting tool steps. No Argon model quota needed.
3. **Passive source-side observer candidate:** before current filters, mirror only structured native event metadata (root/parent/child ID, event sequence/time, state, tool call ID, command lifecycle) to bounded side-channel output. Do **not** turn `TrajectoryStateUpdate` into root chat text; do not change native scheduler behavior or root idle calculation.
4. **T3 consumer fixture:** map a synthetic native child event to T3's existing persisted child and turn/tool event vocabulary. Prove two children, tool owner, parent wait, command progress and reload/mobile delivery **without** any T3-owned child provider session.
5. **Select supported transport:** if official ACP session/update extensible metadata is accepted by T3 generic driver, prefer it; otherwise an isolated side channel with explicit T3 custom adapter consumer. Check both producer and consumer: unrecognized extensions may be rejected or ignored. Treat raw native thought/reasoning carefully—user needs observable work, not unfiltered private model state.
6. **Only then tiny live acceptance:** one native parent with two native children, no new orchestration MCP, using existing Argon account/proxy and full regression checks with separate user approval.

## 5. What is now known vs still unproven

**Grounded in Google code:** real native child/parent IDs, step IDs, tool IDs, sequence/timestamps, waiting-for-subagents state, command text/working directory/final result; SDK per-child state filtering and per-trajectory step queue.

**Grounded in third-party source inspections, not reproduced here:** official 1.2.1 ACP projection loses child identity; official 1.4.3 embedded source is patchable with pinned hashes.

**Still unproven in the user's installed 1.4.3:** exact filter and tool forwarding implementation in `server.py`; which child events actually arrive in practice; whether live background stdout and tool process IDs are available; whether full native worker lifecycle can be projected with no extra source hooks; installed T3 revision compatibility.

**Bottom line:** The native harness is **not inherently incapable of reporting child identities or waiting state**—the publicly documented protocol already carries those. The engineering target is a read-only observer **before information is dropped**, followed by a minimal T3 event adapter. Verification of the exact 1.4.3 producer remains necessary, but it does **not require the user to send us their binary**.
