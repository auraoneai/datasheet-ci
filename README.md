# datasheet-ci

A GitHub Action and standalone Python validator that enforces Datasheet-for-Datasets, Model Card, and Data Card required sections. PII patterns are warnings, not blockers.

## Quickstart

```yaml
- uses: auraoneai/datasheet-ci@v0.1.1
  with:
    paths: |
      docs/datasheet.md
      docs/model-card.md
```

The action accepts exact Markdown files, directories, or simple `*.md` / `**/*.md` glob patterns. It emits GitHub annotations for missing required sections and warns on PII-like patterns without treating them as blocking errors.
On `pull_request` events, the action uses `github-token` to scan only changed Markdown files that match `paths` and updates a single PR summary comment marked with `<!-- datasheet-ci-summary -->`.

The standalone Python validator can be installed from `python_validator/` and run as `datasheet-ci path/to/datasheet.md`.

## Marketplace

The action manifest is ready for GitHub Marketplace publication as `auraoneai/datasheet-ci`.

## What This Is Not

No real datasets or customer documents are bundled. Examples are synthetic.
