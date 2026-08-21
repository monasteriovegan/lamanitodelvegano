import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('checkout v2 verificado queda habilitado por defecto y conserva kill switch explícito', () => {
  const source = read('src/lib/repositories/schema-capabilities.ts');

  assert.match(source, /checkoutWrites:\s*reconciled\s*&&\s*source\.SUPABASE_CHECKOUT_SCHEMA_READY\s*!==\s*['"]false['"]/);
  assert.doesNotMatch(source, /checkoutWrites:\s*reconciled\s*&&\s*source\.SUPABASE_CHECKOUT_SCHEMA_READY\s*===\s*['"]true['"]/);
});
