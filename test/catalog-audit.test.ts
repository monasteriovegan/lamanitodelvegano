import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchMetaCatalogAudit } from '../src/lib/meta/catalog-audit.ts';

test('catalog audit handles network errors gracefully without crashing', async () => {
  const result = await fetchMetaCatalogAudit({
    catalogId: '1613918067034823',
    token: 'invalid_token_for_test',
  });
  assert.equal(result.ok, false);
  assert.equal(result.catalogId, '1613918067034823');
  assert.match(result.error || '', /meta_catalog_error|invalid/);
});
