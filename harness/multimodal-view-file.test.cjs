const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const ROOT = __dirname;
const EXE = path.join(ROOT, "bin", "1.4.3", "agy_acp_server.exe");
const PATCH_PY = path.join(ROOT, "bin", "1.4.3", "acp_patch.py");

test("acp_patch.py supports multimodal view_file, enforces workspace boundaries when restricted, and disables workspace containment in full access", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acp-mm-test-"));
  const siblingTemp = path.join(os.tmpdir(), `outside_${process.pid}.txt`);
  const created = [siblingTemp];
  try {
    fs.writeFileSync(siblingTemp, "outside-ok", "utf8");
    const avSrc = path.join(tmp, "av_input.mp4");
    const wavSrc = path.join(tmp, "audio_input.wav");
    execFileSync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=1:size=160x120:rate=12",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      avSrc,
    ]);
    execFileSync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      wavSrc,
    ]);

    const attachmentsDir = path.join(os.homedir(), ".t3", "userdata", "attachments");
    fs.mkdirSync(attachmentsDir, { recursive: true });
    const testPng = path.join(attachmentsDir, `test_mm_${process.pid}.png`);
    created.push(testPng);
    execFileSync("ffmpeg", [
      "-y",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=64x64:d=1",
      "-frames:v",
      "1",
      testPng,
    ]);

    const verifyHook = path.join(tmp, "verify_hook.py");
    fs.writeFileSync(
      verifyHook,
      [
        "import asyncio, json, os, sys",
        "patch_py = os.environ['PROD_ACP_PATCH']",
        "with open(patch_py, 'r', encoding='utf-8') as f:",
        "    exec(compile(f.read(), patch_py, 'exec'), {'__file__': patch_py, '__name__': '__acp_patch__'})",
        "from google.antigravity import types as sdk_types",
        "from google.antigravity.connections.local import event_processor, local_connection",
        "from google3.cloud.developer_experience.antigravity_extensions.acp_server import server as acp_server",
        "from google3.cloud.developer_experience.antigravity_extensions.acp_server import tools as acp_tools",
        "async def main():",
        "    ws = os.environ['TEST_WS_DIR']",
        "    allowed = [ws]",
        "    vf = acp_tools.make_safe_view_file(allowed)",
        "    sp = acp_server.resolve_skills_paths(ws)",
        "    assert any('.t3' in p and 'attachments' in p for p in sp)",
        "    _, vm = event_processor._extract_media_from_result(await vf(AbsolutePath=os.environ['TEST_VIDEO_MP4']))",
        "    assert len(vm) == 1 and vm[0].mime_type == 'video/mp4'",
        "    _, am = event_processor._extract_media_from_result(await vf(AbsolutePath=os.environ['TEST_AUDIO_WAV']))",
        "    assert len(am) == 1 and am[0].mime_type == 'audio/wav'",
        "    _, im = event_processor._extract_media_from_result(await vf(AbsolutePath=os.environ['TEST_IMAGE_PNG'], StartLine=1, EndLine=10))",
        "    assert len(im) == 1 and im[0].mime_type == 'image/png'",
        "    os.environ['ARGON_ACP_FULL_ACCESS'] = '0'",
        "    try:",
        "        await vf(AbsolutePath=os.environ['SIBLING_TEMP_FILE'])",
        "        raise AssertionError('Expected PermissionError in restricted mode')",
        "    except PermissionError:",
        "        pass",
        "    os.environ['ARGON_ACP_FULL_ACCESS'] = '1'",
        "    txt = await vf(AbsolutePath=os.environ['SIBLING_TEMP_FILE'])",
        "    assert txt == 'outside-ok', f'Unexpected content: {txt!r}'",
        "    assert acp_server.AgyAdapter._build_file_access_policies(None, [ws], lambda tc: True) == []",
        "    pb2 = local_connection.localharness_pb2",
        "    class DummyLCS:",
        "        def _orig(self):",
        "            return pb2.HarnessConfig()",
        "    sys.stderr.write('MM_TEST_OK\\n')",
        "    sys.exit(0)",
        "asyncio.run(main())",
      ].join("\n"),
      "utf8",
    );

    const verification = spawnSync(EXE, ["--notices"], {
      env: {
        ...process.env,
        ARGON_ACP_FULL_ACCESS: "0",
        GEMINI_HOME: path.join(ROOT, "t3-home"),
        ANTIGRAVITY_ACP_PATCH: verifyHook,
        PROD_ACP_PATCH: PATCH_PY,
        TEST_WS_DIR: tmp,
        SIBLING_TEMP_FILE: siblingTemp,
        TEST_VIDEO_MP4: avSrc,
        TEST_AUDIO_WAV: wavSrc,
        TEST_IMAGE_PNG: testPng,
      },
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
      timeout: 60000,
    });
    assert.equal(verification.status, 0, verification.stderr);
    assert.match(verification.stderr, /MM_TEST_OK/, verification.stderr);
  } finally {
    for (const f of created) {
      try {
        if (f && fs.existsSync(f)) fs.unlinkSync(f);
      } catch {}
    }
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch {}
  }
});