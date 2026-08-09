export class EventStore {
  private readonly events = new Map<string, number>();
  constructor(private readonly ttlMs = 24 * 60 * 60 * 1000) {}

  has(eventId: string): boolean {
    this.prune();
    return this.events.has(eventId);
  }

  add(eventId: string): void {
    this.events.set(eventId, Date.now() + this.ttlMs);
  }

  delete(eventId: string): void {
    this.events.delete(eventId);
  }

  private prune(): void {
    const now = Date.now();
    for (const [id, expiresAt] of this.events) if (expiresAt <= now) this.events.delete(id);
  }
}
