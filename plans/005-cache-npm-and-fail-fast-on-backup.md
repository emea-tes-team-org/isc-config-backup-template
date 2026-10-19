# Plan 005: Cache npm and fail fast on backup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for plan 005
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ceb6041..HEAD -- .github/workflows/*.yml`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `ceb6041`, 2026-08-03

## Why this matters

Every backup matrix job runs `npm ci` with no cache (~6–10 seconds × N tenants
× runs/day). Failed backups (e.g. `axa`) hold a runner for **~10 minutes**
before failing on the "Run backup" step — recent run 30818189921 shows backup
step alone from 13:30:02 to 13:40:07 UTC. A timeout fails fast and stops burning
minutes on unreachable tenants.

## Current state

Typical backup job setup (repeated in 5 workflows):

```93:99:.github/workflows/scheduled-backup.yml
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci
```

No job-level `timeout-minutes`. Default is 360 minutes.

Repo has only 2 npm dependencies (`package.json`); caching still saves runner
provisioning time across parallel matrix jobs.

Workflows with `npm ci`:
- `.github/workflows/scheduled-backup.yml`
- `.github/workflows/backup.yml`
- `.github/workflows/drift-detection.yml`
- `.github/workflows/restore.yml`
- `.github/workflows/tokenize.yml`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Workflow refs | `node scripts/test-workflow-references.mjs` | exit 0 |
| CLI smoke | `node scripts/cli.mjs --help` | prints usage |

## Scope

**In scope** — add `cache: npm` and backup job timeout to:
- `.github/workflows/scheduled-backup.yml` (backup job only)
- `.github/workflows/backup.yml`
- `.github/workflows/drift-detection.yml`

**Out of scope** (lower frequency / different job shape — skip unless trivial):
- `restore.yml`, `tokenize.yml`, `onboarding.yml`, `offboard.yml`, `schedule-toggle.yml`

## Git workflow

- Branch: `advisor/005-npm-cache-backup-timeout`
- Commit: `ci: cache npm deps and timeout backup jobs`
- Do NOT push unless instructed.

## Steps

### Step 1: Add npm cache to setup-node steps

In each in-scope workflow, update every `actions/setup-node@v4` step that is
followed by `npm ci`:

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

Apply to **all** setup-node steps in those files (including prepare-matrix if
it runs node scripts without npm ci — cache is harmless but only needed before
`npm ci`).

**Verify**: `grep -A3 'setup-node@v4' .github/workflows/scheduled-backup.yml`
shows `cache: 'npm'` on backup job step.

### Step 2: Add backup job timeout

On the `backup` job in `scheduled-backup.yml`:

```yaml
backup:
  timeout-minutes: 15
```

On the single job in `backup.yml` and `drift-detection.yml`:

```yaml
jobs:
  backup:  # or detect-drift
    timeout-minutes: 15
```

15 minutes is sufficient for successful backups (recent successes complete in
~30–60 seconds) while capping failed API hangs. Adjust to 20 only if legitimate
large tenants exceed 15 minutes in production — document evidence in commit.

**Verify**: `node scripts/test-workflow-references.mjs` → exit 0

### Step 3: Confirm package-lock.json exists

npm cache requires a lockfile:

```bash
test -f package-lock.json && echo ok || echo MISSING
```

If missing, STOP — cache won't work; run `npm install` once locally to generate
lockfile in a separate plan (out of scope here).

## Test plan

- `node scripts/test-workflow-references.mjs`
- After merge, first CI run populates cache; second run should show cache hit in
  setup-node log (operator verification — note in PR).

## Done criteria

- [ ] `cache: 'npm'` on setup-node before every `npm ci` in in-scope workflows
- [ ] `timeout-minutes: 15` on backup/drift jobs
- [ ] `package-lock.json` exists
- [ ] `node scripts/test-workflow-references.mjs` exits 0
- [ ] `plans/README.md` row 005 → DONE

## STOP conditions

- `package-lock.json` missing — stop and report.
- Legitimate backups routinely exceed 15 minutes in production logs — stop and
  propose higher timeout with evidence (tenant name + duration).
- setup-node cache causes install failures — revert cache on affected workflow
  and report.

## Maintenance notes

- When adding new workflows that run `npm ci`, copy the cached setup-node pattern.
- Timeout value should stay aligned with ISC API export duration; revisit if
  SailPoint increases export sizes materially.
