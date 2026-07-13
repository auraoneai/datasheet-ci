import { strict as assert } from "node:assert";
import { buildPrComment, escapeMarkdown, validateMarkdown, type ValidationSummary } from "./index.js";

const valid = `# Datasheet

## Motivation
Synthetic purpose.

## Composition
Synthetic records.

## Collection Process
Generated locally.

## Preprocessing
None.

## Uses
Tests only.

## Distribution
MIT.

## Maintenance
Maintained in this repository.
`;
const pass = validateMarkdown(valid);
assert.equal(pass.ok, true);
assert.equal(pass.piiWarnings.length, 0);

const warning = validateMarkdown(`${valid}\nContact: synthetic@example.com\n`);
assert.equal(warning.ok, true);
assert.ok(warning.piiWarnings[0].line > 1);

const fail = validateMarkdown("# Datasheet\n\n## Motivation\nOnly one section.");
assert.equal(fail.ok, false);
assert.ok(fail.missing.includes("Composition"));

const result: ValidationSummary = {
  ok: false,
  state: "fail",
  files: [
    {
      path: `${process.cwd()}/docs/bad\`name.md`,
      kind: "datasheet",
      ok: false,
      missing: ["Composition", "Uses | unsafe"],
      piiWarnings: [{ pattern: "email", match: "test@example.com", line: 8 }],
    },
  ],
  skipped: [`${process.cwd()}/docs/<unknown>.md`],
};
const body = buildPrComment(result);
assert.match(body, /<!-- datasheet-ci-summary -->/);
assert.match(body, /\*\*Decision:\*\* Failed/);
assert.match(body, /### Next action/);
assert.match(body, /PII-like email/);
assert.doesNotMatch(body, /Uses \| unsafe/);
assert.match(body, /Uses \\| unsafe/);
assert.match(escapeMarkdown("[unsafe](javascript:alert(1))"), /\\\[/);

const reviewBody = buildPrComment({
  ...result,
  ok: true,
  state: "review",
  files: [{ ...result.files[0], ok: true, missing: [] }],
});
assert.match(reviewBody, /Review recommended/);
