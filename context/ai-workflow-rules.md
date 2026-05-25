# AI Workflow Rules

## Approach

Build against the documented context. The four sibling files in
`context/` describe what the package is (`project-overview.md`), how
it is built (`architecture.md`, `code-standards.md`), and where it is
now (`progress-tracker.md`). Read the relevant context file first,
change the smallest thing that solves the problem, and update the
context file whenever the change moves the package.

This package has no UI surface (it is a non-UI library), so there is
no `ui-context.md`. Naming, output envelope, annotations, and module
surface conventions all live in `code-standards.md` and
`architecture.md` instead.

Workspace `.cursorrules` and `.cursor/rules/*` apply on top of these
files. Style and safety rules (comment length, plain-language prose,
no decorative dividers) are enforced workspace-wide.

## Scoping Rules

- Work on one feature unit at a time. A "unit" here is one new tool,
  one new client method, one new industry pack, or one validation
  change.
- Prefer small, verifiable increments. Add a new client method with a
  test before wiring it to a tool handler before exposing it via the
  orchestrator.
- Do not combine unrelated system boundaries. Adding a new tool and
  changing the publish workflow are two PRs, not one.

## When to Split Work

Split an implementation step if it combines:

- A schema change AND a behavior change. Land the schema (with
  tests) first, then the behavior.
- A new public export AND internal refactors. Public surface
  changes carry semver weight — separate them.
- A change to `register.ts` AND a change to a tool file. The
  orchestrator's conditional registration is the riskiest spot for
  silent breakage; review it in isolation.
- Anything touching `package.json` `exports` / `typesVersions` /
  `peerDependencies` AND source changes. Packaging changes need their
  own pack-dry-run verification.
- A behavior change to a tool's I/O AND a description rewrite. They
  affect different consumers (validator vs prompt-following model).

If a change cannot be verified by `npm run release:check` in one
session, the scope is too broad — split it.

## Handling Missing Requirements

- Do not invent tool behavior, output shapes, or annotation values
  not defined in the context files. If unclear, ask.
- If a requirement is ambiguous, update the relevant context file
  first. `project-overview.md` for surface; `architecture.md` for
  invariants; `code-standards.md` for naming/output/annotation
  conventions.
- If a requirement is missing, add it as an open question in
  `progress-tracker.md` and move on to an unblocked unit.

## Protected Files

Do not modify the following unless explicitly instructed:

- `package.json` `exports`, `typesVersions`, `peerDependencies`,
  `version`, `engines` — packaging surface, semver-relevant.
  Bumping `version` is a separate, deliberate step.
- `.github/workflows/release.yml` and `.github/workflows/ci.yml` —
  the release gate. Changes here can leak secrets or skip checks.
- `tsconfig.json` `module`, `moduleResolution`, `target`, `outDir`,
  `declaration` — emit format is part of the public contract.
- `src/index.ts` — public barrel. Adding a new export is a public
  API change; document it in `progress-tracker.md` and update the
  README in the same PR.
- `src/types.ts` re-exported types — same semver weight as a public
  API change.
- `dist/` — generated. Never edit, never check in.

## Keeping Docs in Sync

Update the relevant context file whenever implementation changes:

- New tool, new pack, new client method → `project-overview.md`
  (Features) + `architecture.md` (System Boundaries) +
  `code-standards.md` (any new naming, output, or annotation
  convention)
- New invariant or relaxed invariant → `architecture.md`
- New convention (naming, error shape, file layout) →
  `code-standards.md`
- Anything in flight, blockers, decisions, version bumps →
  `progress-tracker.md`

If a change here invalidates a claim in the workspace `.cursorrules`,
flag it. Do not silently let them drift.

## Before Moving to the Next Unit

1. The unit works end-to-end. New behavior is covered by a Node-test
   in `tests/`. Public surface changes are covered in
   `examples/basic-mcp-server/`.
2. No invariant in `architecture.md` was violated. In particular:
   no top-level side effects, no env reads, no transport startup, no
   `dependencies` masquerading as `peerDependencies`.
3. `progress-tracker.md` reflects the completed work and any new
   open questions, especially any that affect the next version bump.
4. `npm run release:check` passes locally.
5. If the change is publish-worthy, bump `version` in `package.json`
   following semver:
   - Patch: bugfix, internal refactor, doc tweak
   - Minor: new tool, new pack, new optional config field, new
     export
   - Major: rename, removal, breaking shape change, peer-dep range
     bump that excludes previously-supported versions
