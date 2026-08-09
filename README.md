# Airtable to HubSpot Assessment

This repository implements both parts of the assessment:

1. A repeatable CSV-to-HubSpot migration for companies, contacts, and deals.
2. A real-time Airtable-to-HubSpot webhook service for companies, contacts, deals, and line items.

The same mapping and HubSpot client code is used by both paths. Records are identified by stable source IDs rather than mutable names, and associations are created only after their parent records are available.

## Architecture

```text
Migration Data.zip -> validation/normalization -> HubSpot CRM
                                                company -> contact
                                                company -> deal -> contact (migration only)

Airtable automation -> POST /webhooks/airtable -> fetch current Airtable record
                                              -> source-ID upsert in HubSpot
                                              -> synchronize association
                                              -> write hubspot_record_id to Airtable
```

For the integration, contacts are associated with companies, deals with companies, and line items with deals. In accordance with Part 2, deals are not associated directly with contacts.

## Technology

- Node.js 20+ and TypeScript
- Express for the webhook service
- Native `fetch` for the HubSpot and Airtable REST APIs
- Zod for configuration and webhook validation
- `csv-parse` and `adm-zip` for migration input
- Vitest for automated tests

Using thin REST clients keeps the API behavior explicit and makes retry and error handling consistent.

## Setup

1. Copy `.env.example` to `.env`.
2. Create a HubSpot private app with read/write access to companies, contacts, deals, line items, properties, and associations.
3. Create an Airtable personal access token with record read/write access to the assessment base.
4. Install dependencies:

   ```bash
   pnpm install
   ```

5. Create the required HubSpot custom properties:

   ```bash
   pnpm setup:hubspot
   ```

6. Align an existing empty Airtable CRM template with the assessment schema:

   ```bash
   pnpm setup:airtable
   ```

7. Verify the project:

   ```bash
   pnpm build
   pnpm test
   pnpm validate:data
   ```

## Part 1: Migration

Place `Migration Data.zip` at the repository root or set `MIGRATION_ZIP` to its location. Then run:

```bash
pnpm migrate
```

The migration processes records in dependency order:

1. Companies
2. Contacts and their company associations
3. Deals and their company/contact associations

Each object receives a unique source property (`source_company_id`, `source_contact_id`, or `source_deal_id`). Rerunning the migration updates matching records instead of creating duplicates. The command writes `migration-report.json` with counts, warnings, and per-record errors.

The program continues after an individual record failure so the final report shows the complete result. It never invents a missing association.

### Source-data findings

The supplied archive contains 300 companies, 400 contacts, and 400 deals. Validation found:

- Five contacts referencing missing company IDs (`304` or `307`).
- Two deals referencing missing company IDs (`304` or `312`).
- Eight deals with a blank amount.
- 398 deals whose explicit company differs from the referenced contact's company.
- Mixed date, boolean, currency, and percentage formats.

The migration preserves each explicit source edge independently: a contact uses its own `company_id`, while a deal uses its own `company_id` and `contact_id`. It logs contradictory or missing references rather than silently changing them.

## Part 2: Airtable base

Create these fields with the exact names below. ID fields should be single-line text; relationship fields should be linked-record fields where noted.

### Companies

`company_name`, `company_id`, `domain`, `industry`, `number_of_employees`, `hubspot_record_id`

### Contacts

`first_name`, `last_name`, `email`, `contact_id`, `company_id` (link to Companies), `hubspot_record_id`

### Deals

`deal_name`, `amount`, `status`, `close_date`, `company_id` (link to Companies), `hubspot_record_id`

### Line Items

`product_name`, `quantity`, `unit_price`, `deal_id` (link to Deals), `hubspot_record_id`

An optional `line_item_id` can be added. If absent, the Airtable record ID becomes the stable source line-item ID.

## Airtable automation

Create an automation for each table using the "When record created" and "When record updated" triggers. Exclude changes to `hubspot_record_id` from the update trigger when Airtable permits field selection; this avoids an unnecessary second event after ID write-back.

Add a "Run a script" action with input variables `recordId`, `tableName`, `webhookUrl`, and `webhookSecret`:

