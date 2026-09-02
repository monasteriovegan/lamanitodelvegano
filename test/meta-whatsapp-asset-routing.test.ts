import assert from 'node:assert/strict';
import test from 'node:test';

import { activeMetaAssetBusinessUnit } from '../src/lib/meta/asset-routing.ts';

test('connected WhatsApp phone resolves only its active business unit', () => {
  assert.equal(activeMetaAssetBusinessUnit({
    business_unit_id: 'tenant-la-manito',
    meta_connections: {
      business_unit_id: 'tenant-la-manito',
      status: 'active',
    },
  }), 'tenant-la-manito');
});

test('unknown WhatsApp phone cannot resolve a business unit', () => {
  assert.equal(activeMetaAssetBusinessUnit(null), null);
});

test('asset connected to another business unit cannot cross tenants', () => {
  assert.equal(activeMetaAssetBusinessUnit({
    business_unit_id: 'tenant-la-manito',
    meta_connections: {
      business_unit_id: 'tenant-other',
      status: 'active',
    },
  }), null);

  assert.equal(activeMetaAssetBusinessUnit({
    business_unit_id: 'tenant-la-manito',
    meta_connections: {
      business_unit_id: 'tenant-la-manito',
      status: 'disconnected',
    },
  }), null);
});
