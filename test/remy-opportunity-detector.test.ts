import test from 'node:test';
import assert from 'node:assert/strict';
import { detectOpportunity } from '../src/lib/opportunities/detector.ts';

const now = '2026-09-05T12:00:00.000Z';
const earlier = '2026-09-05T09:00:00.000Z';
const base = {
  channel: 'instagram' as const,
  hasUnpaidOrder: false,
  hasPaidOrder: false,
  hasCart: false,
  cartSubtotal: 0,
  askedPrice: false,
  askedShipping: false,
  productMentioned: false,
  optedOut: false,
  rejected: false,
  humanTakeover: false,
  personal: false,
  adSource: false,
  lastBusinessMessageAt: now,
  lastCustomerMessageAt: earlier,
};

test('opportunity detector prioritizes unpaid orders and carts', () => {
  assert.equal(detectOpportunity({ ...base, hasUnpaidOrder: true, productMentioned: true })?.stage, 'payment_pending');
  assert.equal(detectOpportunity({ ...base, hasCart: true, cartSubtotal: 23900 })?.stage, 'cart_abandoned');
});

test('opportunity detector scores strong commercial questions high', () => {
  const result = detectOpportunity({ ...base, askedPrice: true, askedShipping: true, productMentioned: true });
  assert.equal(result?.stage, 'shipping_or_price_question');
  assert.equal(result?.priority, 'high');
});

test('opportunity detector excludes paid, opt-out, personal and human takeover', () => {
  assert.equal(detectOpportunity({ ...base, optedOut: true }), null);
  assert.equal(detectOpportunity({ ...base, hasPaidOrder: true }), null);
  assert.equal(detectOpportunity({ ...base, personal: true }), null);
  assert.equal(detectOpportunity({ ...base, humanTakeover: true }), null);
});

test('opportunity detector preserves only explicit ad signal', () => {
  assert.equal(detectOpportunity({ ...base, productMentioned: true, adSource: false })?.sourceType, 'unknown');
  assert.equal(detectOpportunity({ ...base, productMentioned: true, adSource: true })?.sourceType, 'ad');
});
