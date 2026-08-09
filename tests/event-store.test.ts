import { describe, expect, it } from 'vitest';
import { EventStore } from '../src/webhook/event-store.js';

describe('EventStore', () => {
  it('recognizes and releases duplicate event IDs', () => {
    const store = new EventStore();
    expect(store.has('evt-1')).toBe(false);
    store.add('evt-1');
    expect(store.has('evt-1')).toBe(true);
    store.delete('evt-1');
    expect(store.has('evt-1')).toBe(false);
  });
});
