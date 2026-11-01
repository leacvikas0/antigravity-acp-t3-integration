# Copyright 2026 Google LLC
"""Runtime patch for agy_acp_server: multimodal view_file (Image, Audio, Video)."""

from collections.abc import Callable, Coroutine, Sequence
import itertools
import logging
import os
import pathlib
import stat
from typing import Any

import google.protobuf.runtime_version

google.protobuf.runtime_version.ValidateProtobufRuntimeVersion = (
    lambda *args, **kwargs: None
)

from google.antigravity import types as sdk_types
from google.antigravity.tools import tool_context
from google3.cloud.developer_experience.antigravity_extensions.acp_server import paths as acp_paths
from google3.cloud.developer_experience.antigravity_extensions.acp_server import server as acp_server
from google3.cloud.developer_experience.antigravity_extensions.acp_server import tools as acp_tools

MAX_MEDIA_BYTES = 100 * 1024 * 1024

_MEDIA_EXT_TO_MIME: dict[str, str] = {
    # Images (sdk_types.SUPPORTED_IMAGE_MIMES)
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    # Audio (sdk_types.SUPPORTED_AUDIO_MIMES)
    ".wav": "audio/wav",
    ".mp3": "audio/mp3",
    ".m4a": "audio/m4a",
    ".aac": "audio/aac",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".opus": "audio/opus",
    ".weba": "audio/webm",
    ".pcm": "audio/l16",
    ".l16": "audio/l16",
    # Video (sdk_types.SUPPORTED_VIDEO_MIMES)
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".avi": "video/avi",
    ".mpeg": "video/mpeg",
    ".mpg": "video/mpg",
    ".wmv": "video/wmv",
    ".3gp": "video/3gpp",
    ".flv": "video/x-flv",
}


def _t3_attachments_dir() -> str:
  return os.path.abspath(
      os.path.join(os.path.expanduser("~"), ".t3", "userdata", "attachments")
  )


def _media_cache_dir() -> str:
  return os.path.abspath(os.path.join(acp_paths.acp_dir(), "media-cache"))


def _extra_media_dirs() -> list[str]:
  return [_t3_attachments_dir(), _media_cache_dir()]


_orig_resolve_skills_paths = acp_server.resolve_skills_paths


def _patched_resolve_skills_paths(cwd: str | None = None) -> list[str]:
  paths = list(_orig_resolve_skills_paths(cwd))
  att_dir = _t3_attachments_dir()
  if att_dir not in paths:
    os.makedirs(att_dir, exist_ok=True)
    paths.append(att_dir)
  return paths


