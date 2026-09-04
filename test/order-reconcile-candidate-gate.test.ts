import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('reconciler gates AI extraction behind strong commercial signals', () => {
  const source = read('src/lib/orders/reconcile-pending-sales.ts');
  assert.match(source, /ocr_is_receipt/);
  assert.match(source, /paymentConfirmationPattern/);
  assert.match(source, /strongSignalConversationIds/);
  assert.match(source, /order_id', null/);
  assert.match(source, /pedido/);
  assert.match(source, /pagado/);
});

test('cron keeps reconciliation batch deliberately small', () => {
  const route = read('src/app/api/cron/reconcile-pending-sales/route.ts');
  assert.match(route, /limit:\s*10/);
});
