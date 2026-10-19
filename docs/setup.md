# Setup

## 1. Use this template

Fork or use this repository as a template.

## 2. Create a SailPoint API client

In your ISC tenant, create a Personal Access Token (PAT) or API client with the following scopes:

- `sp:scopes:all` (or at minimum: `sp:config:read`, `sp:config:manage`)

## 3. Configure a fine-grained GitHub token

The ISC Lifecycle workflow creates a GitHub Environment per tenant, writes that tenant's credentials as environment secrets, and commits the registry plus shortcut workflows on `main`. The built-in `GITHUB_TOKEN` cannot create environments or environment secrets.

Use a **fine-grained personal access token** limited to this repository.

Save the token as a repository secret named **`ADMIN_TOKEN`**
(**Settings > Secrets and variables > Actions > New repository secret**).
The token owner must be allowed to administer this repository.

### Start from the GitHub UI

1. Sign in at [github.com](https://github.com)
2. Click your **profile photo** (top right) → **Settings**
3. In the left sidebar, scroll to the bottom → **Developer settings**
4. **Personal access tokens** → **Fine-grained tokens**
5. Click **Generate new token**

Direct link (same screen): [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

### Permissions

**Repository access:** Only select repositories → this repository.

On the **Repositories** tab, set:

| Permission | Access | Used for |
| ---------- | ------ | -------- |
| Administration | Read and write | Create or update the tenant GitHub Environment |
| Environments | Read and write | Set `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` |
| Contents | Read and write | Commit `tenants.yaml`, the dashboard, branches, and tags |
| Workflows | Read and write | Commit shortcut workflows under `.github/workflows/` |
| Actions | Read-only | Read the environment during verify |
| Metadata | Read-only | Required by GitHub; you cannot remove it |

If a permission is not listed yet, click **+ Add permissions** and add it. Leave the **Organizations** tab at **(0)**. Do not add the repository **Secrets** permission — environment secrets use **Environments**, not **Secrets**.

### User-owned repository

Use when the repo lives under your personal account (resource owner = you).

1. Open the create form via the UI path above
2. **Token name:** e.g. `isc-config-backup-admin`
3. **Expiration:** choose a rotation period (e.g. 90 days)
4. **Resource owner:** your personal account
5. **Repository access:** Only select repositories → this repository
6. Set the **Permissions** in the table above
7. **Generate token** → copy it once → save it as the **`ADMIN_TOKEN`** repository secret

### Organization-owned repository

Use when the repo lives under an org (e.g. `emea-tes-team-org/…`).

1. Open the create form via the UI path above (still under **your** user Settings → Developer settings — tokens are always created as you, even for org repos)
2. **Token name** / **Expiration** as above
3. **Resource owner:** select the **organization** (not your personal account)
4. **Repository access:** Only select repositories → this repository
5. Same **Permissions** as the user case
6. **Generate token** → copy it once → save it as **`ADMIN_TOKEN`**

Org caveats:

- An org owner must allow fine-grained PATs: open the org page → **Settings** → **Personal access tokens** and permit fine-grained tokens. If the org is missing from Resource owner, that policy is blocking you.
- Some orgs require an owner to **approve** the token before it works. Create it, then ask an owner to approve (org → Settings → Personal access tokens → Pending requests).
- Confirm Resource owner is the org before generating.

## 4. Onboard your first tenant

You can onboard tenants either from the GitHub UI (no local tools required) or
with the local CLI.

### GitHub Actions onboarding (recommended)

1. Go to **Actions > ISC Lifecycle > Run workflow**
2. Set **operation** to `onboard` and fill in the inputs:
   - **API URL**: your ISC API base URL, e.g. `https://acme.api.identitynow.com`
   - **Client ID / Client Secret**: from your SailPoint API client
   - **Tenant name** (optional): derived from the API URL hostname if left blank
   - **Active** (default `true`): include in daily scheduled backups
   - **Description** (optional): shown in `.tenant.yaml`
3. Run the workflow

The workflow will:

- Validate the credentials against your ISC tenant
- Create or update a branch named after the tenant (existing branches and backup history are preserved)
- Create or update a GitHub Environment with the same name
- Set `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` as environment secrets (overwriting prior values)
- Commit or update `.tenant.yaml` and a branch-specific `.gitignore` on the tenant branch
- Register or update the tenant in `tenants.yaml` on `main` (preserving custom `schedule`, `environment`, and backup tuning fields)

Re-run the same workflow to refresh rotated credentials, update metadata, or **re-onboard after offboard** without using the CLI.

The tenant will be included in the next run of **Scheduled Backup**
(which runs at 00:00 UTC by default). To run the first backup immediately, trigger the
scheduled backup workflow manually and enter the tenant name.

### Verifying onboarding

After onboarding, verify that all artifacts were created correctly with the
verification script or the per-tenant **Verify** link in the README fleet table
(`isc-verify-<tenant>.yml`):

```bash
npm run cli -- verify <tenant-name>
```

Prerequisites:

- [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated. Verify reads the environment, so the token needs **Actions: Read-only** and **Environments: Read-only**. The `ADMIN_TOKEN` from the section above is enough.
- A git remote named `origin` pointing to the GitHub repository.

The script checks, in order:

1. Tenant branch exists on origin
2. GitHub Environment with the tenant name exists
3. Environment secrets `TENANT_URL`, `CLIENT_ID`, and `CLIENT_SECRET` are present
4. `.tenant.yaml` on the tenant branch is valid
5. `.gitignore` on the tenant branch tracks flat `backups/`
6. Tenant is listed in `tenants.yaml` on `main`

Example output for a fully onboarded tenant:

```text
======================================================================
Verification Summary
======================================================================
✓ Tenant branch exists: PASSED
    refs/heads/acme-prod
✓ GitHub Environment exists: PASSED
    Environment "acme-prod" found in org/repo
✓ Environment secrets present: PASSED
    TENANT_URL, CLIENT_ID, CLIENT_SECRET found
✓ .tenant.yaml valid: PASSED
    name=acme-prod, active=true
✓ .gitignore valid: PASSED
    flat backups/ tracked
✓ Tenant in tenants.yaml: PASSED
    active=true
✗ Backup artifacts committed: SKIPPED
    Use --backup to dispatch a backup and verify committed artifacts
----------------------------------------------------------------------
6/7 checks passed
======================================================================
```

To also trigger a backup and verify backup artifacts are committed, pass the
`--backup` flag:

```bash
npm run cli -- verify <tenant-name> --backup
```

If any check fails, the script exits with a non-zero status and prints details
so you can diagnose the onboarding issue.

### Local CLI onboarding

For developers who prefer the command line, `scripts/onboard.mjs` is also
available:

```bash
npm run cli -- onboard --interactive
```

The first time you run this, it will ask for the fine-grained token from
[Configure a fine-grained GitHub token](#3-configure-a-fine-grained-github-token).
The token is stored locally in `.github/.local-pat` and is never committed.

Then follow the prompts:

- **Tenant name**: lowercase, alphanumeric, hyphens (e.g., `acme-prod`)
- **Tenant URL**: your ISC API base URL
- **Client ID / Secret**: from your SailPoint API client
- **Active**: whether to enable daily scheduled backups

See [CLI Reference](cli.md) for batch onboarding and tenant management commands.

## Config Hub integration

Once the [UI Development Kit](https://github.com/sailpoint-oss/ui-development-kit) is running, open the Config Hub component and click the **settings icon**. Enter the following in the Repository Settings dialog:

| Setting            | Description                                    | Example                                               |
| ------------------ | ---------------------------------------------- | ----------------------------------------------------- |
| **Repository URL** | HTTPS URL of this repository                   | `https://github.com/org/colab-isc-config-hub-history` |
| **Backups Path**   | Folder containing backups                      | `backups`                                             |
| **Default Branch** | Tenant branch to browse (not `main`)           | `acme-prod`                                           |
| **GitHub PAT**     | Fine-grained token for this repository with **Contents: Read-only** (Metadata stays Read-only) | `github_pat_...` |

Settings are saved to browser localStorage for future sessions.

**Important:** Config Hub reads flat `backups/<TYPE>/<id>.json` from the **tenant branch**, not from `main`. Set **Default Branch** to the tenant name and **Backups Path** to `backups`.

## GitHub Actions roster

Six operator workflows on `main` (linked from the generated README):

| Workflow | File | Purpose |
| -------- | ---- | ------- |
| ISC Lifecycle | `isc-lifecycle.yml` | onboard, verify, schedule-toggle, offboard |
| ISC Backup | `isc-backup.yml` | manual per-tenant backup |
| ISC Restore | `isc-restore.yml` | cross-tenant restore (`source_ref` required) |
| ISC Config Tools | `isc-config-tools.yml` | tokenize, drift-detection |
| Scheduled Backup | `scheduled-backup.yml` | fleet matrix (cron + manual) |
| ISC Maintenance | `isc-maintenance.yml` | prune-tags, cleanup-deployments |

Per-tenant shortcut workflows (`isc-backup-<tenant>.yml`, `isc-toggle-<tenant>.yml`, `isc-verify-<tenant>.yml`, `isc-offboard-<tenant>.yml`) are generated from `tenants.yaml` and linked from the README fleet table **Actions** column. Offboard shortcuts require typing `offboard` to confirm.

**One-time migration workflows** (not part of the six-card roster):

| Workflow | File | When to run |
| -------- | ---- | ----------- |
| ISC Cleanup Tenant Workflows | `cleanup-tenant-workflows.yml` | Once after upgrading from workflow-sync; removes copied `.github/workflows/` from tenant branches |
| _(script)_ | `scripts/migrate-flat-backups.mjs` | Once per tenant branch to move `backups/<tenant>/` → flat `backups/` |
