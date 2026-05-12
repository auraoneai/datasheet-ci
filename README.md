# datasheet-ci

A GitHub Action and standalone Python validator that enforces Datasheet-for-Datasets, Model Card, and Data Card required sections. PII patterns are warnings, not blockers.

## Quickstart

```yaml
- uses: auraoneai/datasheet-ci@v0.1.0
```

The standalone Python validator can be installed from `python_validator/` and run as `datasheet-ci path/to/datasheet.md`.

## Marketplace

The action manifest is ready for GitHub Marketplace publication as `auraoneai/datasheet-ci`.

## What This Is Not

No real datasets or customer documents are bundled. Examples are synthetic.
