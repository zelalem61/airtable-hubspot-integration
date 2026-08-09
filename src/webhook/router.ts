import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { errorMessage } from '../lib/errors.js';
import { SyncService } from '../sync/service.js';
import { EventStore } from './event-store.js';

const payloadSchema = z.object({
  eventId: z.string().min(1),
  table: z.enum(['Companies', 'Contacts', 'Deals', 'Line Items']),
  recordId: z.string().min(1),
});

export function webhookRouter(service: SyncService, secret: string, events = new EventStore()): Router {
  const router = Router();
  router.post('/airtable', async (request, response) => {
    if (!matchesSecret(request.header('x-webhook-secret'), secret)) {
      response.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const parsed = payloadSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      return;
    }
    const { eventId, table, recordId } = parsed.data;
    if (events.has(eventId)) {
      response.status(200).json({ status: 'duplicate', eventId });
      return;
    }
    events.add(eventId);
    try {
      const result = await service.sync(table, recordId);
      response.status(200).json({ status: 'synced', eventId, ...result });
    } catch (error) {
      events.delete(eventId); // allow Airtable or the caller to retry a failed event
      response.status(502).json({ status: 'failed', eventId, error: errorMessage(error) });
    }
  });
  return router;
}

function matchesSecret(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
