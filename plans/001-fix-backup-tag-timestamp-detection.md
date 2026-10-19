# Plan 001: Fix backup-tag timestamp detection

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ceb6041..HEAD -- scripts/parse-tenants.mjs scripts/test-parse-tenants.mjs`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `ceb6041`, 2026-08-03

## Why this matters

`parse-tenants.mjs --check-pending` decides which tenants enter the backup
matrix. It finds the latest backup by sorting git tags with
`--sort=-creatordate`. After branch squashes or force-pushes, many tags share
the same creatordate but different embedded timestamps in the tag name (e.g.
`mediolanum/2026-08-03_13-30-20`). The parser picks the wrong tag and treats
successful tenants as perpetually pending — causing redundant backup jobs every
15 minutes (~96 extra runs/day per affected tenant).

## Current state

- `scripts/parse-tenants.mjs` — builds matrix JSON for scheduled backups;
  `getLatestTagMap()` and `getLatestBackupTime()` determine pending status.
- Tag format: `<tenant>/YYYY-MM-DD_HH-MM-SS` (UTC), set in
  `.github/workflows/scheduled-backup.yml` commit step.

Problematic code today:

```29:44:scripts/parse-tenants.mjs
      const output = execFileSync(
        "git",
        ["tag", "-l", "--sort=-creatordate", "--format=%(refname:short)"],
        { encoding: "utf-8", stdio: ["pipe", "pipe", "ignore"] }
      );
      const tags = output.trim().split("\n").filter(Boolean);
      // Because git tag is sorted by -creatordate, the first tag we see for a prefix is the latest.
      for (const tag of tags) {
        const slashIndex = tag.indexOf("/");
        if (slashIndex !== -1) {
          const tenant = tag.slice(0, slashIndex);
          if (!latestTagMapCache.has(tenant)) {
            latestTagMapCache.set(tenant, tag);
          }
        }
      }
```

Verified locally: `mediolanum` has tags through `2026-08-03_13-30-20` but
`getLatestTagMap()` returns `mediolanum/2026-07-22_21-54-46` because all tags
share creatordate `2026-07-22 21:54:46`.

Test pattern: follow `scripts/test-parse-tenants.mjs` (plain Node assert style,
no test framework).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Parser tests | `node scripts/test-parse-tenants.mjs` | exit 0, all PASS |
| Cron tests | `node scripts/test-cron-utils.mjs` | exit 0 |
| Pending check | `node scripts/parse-tenants.mjs --active-only --check-pending \| jq '.include \| map(.tenant)'` | `mediolanum` NOT listed when latest name-timestamp is today |

## Scope

**In scope**:
- `scripts/parse-tenants.mjs`
- `scripts/test-parse-tenants.mjs`

**Out of scope**:
- `.github/workflows/scheduled-backup.yml` (plan 002)
- Any change to tag naming format in workflows

## Git workflow

- Branch: `advisor/001-fix-tag-timestamp`
- Commit message style: imperative, matches repo (e.g. `fix: parse backup time from tag name not creatordate`)
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add tag-name timestamp parser helper

In `scripts/parse-tenants.mjs`, add a function that extracts a `Date` from a
tag matching `/<tenant>/YYYY-MM-DD_HH-MM-SS$`. Reuse the regex already in
`getLatestBackupTime()` (lines 63–73).

### Step 2: Rewrite getLatestTagMap to pick max embedded timestamp

Replace creatordate-based "first seen wins" logic:

1. List all tags: `git tag -l --format=%(refname:short)` (no creatordate sort).
2. For each tag with a `/`, parse the embedded timestamp from the tag name.
3. For each tenant prefix, keep the tag whose parsed timestamp is greatest.
4. Skip tags that do not match the timestamp pattern.

Keep the module-level cache (`latestTagMapCache`) but invalidate logic stays the same.

**Verify**: `node -e "import('./scripts/parse-tenants.mjs')"` does not error (syntax OK).

### Step 3: Add regression tests

In `scripts/test-parse-tenants.mjs`, add tests that:

1. Create temporary git tags (or mock `execFileSync` if cleaner — prefer real
   tags in a temp dir if too invasive; alternatively export and unit-test the
   timestamp comparison helper directly).
2. Assert that when two tags share creatordate but different name timestamps,
   the newer name timestamp wins.
3. Assert `isBackupPending` behavior: tenant with today's tag is not pending
   for schedule `0 0 * * *` when run after midnight UTC.

Minimum viable: extract `parseTagTimestamp(tagName)` as export and test it
directly without git, plus one integration check if tags exist locally.

**Verify**: `node scripts/test-parse-tenants.mjs` → exit 0

### Step 4: Confirm pending count drops for healthy tenants

**Verify**:
```bash
node scripts/parse-tenants.mjs --active-only --check-pending | jq '.include | map(.tenant)'
```
→ Should list only tenants whose latest **name-embedded** backup is before
today's scheduled window (e.g. `axa` if its newest tag is still July 26).
→ Should NOT list `mediolanum` when `mediolanum/2026-08-03_*` tags exist.

## Test plan

- Extend `scripts/test-parse-tenants.mjs` with timestamp comparison cases.
- Run full existing parser test suite unchanged.
- Manual: compare pending tenant list before/after on this repo.

## Done criteria

- [ ] `node scripts/test-parse-tenants.mjs` exits 0
- [ ] `node scripts/test-cron-utils.mjs` exits 0
- [ ] `getLatestTagMap` no longer uses `--sort=-creatordate`
- [ ] `mediolanum` excluded from `--check-pending` when latest tag name is today
- [ ] No files outside scope modified
- [ ] `plans/README.md` status row for 001 updated to DONE

## STOP conditions

- Tag format in workflows differs from `/<tenant>/YYYY-MM-DD_HH-MM-SS` — report
  before changing parser assumptions.
- More than half of tenant tags do not match the timestamp pattern — report;
  may need fallback to creatordate for legacy tags.
- Verification fails twice after reasonable fix attempt.

## Maintenance notes

- Any future change to tag naming must update `parseTagTimestamp` and its tests.
- Offboard/squash operations that recreate tags with identical creatordate will
  no longer break pending detection — but reviewers should still prefer
  deleting stale tags during offboard (already done in `offboard.mjs`).
