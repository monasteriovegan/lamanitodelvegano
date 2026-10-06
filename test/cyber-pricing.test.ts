import assert from 'node:assert/strict';
import test from 'node:test';
import { applyCyberPricing, cyberIsActive, CYBER_DELIVERY_DATE } from '../src/lib/catalog/cyber-pricing.ts';
import { mapCatalogProductRow } from '../src/lib/catalog/catalog-repository.ts';
import { resolveCatalogCheckoutItem } from '../src/lib/catalog/catalog-checkout.ts';
const now = new Date('2026-10-06T12:00:00Z');
const master = mapCatalogProductRow('b1', { id: 'p1', business_unit_id: 'b1', nombre: 'Producto', slug: 'producto', precio: 11900, activo: true, gramaje: 'Pack:11900' })!;
const campaign = { startsAt: '2026-10-05T00:00:00-03:00', endsAt: '2026-10-10T23:59:59-03:00', overrides: [] };
test('rest of catalog receives exactly 25% with integer CLP, original price and fixed delivery', () => {
  const effective = applyCyberPricing(master, campaign, now);
  assert.equal(effective.variants[0].price, 8925);
  assert.equal(effective.variants[0].compareAtPrice, 11900);
  assert.deepEqual(effective.availabilityDates, [CYBER_DELIVERY_DATE]);
  assert.equal(master.variants[0].price, 11900);
  const checkout = resolveCatalogCheckoutItem(effective, { productoId: 'p1', variantId: effective.variants[0].id, qty: 2, clientPrice: 1 });
  assert.equal(checkout.ok && checkout.item.precio * checkout.item.qty, 17850);
});
test('flyer offers take precedence over 25% without stacking', () => {
  const effective = applyCyberPricing(master, { ...campaign, overrides: [{ variantId: master.variants[0].id, priceOverride: 9900, compareAtPriceOverride: 11900, isActive: true }] }, now);
  assert.equal(effective.variants[0].price, 9900);
  assert.equal(effective.variants[0].compareAtPrice, 11900);
});
test('absent, inactive or expired campaign leaves the master unchanged', () => {
  assert.deepEqual(applyCyberPricing(master, null, now), master);
  assert.deepEqual(applyCyberPricing(master, campaign, new Date('2026-10-11T03:00:00Z')), master);
  assert.equal(cyberIsActive(campaign, new Date('2026-10-04T23:59:59-03:00')), false);
  assert.equal(cyberIsActive(campaign, new Date('2026-10-10T23:59:59-03:00')), true);
});
test('only live overrides suppress the general discount', () => {
  const effective = applyCyberPricing(master, { ...campaign, overrides: [{ variantId: master.variants[0].id, priceOverride: 9900, compareAtPriceOverride: 11900, isActive: false }] }, now);
  assert.equal(effective.variants[0].price, 8925);
});
test('25% also applies to optional surcharges on non-flyer products', () => {
  const product = { ...master, optionGroups: [{ id:'g', productId:'p1', code:'extra', name:'Extra', selectionMode:'single' as const, required:false,active:true,sortOrder:10,values:[{id:'extra',optionGroupId:'g',code:'extra',label:'Extra',priceDelta:400,active:true,sortOrder:10}] }] };
  const effective = applyCyberPricing(product,campaign,now);
  assert.equal(effective.optionGroups[0].values[0].priceDelta,300);
});
