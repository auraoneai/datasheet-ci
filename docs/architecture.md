# Datasheet CI Architecture

`datasheet-ci` treats dataset documentation as a CI contract. The TypeScript action is the GitHub-native entry point, while the Python validator exposes the same checks for local or non-GitHub workflows.

## Design Decisions

- The section schema lives in `schemas/` so teams can review required documentation fields without reading action code.
- The action scans changed Markdown files and reports missing sections as failures because incomplete datasheets should block merges.
- On pull requests, the action reads changed files from the GitHub API when `github-token` is available, filters them through the configured `paths` patterns, emits annotations, and updates one persistent summary comment instead of creating a new comment on every run.
- The action normalizes outcomes to `pass`, `review`, `fail`, or `blocked`, then emits the same ordered evidence and next action to annotations, the job summary, outputs, and the optional bot-owned comment.
- PII pattern findings are warnings, not hard failures, because high-recall regexes can flag synthetic examples and contact placeholders.
- The Python validator mirrors the action rules so projects can run the same policy before opening a pull request.
- Examples are synthetic and intentionally small to keep self-tests fast and deterministic.

## Verification Surface

The CI workflow builds and tests the checked-in TypeScript action, runs CLI and action-input pass/fail smokes, verifies safe summary formatting, runs the Python validator tests, builds the Python package, and performs `twine check` on generated artifacts. Immutable action and Python tags have separate preflight paths.

## Runtime and Data Boundary

- Heading validation and PII-pattern scanning run on the checked-out GitHub runner or in the local Python process.
- On pull requests, the Action may call the GitHub API to list changed files and update one bot-owned comment.
- File paths, missing headings, and matched warning strings are emitted to GitHub annotations, logs, the job summary, outputs, and the optional comment.
- No AuraOne backend or non-GitHub network service is used.
- The Python validator does not call GitHub and validates one caller-supplied file at a time.

## Publication Boundary

Source metadata, the public Action tag, and the PyPI validator are aligned on
`0.2.1`. The npm name is not presented as a supported library distribution,
and no moving `v1` tag currently exists.
