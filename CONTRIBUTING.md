# Contributing

Use Node.js 20 and run `npm ci && npm test` for the action. Changes to `src/` must include rebuilt checked-in `dist/` output.

For the Python validator, use a fresh virtual environment, install the package in editable mode, and run `pytest`. Keep all examples synthetic.

Release preparation must pass the action or Python preflight documented in the README. Publish immutable tags first; promote a moving action major tag only after a live synthetic smoke test.