def make_safe_view_file(
    allowed_dirs: Sequence[str],
    *,
    defer_scope: bool = False,
) -> Callable[..., Coroutine[Any, Any, Any]]:
  """Factory to create a multimodal-capable view_file tool restricted to allowed directories."""
  effective_dirs: list[str] = list(allowed_dirs)
  for extra in _extra_media_dirs():
    if extra not in effective_dirs:
      effective_dirs.append(extra)

  async def view_file(
      absolute_path: str | None = None,
      ctx: tool_context.ToolContext | None = None,
      start_line: int | None = None,
      end_line: int | None = None,
      AbsolutePath: str | None = None,  # pylint: disable=invalid-name
      StartLine: int | None = None,  # pylint: disable=invalid-name
      EndLine: int | None = None,  # pylint: disable=invalid-name
      **kwargs: Any,
  ) -> str:
    """View a file; full-access mode permits any path readable by this OS user.

    Args:
      absolute_path: The absolute path of the file to read.
      ctx: The conversation tool context.
      start_line: Optional starting line number (1-indexed).
      end_line: Optional ending line number (1-indexed).
      AbsolutePath: Alias for absolute_path.
      StartLine: Alias for start_line.
      EndLine: Alias for end_line.
      **kwargs: Additional ignored keyword arguments.

    Returns:
      The string containing the file content (or native supplemental_media for image/audio/video files).

    Raises:
      PermissionError: If the path is outside the allowed directories.
      ValueError: If no file path is specified.
    """
    del ctx, kwargs
    path = absolute_path or AbsolutePath
    s_line = start_line or StartLine
    e_line = end_line or EndLine
    if not path:
      raise ValueError("absolute_path (or AbsolutePath) is required.")
    if not os.path.isabs(path):
      raise ValueError(f"absolute_path must be an absolute path, got {path!r}")

    full_access = os.environ.get("ARGON_ACP_FULL_ACCESS") == "1"
    if not full_access and not defer_scope and not any(
        acp_tools._is_subpath(path, d) for d in effective_dirs
    ):
      raise PermissionError(
          f"Access to path {path!r} is denied. It is outside the"
          f" allowed workspace directories: {effective_dirs}"
      )

    ext = pathlib.Path(path).suffix.lower()
    mime_type = _MEDIA_EXT_TO_MIME.get(ext)
    if mime_type is not None:
      file_path = pathlib.Path(path).expanduser()
      try:
        st = file_path.stat()
      except FileNotFoundError as exc:
        raise FileNotFoundError(f"File not found at path: '{file_path}'") from exc
      except PermissionError as exc:
        raise PermissionError(
            f"Permission denied when reading path: '{file_path}'"
        ) from exc
      except OSError as exc:
        raise OSError(f"Failed to stat file at path '{file_path}': {exc}") from exc

      if stat.S_ISDIR(st.st_mode):
        raise IsADirectoryError(f"Path is a directory, not a file: '{file_path}'")
      if st.st_size == 0:
        raise ValueError(f"Media file is empty (0 bytes): {path!r}")
      if st.st_size > MAX_MEDIA_BYTES:
        raise ValueError(
            f"Media file {path!r} is {st.st_size:,} bytes, exceeding the "
            f"{MAX_MEDIA_BYTES:,}-byte (100 MiB) inline media limit."
        )

      data = sdk_types._read_file_safely(file_path)
      size = len(data)
      media_obj = sdk_types.from_bytes(
          data,
          mime_type,
          description=f"Viewed media file: {os.path.basename(path)}",
      )
      return {  # type: ignore[return-value]
          "path": path,
          "mime_type": media_obj.mime_type,
          "size_bytes": size,
          "media": media_obj,
      }

    start_idx = (s_line - 1) if (s_line and s_line > 0) else 0
    end_idx = e_line if (e_line and e_line > 0) else None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
      lines = list(itertools.islice(f, start_idx, end_idx))
    return "".join(lines)

  return view_file


acp_server.resolve_skills_paths = _patched_resolve_skills_paths
acp_tools.make_safe_view_file = make_safe_view_file
logging.info("Loaded acp_patch: multimodal make_safe_view_file active.")

_orig_build_file_access_policies = acp_server.AgyAdapter._build_file_access_policies


def _patched_build_file_access_policies(
    self: Any, roots: Sequence[str], handler: Any
) -> list[Any]:
  if os.environ.get("ARGON_ACP_FULL_ACCESS") == "1":
    return []
  return list(_orig_build_file_access_policies(self, roots, handler))


acp_server.AgyAdapter._build_file_access_policies = (
    _patched_build_file_access_policies
)

from google.antigravity.connections.local import local_connection as _lc

if not getattr(_lc.LocalConnectionStrategy, "_argon_full_access_wc_installed", False):
  _orig_lcs_build = _lc.LocalConnectionStrategy._build_harness_config

  def _build_with_full_access_wc(self: Any) -> Any:
    cfg = _orig_lcs_build(self)
    if os.environ.get("ARGON_ACP_FULL_ACCESS") == "1":
      cfg.policy_config.workspace_containment = (
          _lc.localharness_pb2.PolicyConfig.WORKSPACE_CONTAINMENT_DISABLED
      )
      cfg.harness_side_tools.permissions.enforce_workspace_validation = False
    return cfg

  _lc.LocalConnectionStrategy._build_harness_config = _build_with_full_access_wc
  _lc.LocalConnectionStrategy._argon_full_access_wc_installed = True


# Keep native context settings separate from the existing media implementation.
_context_patch_path = os.path.join(os.path.dirname(__file__), "acp_context_patch.py")
if os.path.isfile(_context_patch_path):
  with open(_context_patch_path, "r", encoding="utf-8") as _f:
    exec(compile(_f.read(), _context_patch_path, "exec"), {"__file__": _context_patch_path, "__name__": "__acp_context_patch__"})

# User-selected core, expressed through the SDK templated identity override.
_behavior_patch_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "acp_behavior_patch.py")
if os.path.isfile(_behavior_patch_path):
  with open(_behavior_patch_path, "r", encoding="utf-8") as _f:
    exec(compile(_f.read(), _behavior_patch_path, "exec"), {"__file__": _behavior_patch_path, "__name__": "__acp_behavior_patch__"})
