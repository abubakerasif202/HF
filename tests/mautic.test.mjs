import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
test('Mautic server integration mocked network suite', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--experimental-strip-types', '--test', 'tests/fixtures/mautic.mjs'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
test('Mautic privileged modules have server-only boundaries and no public secrets', async () => {
  for (const name of ['client', 'mapper', 'sync-contact']) {
    const source = await readFile(`lib/integrations/mautic/${name}.ts`, 'utf8');
    assert.match(source, /import "server-only"/);
    assert.doesNotMatch(source, /NEXT_PUBLIC_/);
  }
  const env = await readFile('.env.example', 'utf8');
  assert.doesNotMatch(env, /NEXT_PUBLIC_MAUTIC/);
});
