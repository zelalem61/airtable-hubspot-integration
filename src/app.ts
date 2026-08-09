import express from 'express';
import { AirtableClient } from './airtable/client.js';
import { loadConfig } from './config.js';
import { HubSpotClient } from './hubspot/client.js';
import { SyncService } from './sync/service.js';
import { webhookRouter } from './webhook/router.js';

const config = loadConfig(true);
const app = express();
app.use(express.json({ limit: '100kb' }));
app.get('/health', (_request, response) => response.json({ status: 'ok' }));

const airtable = new AirtableClient(config.AIRTABLE_ACCESS_TOKEN!, config.AIRTABLE_BASE_ID!);
const hubspot = new HubSpotClient(config.HUBSPOT_ACCESS_TOKEN);
app.use('/webhooks', webhookRouter(new SyncService(airtable, hubspot), config.AIRTABLE_WEBHOOK_SECRET!));

app.listen(config.PORT, () => console.log(`Listening on port ${config.PORT}`));
