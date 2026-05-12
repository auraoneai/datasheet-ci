# Datasheet CI Architecture

`datasheet-ci` treats dataset documentation as a CI contract. The TypeScript action is the GitHub-native entry point, while the Python validator exposes the same checks for local or non-GitHub workflows.

## Design Decisions

- The section schema lives in `schemas/` so teams can review required documentation fields without reading action code.
- The action scans changed Markdown files and reports missing sections as failures because incomplete datasheets should block merges.
- PII pattern findings are warnings, not hard failures, because high-recall regexes can flag synthetic examples and contact placeholders.
- The Python validator mirrors the action rules so projects can run the same policy before opening a pull request.
- Examples are synthetic and intentionally small to keep self-tests fast and deterministic.

## Verification Surface

The CI workflow builds the TypeScript action, runs unit coverage for the PII and section checks, runs the Python validator tests, builds the Python package, and performs `twine check` on the generated artifacts.
