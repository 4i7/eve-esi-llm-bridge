#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.1.0"
DIST = ROOT / "dist"
ZIP_NAME = f"eve-esi-llm-bridge-v{VERSION}.zip"
ZIP_PATH = DIST / ZIP_NAME
CHECKSUM_PATH = DIST / "SHA256SUMS.txt"
RELEASE_NOTES_PATH = DIST / f"RELEASE-NOTES-v{VERSION}.md"

RELEASE_NOTES = f"""# EVE ESI LLM Bridge v{VERSION}

Initial public-ready reference release.

The ZIP contains a complete self-hosted Next.js/Vercel MCP bridge, English/Japanese setup documentation, EVE SSO PKCE integration, stateless MCP OAuth/DCR, read-oriented ESI tools, optional allowlisted write tickets, a generic EVE assistant Skill starter, prompt examples, an offline secret generator and tests.

No live EVE/Vercel/MCP credentials are included. Every operator must create and authorize their own EVE Developer Application and deployment.

Start with `README.md` or `README.ja.md`.
"""

EXCLUDED_DIRS = {".git", ".next", ".vercel", "node_modules", "dist", "__pycache__"}
EXCLUDED_FILES = {".env", ".env.local", ".env.production", ".DS_Store", "package-lock.json"}


def included_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(ROOT)
        if any(part in EXCLUDED_DIRS for part in rel.parts):
            continue
        if rel.name in EXCLUDED_FILES or rel.name.startswith(".env.") and rel.name != ".env.example":
            continue
        files.append(path)
    return sorted(files, key=lambda p: p.relative_to(ROOT).as_posix())


def main() -> None:
    DIST.mkdir(exist_ok=True)
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    # Give every entry a deterministic timestamp so identical source trees
    # produce byte-identical archives across machines. package-lock.json is
    # intentionally excluded because npm install may create it in CI even
    # when it is not committed; the release must describe the source tree,
    # not the incidental install state of the build worker.
    timestamp = (2026, 8, 2, 0, 0, 0)
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in included_files():
            rel = Path("eve-esi-llm-bridge") / path.relative_to(ROOT)
            info = zipfile.ZipInfo(rel.as_posix(), date_time=timestamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (0o755 if os.access(path, os.X_OK) else 0o644) << 16
            archive.writestr(info, path.read_bytes())

    digest = hashlib.sha256(ZIP_PATH.read_bytes()).hexdigest()
    CHECKSUM_PATH.write_text(f"{digest}  {ZIP_NAME}\n", encoding="utf-8")
    RELEASE_NOTES_PATH.write_text(RELEASE_NOTES, encoding="utf-8")
    print(f"built {ZIP_PATH}")
    print(f"sha256 {digest}")
    print(f"notes {RELEASE_NOTES_PATH}")


if __name__ == "__main__":
    main()
