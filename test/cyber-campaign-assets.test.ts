import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const campaignDirectory = resolve('public/campaigns/cyber-day-chocolatoso-2026');
const expectedNames = [
  'hero-duo-barras.webp',
  'brigadeiros-trufas.webp',
  'alfajores-canamo.webp',
  'protein-balls.webp',
  'box-chocolatosa.webp',
  'barras-configurables.webp',
  'bombones.webp',
];

test('all seven Cyber campaign assets exist as WebP', () => {
  assert.equal(existsSync(campaignDirectory), true, 'the Cyber campaign directory must exist');
  const files = readdirSync(campaignDirectory).filter((name) => name.endsWith('.webp')).sort();
  assert.equal(files.length, 7);
  assert.deepEqual(files, [...expectedNames].sort());

  for (const name of files) {
    const path = resolve(campaignDirectory, name);
    const header = readFileSync(path).subarray(0, 12);
    assert.equal(header.subarray(0, 4).toString('ascii'), 'RIFF', `${name} must have a RIFF header`);
    assert.equal(header.subarray(8, 12).toString('ascii'), 'WEBP', `${name} must be WebP`);
    assert.ok(statSync(path).size > 50_000, `${name} must not be an empty or placeholder image`);
  }
});

test('campaign asset names are unique', () => {
  assert.equal(new Set(expectedNames).size, expectedNames.length);
});
