import ctypes
import glob
import os
import shutil
import struct
import sys
import tempfile
import time
import zlib

ROOT = r"C:\Users\silen\.gemini\antigravity-acp"
BIN_DIR = os.path.join(ROOT, "bin", "1.4.3")
ORIG_EXE = os.path.join(BIN_DIR, "agy_acp_server.exe")
BACKUP_DIR = os.path.join(ROOT, "setup-backups", "multimodal-view-file-2026-10-26")
BACKUP_EXE = os.path.join(BACKUP_DIR, "agy_acp_server.exe.bak")
PATCH_PY = os.path.join(BIN_DIR, "acp_patch.py")

PATCH_SOURCE = '# Copyright 2026 Google LLC\n"""Runtime patch for agy_acp_server: multimodal view_file (Image, Audio, Video)."""\n\nfrom collections.abc import Callable, Coroutine, Sequence\nimport itertools\nimport logging\nimport os\nimport pathlib\nimport stat\nfrom typing import Any\n\nimport google.protobuf.runtime_version\n\ngoogle.protobuf.runtime_version.ValidateProtobufRuntimeVersion = (\n    lambda *args, **kwargs: None\n)\n\nfrom google.antigravity import types as sdk_types\nfrom google.antigravity.tools import tool_context\nfrom google3.cloud.developer_experience.antigravity_extensions.acp_server import paths as acp_paths\nfrom google3.cloud.developer_experience.antigravity_extensions.acp_server import server as acp_server\nfrom google3.cloud.developer_experience.antigravity_extensions.acp_server import tools as acp_tools\n\nMAX_MEDIA_BYTES = 100 * 1024 * 1024\n\n_MEDIA_EXT_TO_MIME: dict[str, str] = {\n    # Images (sdk_types.SUPPORTED_IMAGE_MIMES)\n    ".png": "image/png",\n    ".jpg": "image/jpeg",\n    ".jpeg": "image/jpeg",\n    ".webp": "image/webp",\n    ".bmp": "image/bmp",\n    # Audio (sdk_types.SUPPORTED_AUDIO_MIMES)\n    ".wav": "audio/wav",\n    ".mp3": "audio/mp3",\n    ".m4a": "audio/m4a",\n    ".aac": "audio/aac",\n    ".ogg": "audio/ogg",\n    ".flac": "audio/flac",\n    ".opus": "audio/opus",\n    ".weba": "audio/webm",\n    ".pcm": "audio/l16",\n    ".l16": "audio/l16",\n    # Video (sdk_types.SUPPORTED_VIDEO_MIMES)\n    ".mp4": "video/mp4",\n    ".mov": "video/quicktime",\n    ".webm": "video/webm",\n    ".avi": "video/avi",\n    ".mpeg": "video/mpeg",\n    ".mpg": "video/mpg",\n    ".wmv": "video/wmv",\n    ".3gp": "video/3gpp",\n    ".flv": "video/x-flv",\n}\n\n\ndef _t3_attachments_dir() -> str:\n  return os.path.abspath(\n      os.path.join(os.path.expanduser("~"), ".t3", "userdata", "attachments")\n  )\n\n\ndef _media_cache_dir() -> str:\n  return os.path.abspath(os.path.join(acp_paths.acp_dir(), "media-cache"))\n\n\ndef _extra_media_dirs() -> list[str]:\n  return [_t3_attachments_dir(), _media_cache_dir()]\n\n\n_orig_resolve_skills_paths = acp_server.resolve_skills_paths\n\n\ndef _patched_resolve_skills_paths(cwd: str | None = None) -> list[str]:\n  paths = list(_orig_resolve_skills_paths(cwd))\n  att_dir = _t3_attachments_dir()\n  if att_dir not in paths:\n    os.makedirs(att_dir, exist_ok=True)\n    paths.append(att_dir)\n  return paths\n\n\ndef make_safe_view_file(\n    allowed_dirs: Sequence[str],\n    *,\n    defer_scope: bool = False,\n) -> Callable[..., Coroutine[Any, Any, Any]]:\n  """Factory to create a multimodal-capable view_file tool restricted to allowed directories."""\n  effective_dirs: list[str] = list(allowed_dirs)\n  for extra in _extra_media_dirs():\n    if extra not in effective_dirs:\n      effective_dirs.append(extra)\n\n  async def view_file(\n      absolute_path: str | None = None,\n      ctx: tool_context.ToolContext | None = None,\n      start_line: int | None = None,\n      end_line: int | None = None,\n      AbsolutePath: str | None = None,  # pylint: disable=invalid-name\n      StartLine: int | None = None,  # pylint: disable=invalid-name\n      EndLine: int | None = None,  # pylint: disable=invalid-name\n      **kwargs: Any,\n  ) -> str:\n    """View a file; full-access mode permits any path readable by this OS user.\n\n    Args:\n      absolute_path: The absolute path of the file to read.\n      ctx: The conversation tool context.\n      start_line: Optional starting line number (1-indexed).\n      end_line: Optional ending line number (1-indexed).\n      AbsolutePath: Alias for absolute_path.\n      StartLine: Alias for start_line.\n      EndLine: Alias for end_line.\n      **kwargs: Additional ignored keyword arguments.\n\n    Returns:\n      The string containing the file content (or native supplemental_media for image/audio/video files).\n\n    Raises:\n      PermissionError: If the path is outside the allowed directories.\n      ValueError: If no file path is specified.\n    """\n    del ctx, kwargs\n    path = absolute_path or AbsolutePath\n    s_line = start_line or StartLine\n    e_line = end_line or EndLine\n    if not path:\n      raise ValueError("absolute_path (or AbsolutePath) is required.")\n    if not os.path.isabs(path):\n      raise ValueError(f"absolute_path must be an absolute path, got {path!r}")\n\n    full_access = os.environ.get("ARGON_ACP_FULL_ACCESS") == "1"\n    if not full_access and not defer_scope and not any(\n        acp_tools._is_subpath(path, d) for d in effective_dirs\n    ):\n      raise PermissionError(\n          f"Access to path {path!r} is denied. It is outside the"\n          f" allowed workspace directories: {effective_dirs}"\n      )\n\n    ext = pathlib.Path(path).suffix.lower()\n    mime_type = _MEDIA_EXT_TO_MIME.get(ext)\n    if mime_type is not None:\n      file_path = pathlib.Path(path).expanduser()\n      try:\n        st = file_path.stat()\n      except FileNotFoundError as exc:\n        raise FileNotFoundError(f"File not found at path: \'{file_path}\'") from exc\n      except PermissionError as exc:\n        raise PermissionError(\n            f"Permission denied when reading path: \'{file_path}\'"\n        ) from exc\n      except OSError as exc:\n        raise OSError(f"Failed to stat file at path \'{file_path}\': {exc}") from exc\n\n      if stat.S_ISDIR(st.st_mode):\n        raise IsADirectoryError(f"Path is a directory, not a file: \'{file_path}\'")\n      if st.st_size == 0:\n        raise ValueError(f"Media file is empty (0 bytes): {path!r}")\n      if st.st_size > MAX_MEDIA_BYTES:\n        raise ValueError(\n            f"Media file {path!r} is {st.st_size:,} bytes, exceeding the "\n            f"{MAX_MEDIA_BYTES:,}-byte (100 MiB) inline media limit."\n        )\n\n      data = sdk_types._read_file_safely(file_path)\n      size = len(data)\n      media_obj = sdk_types.from_bytes(\n          data,\n          mime_type,\n          description=f"Viewed media file: {os.path.basename(path)}",\n      )\n      return {  # type: ignore[return-value]\n          "path": path,\n          "mime_type": media_obj.mime_type,\n          "size_bytes": size,\n          "media": media_obj,\n      }\n\n    start_idx = (s_line - 1) if (s_line and s_line > 0) else 0\n    end_idx = e_line if (e_line and e_line > 0) else None\n    with open(path, "r", encoding="utf-8", errors="replace") as f:\n      lines = list(itertools.islice(f, start_idx, end_idx))\n    return "".join(lines)\n\n  return view_file\n\n\nacp_server.resolve_skills_paths = _patched_resolve_skills_paths\nacp_tools.make_safe_view_file = make_safe_view_file\nlogging.info("Loaded acp_patch: multimodal make_safe_view_file active.")\n\n_orig_build_file_access_policies = acp_server.AgyAdapter._build_file_access_policies\n\n\ndef _patched_build_file_access_policies(\n    self: Any, roots: Sequence[str], handler: Any\n) -> list[Any]:\n  if os.environ.get("ARGON_ACP_FULL_ACCESS") == "1":\n    return []\n  return list(_orig_build_file_access_policies(self, roots, handler))\n\n\nacp_server.AgyAdapter._build_file_access_policies = (\n    _patched_build_file_access_policies\n)\n\nfrom google.antigravity.connections.local import local_connection as _lc\n\nif not getattr(_lc.LocalConnectionStrategy, "_argon_full_access_wc_installed", False):\n  _orig_lcs_build = _lc.LocalConnectionStrategy._build_harness_config\n\n  def _build_with_full_access_wc(self: Any) -> Any:\n    cfg = _orig_lcs_build(self)\n    if os.environ.get("ARGON_ACP_FULL_ACCESS") == "1":\n      cfg.policy_config.workspace_containment = (\n          _lc.localharness_pb2.PolicyConfig.WORKSPACE_CONTAINMENT_DISABLED\n      )\n      cfg.harness_side_tools.permissions.enforce_workspace_validation = False\n    return cfg\n\n  _lc.LocalConnectionStrategy._build_harness_config = _build_with_full_access_wc\n  _lc.LocalConnectionStrategy._argon_full_access_wc_installed = True\n\n\n# Keep native context settings separate from the existing media implementation.\n_context_patch_path = os.path.join(os.path.dirname(__file__), "acp_context_patch.py")\nif os.path.isfile(_context_patch_path):\n  with open(_context_patch_path, "r", encoding="utf-8") as _f:\n    exec(compile(_f.read(), _context_patch_path, "exec"), {"__file__": _context_patch_path, "__name__": "__acp_context_patch__"})\n\n# User-selected core, expressed through the SDK templated identity override.\n_behavior_patch_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "acp_behavior_patch.py")\nif os.path.isfile(_behavior_patch_path):\n  with open(_behavior_patch_path, "r", encoding="utf-8") as _f:\n    exec(compile(_f.read(), _behavior_patch_path, "exec"), {"__file__": _behavior_patch_path, "__name__": "__acp_behavior_patch__"})\n'

