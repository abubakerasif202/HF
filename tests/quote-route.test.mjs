import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
test('quote route mocked backend integration tests', () => {
 const result = spawnSync(process.execPath, ['--conditions=react-server', '--experimental-strip-types', '--experimental-test-module-mocks', '--test', 'tests/fixtures/quote-route.mjs', 'tests/fixtures/quote-server.mjs', 'tests/fixtures/quote-resend-sdk.mjs'], { encoding: 'utf8' });
 assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('quote notification privileges remain server-only and absent from browser bundles', async () => {
 const { readFile, readdir } = await import('node:fs/promises');
 const source = await readFile('lib/server/quote-notifications.ts', 'utf8');
 assert.match(source, /import "server-only"/); assert.doesNotMatch(source, /NEXT_PUBLIC_/);
 const files = await readdir('.next/static', { recursive: true });
 for (const name of files.filter((name) => name.endsWith('.js'))) {
  const script = await readFile(`.next/static/${name}`, 'utf8');
  assert.doesNotMatch(script, /RESEND_API_KEY|MAUTIC_USERNAME|MAUTIC_PASSWORD|SUPABASE_SERVICE_ROLE_KEY/, name);
 }
});
