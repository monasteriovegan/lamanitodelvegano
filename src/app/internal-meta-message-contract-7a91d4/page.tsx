export const dynamic = 'force-dynamic';

export default async function MetaMessageContractProbe() {
  const upstream = process.env.META_PROXY_UPSTREAM_URL;
  if (!upstream) return <pre>{JSON.stringify({ ok: false, error: 'missing_upstream' }, null, 2)}</pre>;

  const url = new URL('/api/meta/messages', upstream);
  const probes = [
    {},
    { channel: 'instagram' },
    { provider: 'instagram' },
    { channel: 'whatsapp' },
  ];
  const results = [];

  for (const probe of probes) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(probe),
      cache: 'no-store',
    });
    results.push({
      probe,
      status: response.status,
      body: await response.json().catch(async () => ({ text: await response.text().catch(() => '') })),
    });
  }

  return <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ ok: true, results }, null, 2)}</pre>;
}
