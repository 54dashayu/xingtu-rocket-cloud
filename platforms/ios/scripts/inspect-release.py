#!/usr/bin/env python3
"""Read-only preflight for a Capacitor-style iOS App Store release."""

from __future__ import annotations

import json
import plistlib
import re
import sys
from pathlib import Path


def values(text: str, key: str) -> list[str]:
    return sorted(set(re.findall(rf"\b{re.escape(key)}\s*=\s*([^;]+);", text)))


def png_info(path: Path) -> tuple[int, int, int] | None:
    try:
        data = path.read_bytes()
        if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
            return None
        return (
            int.from_bytes(data[16:20], "big"),
            int.from_bytes(data[20:24], "big"),
            data[25],
        )
    except OSError:
        return None


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").expanduser().resolve()
    pbx = root / "Xingtu.xcodeproj/project.pbxproj"
    info = root / "App/Info.plist"
    icon = root / "App/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
    report: dict[str, object] = {"project": str(root), "errors": [], "warnings": []}
    errors: list[str] = report["errors"]  # type: ignore[assignment]
    warnings: list[str] = report["warnings"]  # type: ignore[assignment]

    if not pbx.exists():
        errors.append(f"missing {pbx.relative_to(root)}")
    else:
        text = pbx.read_text(errors="replace")
        report["bundle_ids"] = values(text, "PRODUCT_BUNDLE_IDENTIFIER")
        report["marketing_versions"] = values(text, "MARKETING_VERSION")
        report["build_numbers"] = values(text, "CURRENT_PROJECT_VERSION")
        report["signing_styles"] = values(text, "CODE_SIGN_STYLE")
        if not report["bundle_ids"]:
            errors.append("PRODUCT_BUNDLE_IDENTIFIER is missing")
        if len(report["marketing_versions"]) != 1:
            errors.append("MARKETING_VERSION is missing or inconsistent")
        if len(report["build_numbers"]) != 1:
            errors.append("CURRENT_PROJECT_VERSION is missing or inconsistent")

    if not info.exists():
        errors.append(f"missing {info.relative_to(root)}")
    else:
        with info.open("rb") as fh:
            plist = plistlib.load(fh)
        report["display_name"] = plist.get("CFBundleDisplayName")
        report["minimum_encryption_declaration"] = plist.get(
            "ITSAppUsesNonExemptEncryption", "missing"
        )
        for key in (
            "NSCameraUsageDescription",
            "NSMicrophoneUsageDescription",
            "NSPhotoLibraryUsageDescription",
            "NSPhotoLibraryAddUsageDescription",
        ):
            if not plist.get(key):
                warnings.append(f"{key} is missing")
        if "ITSAppUsesNonExemptEncryption" not in plist:
            warnings.append("export-compliance declaration is missing")

    details = png_info(icon)
    if details is None:
        errors.append("1024 PNG AppIcon is missing or invalid")
    else:
        width, height, color_type = details
        report["app_icon"] = {
            "path": str(icon),
            "width": width,
            "height": height,
            "png_color_type": color_type,
        }
        if (width, height) != (1024, 1024):
            errors.append("AppIcon must be 1024x1024")
        if color_type in (4, 6):
            errors.append("AppIcon contains an alpha channel")

    report["ok"] = not errors
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
