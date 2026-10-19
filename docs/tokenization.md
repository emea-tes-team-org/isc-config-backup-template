# Tokenization — Environment-Specific Values

Tokenization lets you store environment-specific values (hostnames, URLs,
credentials, SAML endpoints, email addresses, etc.) as `{{TOKEN}}` placeholders
in reusable template files, then resolve them against a per-tenant variable file
at restore time.

## How it works

1. **Template files** mirror the backup JSON envelope but with tokenized fields:

   ```json
   { "object": { "attributes": { "url": "{{SERVICENOW_TICKET_VEN03769_URL}}" } }, ... }
   ```

2. **Vars files** (`vars/<tenant>.vars.yaml`) hold the resolved values for each tenant:

   ```yaml
   SERVICENOW_TICKET_VEN03769_URL: "https://ven03769.service-now.com/"
   ```

3. At restore time, `restore.mjs --vars <tenant>` substitutes every placeholder
   before uploading to the SailPoint API.

The token format `{{UPPER_SNAKE_CASE}}` is deliberately distinct from ISC's own
`{{$.path}}` workflow interpolation syntax, so there is no collision.

## Directory layout

```
templates/
  default/
    SOURCE/
      new-features.json        ← tokenized, named by self.name
    SERVICE_DESK_INTEGRATION/
      ServiceNow-Ticket-ven03769.json
    AUTH_ORG/
      beta-15156.json
    ...
vars/
  beta-15156.vars.yaml         ← resolved values for beta-15156
  production.vars.yaml         ← resolved values for production
```

Backups on tenant branches use flat `backups/<TYPE>/<id>.json` paths. Tokenization reads from `backups/` on the checked-out tenant branch.

## Tokenization script

```bash
npm run cli -- tokenize <subcommand> [args]
# or directly:
node scripts/cli.mjs tokenize <subcommand> [args]
```

Or use **ISC Config Tools** (`operation: tokenize`) from GitHub Actions.

### `create-template <tenant> [--template <name>]`

Read flat `backups/`, replace known environment-specific fields with
`{{TOKEN}}` placeholders, write tokenized files to `templates/<name>/`
(default template name: `default`), and seed `vars/<tenant>.vars.yaml`
with the actual values from the source tenant.

```bash
node scripts/cli.mjs tokenize create-template beta-15156 --template default
# → templates/default/SERVICE_DESK_INTEGRATION/ServiceNow-Ticket-ven03769.json
# → vars/beta-15156.vars.yaml
```

The following field paths are automatically tokenized (per object type).
These defaults live in [`token-paths.json`](../token-paths.json) at the project
root — edit that file to add or remove paths for your own connector types
without touching source code (see [Customising tokenizable paths](#customising-tokenizable-paths) below).

| Type | Tokenized fields |
|------|------------------|
| `SOURCE` | `connectorAttributes.host/token/url/user/username/password/clientId/clientSecret/baseurl/spConnectorInstanceId/spConnectorSpecId/sources`, `owner.id` |
| `SERVICE_DESK_INTEGRATION` | `attributes.url/tokenUrl/username/requesterSource`, `clusterRef.id`, `ownerRef.id`, `beforeProvisioningRule.id`, `provisioningConfig.managedResourceRefs[].id` ¹ |
| `AUTH_ORG` | `orgConfig.domain`, `tenant`, SAML `alias/callbackUrl/entityId` |
| `IDENTITY_PROFILE` | `authoritativeSource.id`, `owner.id`, all `sourceId` fields inside attribute transforms ¹ |
| `LIFECYCLE_STATE` | `identityProfileRef.id`, `accountActions[]/accountActionRefs[]` source IDs ¹, `emailNotificationOption.emailAddressList` ¹ |
| `ACCESS_PROFILE` | `owner.id`, `source.id` |
| `ROLE` / `GOVERNANCE_GROUP` / `SEGMENT` / `FORM_DEFINITION` | `owner.id` |
| `SOD_POLICY` | `externalPolicyReference`, `ownerRef.id`, `creatorId`/`creatorRef.id` (shared token) ¹ |
| `WORKFLOW` | `owner.id`; per step: `sp:http` url/oauth fields/`jsonRequestBody` UUIDs, `sp:send-email` static recipients/from/replyTo, `sp:interactive-form` formDefinitionId, `sp:compare-*` UUID comparison values ¹ |
| `TRIGGER_SUBSCRIPTION` | `workflowConfig.workflowId` |

¹ Handled by a compiled custom scanner, not configurable via `token-paths.json`.

### `find-tokens <tenant> [--template <name>]`

Match each template file against flat `backups/` by `self.name` and
`self.type`, extract the value at every `{{TOKEN}}` position, and write
`vars/<tenant>.vars.yaml`.

```bash
node scripts/cli.mjs tokenize find-tokens production --template default
# → vars/production.vars.yaml
```

### `diff-tenants <tenant-a> <tenant-b>`

Compare two tenants' backups by `self.type` + `self.name` and print every field
that differs between matched pairs.

```bash
node scripts/cli.mjs tokenize diff-tenants beta-15156 production
```

## Restoring with token substitution

See [Restore Guide](restore.md).

## Customising tokenizable paths

`token-paths.json` at the project root controls which fields are tokenized for
each ISC object type.

```jsonc
{
  "tokenizablePaths": {
    "SOURCE": [
      ["object", "connectorAttributes", "host"],
      ["object", "connectorAttributes", "apiEndpoint"]
    ]
  }
}
```

> **Note** — Workflow step scanning, IDENTITY_PROFILE transform recursion,
> LIFECYCLE_STATE pairing, SERVICE_DESK_INTEGRATION managedResourceRefs, and
> SOD_POLICY creator token sharing require code changes in `scripts/token-utils.mjs`.
