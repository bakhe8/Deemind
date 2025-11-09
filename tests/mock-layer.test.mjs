import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMockContext } from '../tools/mock-layer/mock-data-builder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

async function main() {
  const context = await buildMockContext('electronics');
  assert.ok(context, 'Context payload missing');
  assert.equal(context.meta?.demo, 'electronics', 'Context demo mismatch');
  assert.ok(
    context.store?.name,
    'Store name missing in mock context. Run npm run mock:data if configs changed.',
  );
  assert.ok(
    Array.isArray(context.products) && context.products.length >= 3,
    'Products array missing or too small',
  );
  assert.ok(
    Array.isArray(context.categories) && context.categories.length >= 1,
    'Categories missing from context',
  );
  assert.ok(
    Array.isArray(context.navigation),
    'Navigation array missing (expected from mock store composition)',
  );
  console.log('✅ mock-layer test passed:', path.relative(root, __dirname));
}

main().catch((err) => {
  console.error('❌ mock-layer test failed:', err);
  process.exit(1);
});
