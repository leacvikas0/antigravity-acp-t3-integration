# Antigravity ACP / T3 integration research snapshot

Source-only snapshot of a locally customized Antigravity ACP 1.4.3 integration, published for independent research into subagent visibility and T3 integration. This is not Google's ACP distribution and is not a portable, supported installer.

## Layout

- `harness/`: local Node launcher/adapter, media instruction handling, behavioral core, settings, tests.
- `harness/bin/1.4.3/`: local Python extension and installation helpers, context policy. Official binaries deliberately excluded.
- `harness/proxy-supervisor/config.example.json`: configuration example with local username replaced; supervisor executable excluded.
- `tests/`: selected synthetic context/tool-stream regression fixtures. Some assume original absolute paths or maintenance layout; inspect before running.
- `SNAPSHOT.json`: provenance, exact-file hashes and exclusions.
- `RESEARCH-PROMPT.md`: the requested independent investigation.

## Current architecture

T3 runs a custom local ACP command using its `acpRegistry` driver, agentId `antigravity-acp`. The command is Node running `harness/launch.cjs`, which starts/adopts a separate local proxy and launches the official Antigravity ACP binary through `adapter.cjs`. The binary is pinned to 1.4.3. Gateway model is `gemini-4-argon`, with low/medium/high reasoning selection. Actual account credentials and gateway key are supplied privately by the existing installation, never this repository.

Python customization adds multimodal file reads, full-access behavior, templated identity/preferences/profile integration and gateway-specific context accounting. Context is 1,048,576 tokens; compaction target 650,000; maximum output allowance 131,072. Separate native trajectory limit was raised locally from 25 MiB to 1 GiB; no modified Google binary is distributed here.

The installed proxy is a separately modified AIStudio2API v0.2.16. Its source, account states, browser cookies and binaries are outside this snapshot. Proxy replacement, account import and transport rewrites are not part of the requested research.

## Known observations versus hypotheses

Observed in saved local settings: driver is `acpRegistry`, not T3's dedicated `antigravity` provider.

Observed in official ACP 1.4.3 server source inspected locally: child-trajectory assistant/thought deltas are not forwarded as root chat messages, to prevent interleaving concurrent streams. This does not establish that every child tool event is discarded.

Observed in current public T3 main source: the dedicated Antigravity flavor recognizes native subagent batches, returns no child session ID, and labels them as batches. This is not proof that the installed T3 version contains exactly that implementation. Research must pin and compare versions.

Hypothesis: selecting the dedicated flavor may improve presentation compared with the generic driver. It is not yet tested and does not guarantee independently inspectable children.

ACP 1.4.5 is available. Static package inspection found additional workspace support and a changed file-reader integration; the existing `make_safe_view_file` hook is not sufficient unchanged. The inspected context-counting function still adds cached tokens to total. No 1.4.5 candidate has been deployed or behaviorally accepted.

## Privacy and upstream ownership

No account credentials, personal profile/preferences, private transcripts, logs, screenshots, media, extracted Google SDK/server source or proprietary executables are included. Existing copyright notices remain. This repository grants no rights to Google's proprietary software. Obtain upstream runtimes from their official distribution and follow their terms.

The snapshot represents the installation at publication time, not a complete backup or continuously synchronized upstream fork. Preserve private production backups separately.

## Additional finding during snapshot validation

The local adapter itself defaults `stripT3` to true unless `ARGON_ACP_KEEP_T3_BLOAT=1`. It strips T3 prompt blocks, removes the `t3-code` MCP from client server lists, and deletes T3_ACP_MCP_ENDPOINT/AUTHORIZATION/ENTRYPOINT/NODE from the child environment. The launcher also filters a saved t3-code MCP entry. Investigate both layers before assuming T3-owned delegation is available. Determine the original motivation and whether selective preservation can retain orchestration without restoring unrelated instruction bulk. No production change has been made.

Snapshot verification: 23 of 24 bundled Node tests passed. The remaining multimodal fixture invokes the deliberately omitted proprietary ACP executable; spawn returned no process exit status. This is not an accepted end-to-end multimodal run.
