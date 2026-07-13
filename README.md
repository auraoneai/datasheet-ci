# AuraOne Datasheet CI

Check Datasheet-for-Datasets, Model Card, and Data Card completeness in pull requests or local Python workflows.

Datasheet CI is for data governance teams, model-release owners, and repository maintainers who want documentation requirements to be inspectable and enforceable. Missing required headings block the check; high-recall email, SSN, IP, and phone patterns produce review warnings rather than automatic PII conclusions.

## Inspectable Proof

The current `0.2.1` Action produces:

- File annotations for missing sections and PII-like matches.
- A job summary and optional bot-authored pull request comment with decision, counts, file-level evidence, and next action.
- Outputs: `decision`, `checked-files`, `blocking-failures`, and `warnings`.

| Decision | Meaning | Workflow result |
| --- | --- | --- |
| `pass` | Required sections are present and no PII-like matches were found. | Success |
| `review` | Required sections are present; PII-like matches need human review. | Success |
| `fail` | A recognized document is missing required sections. | Failure |
| `blocked` | No recognized document matched the configured paths. | Failure |

The standalone Python validator writes JSON with `ok`, `missing`, and `piiWarnings` for one file.

## Runtime, Data, and Network Boundary

Heading checks and regex scans run on local file content. On pull request events, the Action can call the GitHub API to list changed files and create or update a comment. File paths, missing headings, and matched warning strings are also published through GitHub annotations, logs, and the job summary. No non-GitHub service or AuraOne backend is called.

The Python validator is offline and processes only the file path supplied on the command line.

## Public Action Quickstart

Use release `v0.2.1`, then replace the tag with its immutable commit SHA after
review:

```yaml
name: Documentation evidence
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  datasheet:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: auraoneai/datasheet-ci@v0.2.1
        with:
          paths: |
            docs/datasheet.md
            docs/model-card.md
          github-token: ${{ github.token }}
          comment-on-pr: "true"
```

## Standalone Python Quickstart

Install the standalone Python validator from PyPI:

```bash
python -m pip install "datasheet-ci==0.2.1"
datasheet-ci examples/valid_datasheet.md
datasheet-ci examples/invalid_datasheet.md
```

Use `--kind model_card` or `--kind data_card` when validating those document types.

## Current Source Development

```bash
npm ci
npm test
node scripts/release-preflight.mjs v0.2.1

python -m pip install -U build twine pytest
python -m pytest python_validator/tests
python -m build python_validator
```

## Release Status

Registry and tag status verified July 13, 2026:

- Latest public Action and source release: `v0.2.1`.
- PyPI: [`datasheet-ci==0.2.1`](https://pypi.org/project/datasheet-ci/0.2.1/)
- No moving `v1` tag exists.
- `@auraone/datasheet-ci` is not presented as an npm library; the supported
  JavaScript distribution is the GitHub Action checkout.

No compliance, privacy-certification, or adoption claim is made.

## Limits

Required headings establish document completeness, not factual accuracy. Regex matches are high-recall review prompts, not proof of personal data. Examples are synthetic and no customer documents are bundled.

## Next Action

Add `auraoneai/datasheet-ci@v0.2.1` to a test pull request with explicit document paths, fix missing headings, review every PII-like warning in context, then pin the tag to its full commit SHA before making the check required.
