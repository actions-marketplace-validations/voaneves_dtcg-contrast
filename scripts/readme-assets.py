"""Regenerate the dtcg-contrast README logo and button SVGs.

Thin wrapper around the readme kit (scripts/readme-kit/build.py), driven by
scripts/readme-kit/manifests/dtcg-contrast.json. Only logo and buttons are
rebuilt here; run build.py directly for the landing page, tokens and workflow.

Usage: python scripts/readme-assets.py [--brand-fonts PATH]
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = ROOT / "scripts" / "readme-kit"

if __name__ == "__main__":
    sys.exit(
        subprocess.call(
            [
                sys.executable, str(KIT / "build.py"),
                "--manifest", str(KIT / "manifests" / "dtcg-contrast.json"),
                "--repo-dir", str(ROOT),
                "--only", "logo,buttons", "--no-png",
                *sys.argv[1:],
            ]
        )
    )