```js
const { recordId, tableName, webhookUrl, webhookSecret } = input.config();
const eventId = `${tableName}:${recordId}:${Date.now()}`;

const response = await fetch(`${webhookUrl}/webhooks/airtable`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-webhook-secret': webhookSecret,
  },
  body: JSON.stringify({ eventId, table: tableName, recordId }),
});

if (!response.ok) {
  throw new Error(`Sync failed (${response.status}): ${await response.text()}`);
}
```

For a production deployment, use Airtable's Webhooks API and payload cursor rather than generating an event ID in an automation. The assessment implementation accepts the simpler automation delivery described in the brief.

## Running the service

Development:

```bash
pnpm dev
```

Production:

```bash
pnpm build
pnpm start
```

Endpoints:

- `GET /health`
- `POST /webhooks/airtable`

## Deploying to Render

The repository includes `render.yaml`. Push the project to a private GitHub repository, then in Render choose **New > Blueprint** and select that repository. Render reads the build, start, and health-check settings automatically.

Add these secret environment variables in Render without committing `.env`:

- `HUBSPOT_ACCESS_TOKEN`
- `AIRTABLE_ACCESS_TOKEN`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_WEBHOOK_SECRET` (Render can generate this from the blueprint)

After deployment, verify `https://<service-name>.onrender.com/health` returns `{"status":"ok"}`. Use the same public base URL and generated webhook secret in the Airtable automation.

Example payload:

```json
{
  "eventId": "Companies:recABC:1770000000000",
  "table": "Companies",
  "recordId": "recABC"
}
```

The request must include the configured `x-webhook-secret` header.

## Create/update and duplicate safety

The service uses four safeguards:

1. `hubspot_record_id` is used when Airtable already knows the HubSpot record.
2. If the ID is empty or stale, HubSpot is searched by a unique stable source property.
3. A per-record lock serializes simultaneous events within a service instance.
4. Recently completed event IDs are retained for 24 hours; failed event IDs are released for retry.

The source-ID search closes the important failure window where HubSpot creates a record but Airtable ID write-back fails. A retry finds and updates the existing HubSpot object.

## Associations

The service recursively synchronizes the linked parent before the child. It then removes any previous default parent association and adds the requested one. This matters when a contact changes company or a line item changes deal.

Line items are represented as HubSpot line-item objects with `name`, `quantity`, and `price`; each is associated with one deal. The service does not recalculate the deal amount because the brief does not define whether the amount is gross, discounted, or manually entered.

## Deal-stage mapping

The mapping is case-insensitive:

| Airtable status | HubSpot internal stage |
|---|---|
| Won | `closedwon` |
| Lost | `closedlost` |
| Any other value | `qualifiedtobuy` |

These internal IDs must exist in the selected HubSpot pipeline. A production integration should retrieve pipeline stages during startup and fail fast if the configured IDs do not exist.

## Date assumptions

- ISO dates and `YYYY/MM/DD` are unambiguous.
- `DD/MM/YYYY` is selected when the first component is greater than 12.
- Otherwise a slash date is interpreted as `MM/DD/YYYY`.
- Month-only values such as `02/2024` become the first day of that month.

These decisions are explicit because ambiguous source dates cannot be reconstructed reliably without the source system's locale.

## Error handling

- HubSpot/Airtable `429` and `5xx` responses are retried with exponential backoff and jitter.
- Invalid webhook payloads return `400`; invalid secrets return `401`.
- A downstream sync failure returns `502`, and the event remains eligible for retry.
- Migration failures are collected in the report instead of terminating the entire run.

## Improvements with more time

- Replace the in-memory event store and lock with PostgreSQL, using unique constraints and transactional job claiming across multiple service instances.
- Consume Airtable's native Webhooks API using payload cursors and refresh webhook subscriptions automatically.
- Queue webhook work and return `202` immediately, with a dead-letter queue and operator replay tooling.
- Batch HubSpot migration requests while preserving per-record error reporting.
- Cache pipeline and association metadata rather than relying on default association endpoints.
- Add contract tests against dedicated Airtable and HubSpot sandboxes.
- Add structured logs, metrics, tracing, and alerting.
- Add deletion/archive synchronization after product requirements define deletion behavior.

## Assumptions

- Source IDs are stable and unique within their object type.
- A contact has one company, a deal has one company, and a line item has one deal in Part 2.
- Deletions are outside the assessment's create/update scope.
- The default HubSpot sales pipeline contains the stage IDs used above.
- HubSpot custom property creation is allowed by the private-app scopes.