STUB_MAIN_SOURCE = '''import os, sys, traceback
_p = os.environ.get('ANTIGRAVITY_ACP_PATCH') or os.path.join(os.path.dirname(os.path.abspath(sys.executable)), 'acp_patch.py')
if os.path.isfile(_p):
  try:
    with open(_p, 'r', encoding='utf-8') as _f:
      exec(compile(_f.read(), _p, 'exec'), {'__file__': _p, '__name__': '__acp_patch__'})
  except Exception:
    traceback.print_exc(file=sys.stderr)
_m = os.path.join(sys._MEIPASS, 'google3', 'cloud', 'developer_experience', 'antigravity_extensions', 'acp_server', 'main.py')
with open(_m, 'r', encoding='utf-8') as _f:
  exec(compile(_f.read(), _m, 'exec'), globals())
'''


def find_mei_dir() -> str:
    candidates = sorted(
        glob.glob(os.path.join(tempfile.gettempdir(), "_MEI*")),
        key=os.path.getmtime,
        reverse=True,
    )
    for c in candidates:
        if os.path.isfile(os.path.join(c, "python314.dll")) and os.path.isfile(
            os.path.join(c, "base_library.zip")
        ):
            return c
    raise RuntimeError("Could not find an active _MEI directory with python314.dll")


