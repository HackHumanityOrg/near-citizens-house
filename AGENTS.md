<!-- BEGIN:nextjs-agent-rules -->
 
# Next.js: ALWAYS read docs before coding
 
Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/` in the root folder or in one of the workspace apps. Your training data is outdated — the docs are the source of truth.
 
<!-- END:nextjs-agent-rules -->

# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` workspace monorepo.

- `apps/citizens-house/`: Next.js app (App Router), API routes, UI components, Vitest tests, and Playwright E2E.
- `contracts/governance/`: Rust smart contract for proposals, voting, admins, and blocklist logic.
- `contracts/verified-accounts/`: Rust smart contract for identity verification records.
- `docs/`: architecture and process documentation.
- `.github/workflows/test.yml`: CI for app + contract validation.

Use `@/` imports inside `apps/citizens-house` for app-local modules.

## Build, Test, and Development Commands
Run from repo root unless noted.

- `pnpm install`: install workspace dependencies.
- `pnpm dev`: start `apps/citizens-house` locally on port `3000`.
- `pnpm build`: production build for the web app.
- `pnpm lint`: run lint across workspaces.
- `pnpm test`: run workspace test suites.
- `pnpm --filter @near-citizens/citizens-house test`: run app unit tests only.
- `pnpm --filter @near-citizens/citizens-house test:e2e`: run Playwright E2E.
- `pnpm test:contract:verification` / `pnpm test:contract:governance`: run Rust contract tests.

## Coding Style & Naming Conventions
- TypeScript + React use 2-space indentation, semicolons off, double quotes, trailing commas (`.prettierrc`).
- Linting uses ESLint + TypeScript + Next.js rules (`eslint.config.mjs`).
- Prefer camelCase for variables/functions, PascalCase for React components, kebab-case for route folders.
- Keep server-only code under `lib/**` modules with clear boundaries (`server-only` where required).

## Testing Guidelines
- App unit tests use Vitest (`apps/citizens-house/vitest.config.ts`) with files named `*.test.ts`.
- Contract tests use `cargo test` in each contract directory.
- Add tests next to changed logic (especially governance flows, verification status handling, and schema parsing).
- For UI or API behavior changes, include at least one targeted unit test; add E2E coverage for critical user flows.

## Commit & Pull Request Guidelines
- Follow existing commit style: concise, imperative, capitalized subjects (e.g., `Add voting-admin admin route override`).
- Keep subject lines short and focused; avoid mixed unrelated changes in one commit.
- PRs should include:
  - clear summary of what changed and why,
  - linked issue/ticket (if available),
  - test evidence (commands run),
  - screenshots/video for visible UI changes.
- Ensure CI passes before requesting review.
