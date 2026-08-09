import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubSpotClient } from '../src/hubspot/client.js';

describe('HubSpotClient upsert', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('updates when the unique source ID already exists', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [{ id: '42', properties: { source_company_id: '1' } }] }))
      .mockResolvedValueOnce(jsonResponse({ id: '42', properties: { name: 'Updated' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new HubSpotClient('token').upsert(
      'companies', 'source_company_id', '1', { name: 'Updated' },
    );
    expect(result.operation).toBe('updated');
    expect(result.record.id).toBe('42');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('PATCH');
  });

  it('creates only after the unique source ID search finds nothing', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ results: [] }))
      .mockResolvedValueOnce(jsonResponse({ id: '99', properties: { source_company_id: '1' } }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await new HubSpotClient('token').upsert(
      'companies', 'source_company_id', '1', { name: 'Created' },
    );
    expect(result.operation).toBe('created');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