def main() -> None:
    os.makedirs(BACKUP_DIR, exist_ok=True)
    if not os.path.isfile(BACKUP_EXE):
        shutil.copy2(ORIG_EXE, BACKUP_EXE)
        print("Created backup:", BACKUP_EXE)

    with open(PATCH_PY, "w", encoding="utf-8") as f:
        f.write(PATCH_SOURCE)
    print("Wrote:", PATCH_PY)

    if "--patch-only" in sys.argv:
        return

    mei_dir = find_mei_dir()
    temp_src = os.path.join(tempfile.gettempdir(), "stub_main_acp.py")
    temp_marshal = os.path.join(tempfile.gettempdir(), "stub_main_acp.marshal")
    try:
        with open(temp_src, "w", encoding="utf-8") as f:
            f.write(STUB_MAIN_SOURCE)

        os.environ["PYTHONHOME"] = mei_dir
        os.environ["PYTHONPATH"] = os.path.join(mei_dir, "base_library.zip")
        os.add_dll_directory(mei_dir)
        py314 = ctypes.CDLL(os.path.join(mei_dir, "python314.dll"))
        ctypes.c_int.in_dll(py314, "Py_NoSiteFlag").value = 1
        py314.Py_InitializeEx(0)
        py314.PyRun_SimpleString.argtypes = [ctypes.c_char_p]
        cmd = f"""
import marshal
with open({temp_src!r}, 'r', encoding='utf-8') as f:
    co = compile(f.read(), 'main.py', 'exec')
with open({temp_marshal!r}, 'wb') as f:
    f.write(marshal.dumps(co))
""".encode("utf-8")
        assert py314.PyRun_SimpleString(cmd) == 0

        with open(temp_marshal, "rb") as f:
            new_main_raw = f.read()
        new_main_comp = zlib.compress(new_main_raw, 9)
        print(f"Compiled stub main: ulen={len(new_main_raw)}, dlen={len(new_main_comp)}")
    finally:
        for p in (temp_src, temp_marshal):
            if os.path.isfile(p):
                os.remove(p)

    with open(BACKUP_EXE, "rb") as f:
        data = bytearray(f.read())

    e_lfanew = struct.unpack_from("<I", data, 0x3C)[0]
    struct.pack_into("<I", data, e_lfanew + 24 + 64, 0)
    struct.pack_into("<II", data, e_lfanew + 136 + 32, 0, 0)

    idx = data.rfind(b"MEI\x0c\x0b\x0a\x0b\x0e")
    magic, pkg_len, toc_off, toc_len, pyvers, pylib = struct.unpack(
        "!8sIIii64s", data[idx : idx + 88]
    )
    pkg_start = idx + 88 - pkg_len
    toc_start = pkg_start + toc_off

    pos = toc_start
    found = False
    while pos < toc_start + toc_len:
        elen, dpos, dlen, ulen, flag, typcd = struct.unpack_from("!iIIIBB", data, pos)
        name = data[pos + 18 : pos + elen].rstrip(b"\x00").decode("utf-8", "replace")
        if name == "main" and chr(typcd) == "s":
            assert len(new_main_comp) <= dlen
            data[pkg_start + dpos : pkg_start + dpos + dlen] = new_main_comp.ljust(
                dlen, b"\x00"
            )
            struct.pack_into(
                "!iIIIBB",
                data,
                pos,
                elen,
                dpos,
                len(new_main_comp),
                len(new_main_raw),
                1,
                typcd,
            )
            found = True
            break
        pos += elen
    assert found

    patched_bytes = bytes(data[: idx + 88])
    try:
        with open(ORIG_EXE, "wb") as f:
            f.write(patched_bytes)
        print("Updated in-place:", ORIG_EXE)
    except PermissionError:
        staged_exe = os.path.join(BIN_DIR, "agy_acp_server.staged.exe")
        with open(staged_exe, "wb") as f:
            f.write(patched_bytes)
        running_old = os.path.join(BIN_DIR, f"agy_acp_server.running-{int(time.time())}.exe")
        os.replace(ORIG_EXE, running_old)
        os.replace(staged_exe, ORIG_EXE)
        print("Atomically replaced:", ORIG_EXE, "(moved active binary to", running_old, ")")


if __name__ == "__main__":
    main()
