import { loadConfig } from '../config.js';
import { HubSpotClient } from '../hubspot/client.js';
import { HUBSPOT_PROPERTIES } from '../hubspot/properties.js';

const config = loadConfig();
const client = new HubSpotClient(config.HUBSPOT_ACCESS_TOKEN);
for (const [objectType, definitions] of Object.entries(HUBSPOT_PROPERTIES)) {
  for (const definition of definitions) {
    await client.ensureProperty(objectType as keyof typeof HUBSPOT_PROPERTIES, definition);
    console.log(`Ready: ${objectType}.${definition.name}`);
  }
}
