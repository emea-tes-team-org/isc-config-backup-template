# Retrospective: improve-backup-export-resilience

> Written: 2026-08-06 (after verify passed)

---

## 0. Evidence

- **Tasks done**: 16/16
- **Test coverage**: `test-backup-export-retry.mjs` (10 assertions), updated parse-tenants + workflow refs
- **OpenSpec validate state at archive**: pass

---

## 1. Wins

- Export retry logic extracted with injectable deps for unit testing without ISC API
- `axa` overrides land in `tenants.yaml` with README operational guidance

## 2. Misses

- 📌 Manual `backup.yml` job timeout remains 15 min while axa poll budget is 20 min — scheduled path fully covered via matrix

## 3. Plan deviations

| Plan task | What changed | Why |
|-----------|--------------|-----|
| backup.mjs main guard | Added `import.meta.url` entry check | Prevent main() running on test import |

## 4. Skill / workflow compliance

Direct implementation (no subagent dispatch) — acceptable for focused 16-task change.

## 5. Surprises

- Importing `backup.mjs` in tests triggered `main()` until entry guard added

## 6. Promote candidates

- [ ] 🟡 **Guard CLI modules against auto-run on import** -> **Promote to project conventions**
  > **Why**: test imports side-effected production main()
  > **How to apply**: Any script with top-level main() uses import.meta.url guard
