from __future__ import annotations

import argparse
import email.parser
import re
import tarfile
import zipfile
from pathlib import Path

import tomllib


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tag")
    parser.add_argument("--dist", default="dist")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    metadata = tomllib.loads((root / "pyproject.toml").read_text())
    version = metadata["project"]["version"]
    if not re.fullmatch(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", version):
        raise SystemExit(f"invalid semantic version: {version}")
    if args.tag and args.tag != f"python-v{version}":
        raise SystemExit(f"tag {args.tag} must equal python-v{version}")

    dist = root / args.dist
    artifacts = sorted(path for path in dist.iterdir() if path.is_file())
    wheel = [path for path in artifacts if path.suffix == ".whl"]
    sdist = [path for path in artifacts if path.name.endswith(".tar.gz")]
    unexpected = [path.name for path in artifacts if path not in wheel and path not in sdist]
    if len(wheel) != 1 or len(sdist) != 1:
        raise SystemExit("expected exactly one datasheet-ci wheel and one source distribution")
    if unexpected:
        raise SystemExit(f"unexpected distribution files: {', '.join(unexpected)}")
    expected = f"datasheet_ci-{version}"
    if expected not in wheel[0].name or expected not in sdist[0].name:
        raise SystemExit("distribution filenames do not match the project version")

    with zipfile.ZipFile(wheel[0]) as archive:
        metadata_names = [
            name for name in archive.namelist() if name.endswith(".dist-info/METADATA")
        ]
        if len(metadata_names) != 1:
            raise SystemExit("wheel must contain exactly one METADATA file")
        metadata_name = metadata_names[0]
        parsed = email.parser.Parser().parsestr(archive.read(metadata_name).decode())
        if (parsed["Name"], parsed["Version"]) != ("datasheet-ci", version):
            raise SystemExit("wheel name or version metadata mismatch")
        if "datasheet_ci/__init__.py" not in archive.namelist():
            raise SystemExit("wheel is missing the datasheet_ci package")
    with tarfile.open(sdist[0]) as archive:
        names = archive.getnames()
        if not any(name.endswith("/README.md") for name in names):
            raise SystemExit("source distribution is missing README.md")
        pkg_info_names = [
            name
            for name in names
            if name.count("/") == 1 and name.endswith("/PKG-INFO")
        ]
        if len(pkg_info_names) != 1:
            raise SystemExit("source distribution must contain one top-level PKG-INFO")
        extracted = archive.extractfile(pkg_info_names[0])
        if extracted is None:
            raise SystemExit("source distribution PKG-INFO could not be read")
        parsed = email.parser.Parser().parsestr(extracted.read().decode())
        if (parsed["Name"], parsed["Version"]) != ("datasheet-ci", version):
            raise SystemExit("source distribution name or version metadata mismatch")
    print(f"release preflight passed for datasheet-ci {version}")


if __name__ == "__main__":
    main()
