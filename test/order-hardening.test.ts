import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('venta conversacional solo marca transferencia pagada cuando hay evidencia de pago', () => {
  const source = read('src/lib/orders/conversation-sale.ts');

  assert.match(
    source,
    /const\s+transferPaid\s*=\s*draft\.paymentMethod\s*===\s*['"]transfer['"]\s*&&\s*draft\.paymentEvidence\s*;/,
    'paymentEvidence debe participar en la decisión de marcar una transferencia como pagada',
  );
  assert.match(source, /payment_status:\s*transferPaid\s*\?\s*['"]paid['"]\s*:\s*['"]pending['"]/);
  assert.match(source, /\.\.\.\(transferPaid\s*\?\s*\[['"]pagado['"]\]\s*:\s*\[\]\)/);
});

test('webhook de Mercado Pago reconcilia un estado legado Pagado cuando el pago verificado sigue pendiente o fallido', () => {
  const source = read('src/app/api/pagos/mercadopago-webhook/route.ts');

  assert.match(
    source,
    /const\s+stalePaidLegacyState\s*=\s*effectiveStatus\s*!==\s*['"]paid['"]\s*&&\s*String\(pedido\.estado\s*\|\|\s*['"]['"]\)\s*===\s*['"]Pagado['"]\s*;/,
    'el webhook debe detectar Pagado + payment_status no pagado como estado legado incoherente',
  );
  assert.match(
    source,
    /if\s*\(effectiveStatus\s*!==\s*currentPaymentStatus\s*\|\|\s*stalePaidLegacyState\)/,
    'la reconciliación debe ejecutarse aunque payment_status no cambie',
  );
  assert.match(
    source,
    /estado:\s*effectiveStatus\s*===\s*['"]paid['"]\s*\?\s*['"]Pagado['"]\s*:\s*stalePaidLegacyState\s*\?\s*['"]Pendiente['"]\s*:/,
    'solo el estado legado Pagado debe volver a Pendiente; otros estados operativos no se degradan',
  );
});

test('admin no convierte confirmed o processing pendiente de pago en Pagado', () => {
  const source = read('src/app/api/admin/orders/[id]/route.ts');

  assert.match(source, /requestedPaymentStatus\s*!==\s*['"]paid['"]/);
  assert.match(source, /requestedStatus\s*===\s*['"]confirmed['"]\s*\?\s*['"]Confirmado['"]\s*:\s*['"]Procesando['"]/);
});
