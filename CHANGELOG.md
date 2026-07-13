# Changelog

## 0.2.1

- Publish the current Action and standalone Python validator from synchronized
  source with an npm lockfile and reproducible release preflight.
- Correct public installation, tag, and registry documentation.

## 0.2.0

- Add pass, review, fail, and blocked states across annotations, summaries, outputs, and the bot-owned PR comment.
- Add line-aware PII-like annotations and safe Markdown/workflow-command escaping.
- Add immutable GitHub Action release verification, separately gated major-tag promotion, and hardened Python trusted-publishing preflight.

## 0.1.1

- Prepare hardened source-side release after CI, validation, documentation, and packaging fixes.
- Wire the GitHub Action `paths` input to the Node runtime with glob expansion, document-kind inference, annotations, and self-tests for passing and failing datasheets.
- Scan changed Markdown files on pull requests through the GitHub API and update a persistent PR summary comment when `github-token` is available.

## 0.1.0

- Initial open-source implementation.
