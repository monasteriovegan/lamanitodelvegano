import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOpportunityPolicy } from '../src/lib/opportunities/policy.ts';

const base = {
  channel: 'instagram' as const,
  aiEnabled: true,
  sendMode: 'live' as const,
  channelEnabled: true,
  conversationEnabled: true,
  humanTakeover: false,
  personal: false,
  paidOrder: false,
  dismissed: false,
  optedOut: false,
  followupCount: 0,
  lastBusinessMessageAt: '2026-09-05T09:00:00.000Z',
  lastFollowupAt: null,
  now: '2026-09-05T12:00:00.000Z',
};

test('opportunity policy recommends while Remy is off but never auto sends', () => {
  const result = evaluateOpportunityPolicy({ ...base, aiEnabled: false });
  assert.equal(result.recommend, true);
  assert.equal(result.automaticSend, false);
});

test('opportunity policy blocks WhatsApp read-only automation', () => {
  const result = evaluateOpportunityPolicy({ ...base, channel: 'whatsapp', sendMode: 'read_only' });
  assert.equal(result.automaticSend, false);
});

test('opportunity policy suppresses unsafe opportunities', () => {
  assert.equal(evaluateOpportunityPolicy({ ...base, humanTakeover: true }).recommend, false);
  assert.equal(evaluateOpportunityPolicy({ ...base, personal: true }).recommend, false);
  assert.equal(evaluateOpportunityPolicy({ ...base, paidOrder: true }).recommend, false);
  assert.equal(evaluateOpportunityPolicy({ ...base, optedOut: true }).recommend, false);
  assert.equal(evaluateOpportunityPolicy({ ...base, followupCount: 2 }).automaticSend, false);
});

test('opportunity policy schedules second follow-up for next day', () => {
  const result = evaluateOpportunityPolicy({ ...base, followupCount: 1, lastFollowupAt: '2026-09-05T10:00:00.000Z' });
  assert.match(String(result.nextFollowupAt), /^2026-09-06T10:00:00/);
});
