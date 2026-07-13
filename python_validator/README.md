# datasheet-ci Python Validator

Validate one local Datasheet, Model Card, or Data Card and receive structured missing-section and PII-pattern evidence.

This Python package is for authors who want the same required-heading lists
used by AuraOne Datasheet CI before opening a pull request.

## Inspectable Output

The CLI writes JSON with `ok`, `missing`, and warning-only `piiWarnings` for the supplied file.

## Runtime Boundary

The CLI reads one local Markdown file and performs local regular-expression checks. It makes no network requests, uploads no document content, and does not determine whether a matched string is actually personal data.

## Install and Quickstart

From the `datasheet-ci` repository root:

```bash
python -m pip install ./python_validator
datasheet-ci examples/valid_datasheet.md
datasheet-ci examples/invalid_datasheet.md
datasheet-ci path/to/model-card.md --kind model_card
```

## Release Status

Verified July 13, 2026: `datasheet-ci==0.2.1` is published on PyPI and the
source is included in the dedicated `v0.2.1` repository release.

## Limits

This validator checks completeness signals, not factual accuracy, privacy compliance, or documentation quality.

## Next Action

Install the validator from `python_validator/`, run it on the document you plan to submit, add every missing heading, and review each PII-like match manually before opening the pull request.
