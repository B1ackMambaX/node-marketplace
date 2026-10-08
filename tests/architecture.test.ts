import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const sourceRoot = resolve(import.meta.dir, '../src');
const allowedLayers: Record<string, readonly string[]> = {
  domain: ['domain'],
  application: ['application', 'domain'],
  infrastructure: ['infrastructure', 'application', 'domain', 'generated'],
  presentation: ['presentation', 'application', 'domain'],
};

test('зависимости между слоями направлены внутрь, HTTP не обращается к инфраструктуре', () => {
  const violations: string[] = [];
  for (const name of readdirSync(sourceRoot, { recursive: true })) {
    if (typeof name !== 'string' || !name.endsWith('.ts')) continue;
    const layer = name.split(sep)[0];
    if (!layer || !allowedLayers[layer]) continue;
    const file = resolve(sourceRoot, name);
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(
      /\b(?:import|export)\s[\s\S]*?\bfrom\s*['"]([^'"]+)['"]/g,
    )) {
      const imported = match[1];
      if (!imported) continue;
      if (!imported.startsWith('.')) {
        if (layer === 'domain' || layer === 'application') violations.push(`${name} → ${imported}`);
        continue;
      }
      const target = relative(sourceRoot, resolve(file, '..', imported)).split(sep)[0];
      if (!target || !allowedLayers[layer]?.includes(target))
        violations.push(`${name} → ${imported}`);
    }
  }
  expect(violations).toEqual([]);
});
