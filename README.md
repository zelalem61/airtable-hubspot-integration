# Airtable to HubSpot Integration

This project implements both parts of the technical assessment:

1. A repeatable migration of companies, contacts, and deals from CSV files to HubSpot.
2. A real-time Airtable-to-HubSpot integration for companies, contacts, deals, and line items.

## Architecture

```text
Migration Data.zip -> validate/normalize -> HubSpot

Airtable change -> native Airtable webhook -> TypeScript service
                                               |
                                               +-> fetch current Airtable record
                                               +-> create/update HubSpot record
                                               +-> maintain associations
                                               +-> write HubSpot ID to Airtable
```

The service is written in TypeScript and hosted as an Express application. It uses the Airtable and HubSpot REST APIs directly, Zod for validation, and Vitest for tests.

## Setup

Copy `.env.example` to `.env` and configure the credentials, then run:

```bash
pnpm install
pnpm setup:hubspot
pnpm setup:airtable
pnpm setup:airtable-webhooks
```

Required Airtable token scopes:

```text
schema.bases:read
schema.bases:write
data.records:read
data.records:write
webhook:manage
```

Useful commands:

```bash
pnpm validate:data  # validate the source archive
pnpm migrate        # run the CSV migration
pnpm dev            # run the integration locally
pnpm build          # compile TypeScript
pnpm test           # run tests
```

## Part 1: Migration

The migration processes records in dependency order:

1. Companies
2. Contacts and their company associations
3. Deals and their company/contact associations

Stable custom identifiers (`source_company_id`, `source_contact_id`, and `source_deal_id`) make the migration safe to rerun. Individual failures are collected without terminating the whole job, and the final result is written to `migration-report.json`.

### Source-data findings

The supplied data contains 300 companies, 400 contacts, and 400 deals. Validation identified:

- Five contacts referencing missing companies.
- Two deals referencing missing companies.
- Eight deals with blank amounts.
- 398 deals whose company differs from the referenced contact's company.
- Mixed date, boolean, currency, percentage, and industry formats.

Explicit source relationships are preserved independently. Invalid associations are logged and skipped rather than guessed or silently changed.

## Part 2: Real-time integration

Airtable's native Webhooks API notifies the service when a watched business field changes. The notification contains a webhook ID; the service retrieves the change payload using Airtable's cursor API, fetches the current record, and synchronizes it to HubSpot.

The integration supports:

```text
Contact   -> Company
Deal      -> Company
Line Item -> Deal
```

Deals are not directly associated with contacts in Part 2, as required by the brief.

### Create/update and duplicate safety

The service determines the operation using this order:

1. Use Airtable's `hubspot_record_id` when present.
2. Otherwise search HubSpot by the stable source ID.
3. Update the match or create a new record.
4. Write the resulting HubSpot ID back to Airtable.

This handles duplicate webhook delivery and the failure case where HubSpot succeeds but Airtable ID write-back does not. Per-record locks prevent simultaneous events in one service instance. Airtable webhooks exclude `hubspot_record_id`, preventing write-back loops.

### Associations

Parents are synchronized before children. If a linked parent changes, the previous default association is removed and the new one is added.

Line items represent individual products or services on a deal. Each line item contains a name, quantity, and unit price and is associated with one HubSpot deal. Deal totals are not recalculated because the source does not define tax, discounts, or pricing rules.

### Deal stages

| Airtable status | HubSpot stage |
|---|---|
| Won / Closed Won | `closedwon` |
| Lost / Closed Lost | `closedlost` |
| Anything else | `qualifiedtobuy` |

### Normalization and resilience

- Mixed date formats are normalized to ISO dates.
- Boolean, currency, percentage, and industry values are normalized before API calls.
- Airtable and HubSpot `429` and `5xx` responses are retried with exponential backoff and jitter.
- Invalid webhook payloads are rejected before processing.
- Webhook payload cursors start at zero so the first creation event is preserved.

## Why not Whalesync?

I considered Whalesync because it is a practical low-code option for standard production synchronization. I chose custom middleware because this assessment evaluates API design, create/update logic, associations, status mapping, idempotency, retries, and data handling. Implementing these concerns directly makes the reasoning visible and testable. For a standard production use case, I would still compare Whalesync's subscription and platform constraints with the cost of maintaining custom middleware.

## Testing

The automated suite covers normalization, source-data validation, HubSpot create/update decisions, and duplicate-event tracking. The integration was also verified end to end against Airtable, the hosted service, and a HubSpot sandbox.

```bash
pnpm build
pnpm test
```

Current result: 31 tests passing.

## Assumptions

- Source IDs are stable and unique within each object type.
- A contact has one company, a deal has one company, and a line item has one deal in Part 2.
- Deletion synchronization is outside the requested create/update scope.
- The configured HubSpot pipeline contains the mapped stage IDs.
- Ambiguous slash dates use `MM/DD/YYYY` unless the first component is greater than 12.

## Improvements

- Persist webhook cursors and idempotency keys in PostgreSQL for multi-instance operation.
- Refresh Airtable webhook subscriptions automatically before expiration.
- Queue webhook processing and add dead-letter replay.
- Use HubSpot batch APIs for faster migrations.
- Validate HubSpot pipeline metadata during startup.
- Add structured logs, metrics, and sandbox contract tests.
