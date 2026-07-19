# Contributing to @heronlabs/terminal-cli

Thanks for your interest in contributing! This is a small, focused project, and
we keep the bar high: 100% test coverage and 100% mutation score are enforced.

## Development setup

Requires Node.js `>=22` and pnpm `>=10.33.2` (see `engines` in `package.json`).

```bash
pnpm install          # install dependencies
pnpm build            # nest build -> bin/
```

## Verifying your change

Run the full check suite before opening a pull request — these are the same
checks CI enforces:

```bash
pnpm test:unit        # unit tests — 100% coverage required
pnpm test:integration # round-trip integration tests (requires Docker)
pnpm test:mutation    # mutation tests — 100% mutation score required
pnpm lint:check       # gts lint + JSON/YAML lint
pnpm dep:cruise       # dependency-cruiser architecture rules
pnpm audit --prod     # production dependency audit
```

A change is not ready until all of the above pass.

## Pull request flow

1. Create a feature branch off `main`.
2. Make your change, with tests covering the new behaviour and its edge cases.
3. Run the full check suite above and make sure it is green.
4. Open a pull request targeting `main` with a clear description of the change.
5. CI must pass and the PR must be reviewed before it can merge.

Please keep commits focused and use clear, conventional commit subjects
(`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
