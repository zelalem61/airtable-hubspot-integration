import { Router } from 'express';
import { z } from 'zod';
import { AirtableNativeWebhookProcessor } from '../airtable/native-webhooks.js';

const notificationSchema = z.object({
  base: z.object({ id: z.string() }),
  webhook: z.object({ id: z.string() }),
  timestamp: z.string().optional(),
});

export function nativeAirtableWebhookRouter(processor: AirtableNativeWebhookProcessor): Router {
  const router = Router();
  router.post('/airtable-native', (request, response) => {
    const parsed = notificationSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'Invalid Airtable notification' });
      return;
    }
    response.status(200).json({ status: 'accepted' });
    void processor.process(parsed.data.webhook.id).catch((error) => {
      console.error('[airtable-webhook] Processing failed:', error);
    });
  });
  return router;
}
