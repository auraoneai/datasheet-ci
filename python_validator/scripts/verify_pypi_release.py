#!/usr/bin/env python3
"""Wait for and verify an exact datasheet-ci release on PyPI."""

from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request
from typing import Any


def load_release(index_url: str, version: str) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{index_url.rstrip('/')}/pypi/datasheet-ci/{version}/json",
        headers={"User-Agent": "datasheet-ci-release-verifier/1"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.load(response)


def validate_release(payload: dict[str, Any], version: str) -> None:
    info = payload.get("info", {})
    files = payload.get("urls", [])
    package_types = {item.get("packagetype") for item in files}
    if info.get("name") != "datasheet-ci" or info.get("version") != version:
        raise ValueError("PyPI returned metadata for a different package or version")
    if not {"bdist_wheel", "sdist"}.issubset(package_types):
        raise ValueError("PyPI release does not contain both a wheel and source distribution")
    if any(not item.get("digests", {}).get("sha256") for item in files):
        raise ValueError("one or more PyPI files has no SHA-256 digest")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("version", help="exact package version to verify")
    parser.add_argument("--index-url", default="https://pypi.org")
    parser.add_argument("--attempts", type=int, default=12)
    parser.add_argument("--delay", type=float, default=10.0)
    args = parser.parse_args()

    for attempt in range(1, args.attempts + 1):
        try:
            payload = load_release(args.index_url, args.version)
            validate_release(payload, args.version)
            print(f"verified datasheet-ci {args.version} on PyPI")
            return 0
        except (
            urllib.error.URLError,
            TimeoutError,
            ValueError,
            KeyError,
            json.JSONDecodeError,
        ) as exc:
            if attempt == args.attempts:
                print(
                    f"PyPI verification failed after {attempt} attempts: {exc}",
                    file=sys.stderr,
                )
                return 1
            print(f"PyPI release not ready (attempt {attempt}/{args.attempts}): {exc}")
            time.sleep(args.delay)

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
