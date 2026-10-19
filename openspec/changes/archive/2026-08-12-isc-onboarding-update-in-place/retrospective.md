# Retrospective: isc-onboarding-update-in-place

> Written: 2026-08-12 (after verify passed, pre-archive)

**Worktree:** `/Users/fernando.delosrios/Documents/Development/ISC/resources/isc-config-backup`

---

## 0. Evidence

- **Tasks done:** 15/15 (`tasks.md` all `[x]`)
- **Tests:** `test-onboard-upsert.mjs` (16 assertions), `test-workflow-references.mjs` (onboarding section)
- **OpenSpec validate:** `isc-onboarding-update-in-place --strict` passed
- **New files:** `scripts/onboard-utils.mjs`, `scripts/test-onboard-upsert.mjs`
- **Modified:** `onboarding.yml`, `onboard.mjs`, README, CHANGELOG

---

## 1. Wins

- Workflow and CLI now share upsert semantics — eliminates duplicate-rejection drift that blocked re-onboard after offboard
- Extracted `onboard-utils.mjs` keeps pure merge/outcome logic testable without loading `libsodium-wrappers`
- `--from-env --push-registry` gives CI a clean entry point without YAML escaping issues

## 2. Misses

- 🟡 **No integration test for credential-validation gate** — workflow order verified structurally only; secrets-not-written on 401 not asserted in automation
- 📌 **`plan.md` micro-steps lagged `tasks.md`** — fixed during archive prep

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| Task 2 Step 3 | Contents API instead of `git checkout` | Same safety goal; simpler in Actions runner |
| Task 3 Step 2 | `--from-env` instead of temp YAML file | Avoids secret/URL escaping in heredoc |

## 4. Skill / workflow compliance

| Skill | Used |
|-------|------|
| superpowers:brainstorming | ✓ |
| superpowers:writing-plans | ✓ |
| superpowers:subagent-driven-development | ✓ (apply session) |
| superpowers:test-driven-development | ✓ |
| superpowers:finishing-a-development-branch | pending (post-commit) |

### Deliberately Skipped Skills

_(none — archive cycle complete for this change scope)_

## 5. Surprises

- Importing `onboard.mjs` in tests pulled `libsodium-wrappers`; utils extraction was required for fast unit tests

## 6. Promote candidates -> long-term learning

- [ ] 🟡 **Extract shared onboarding utils before adding workflow parity** -> **Promote to project CLAUDE.md**
  > **Why:** Workflow/CLI drift recurred because bash duplicated logic that already existed in Node.
  > **How to apply:** When changing onboarding behavior, update `onboard-utils.mjs` first, then wire workflow + CLI to it.
