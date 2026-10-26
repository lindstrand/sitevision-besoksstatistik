import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const source = fs.readFileSync('src/index.js', 'utf8');
const expected = pkg.version;
const errors = [];

if (manifest.version !== expected) errors.push(`manifest.json=${manifest.version}, package.json=${expected}`);
if (lock.version !== expected) errors.push(`package-lock.json=${lock.version}, expected=${expected}`);
if (lock.packages && lock.packages[''] && lock.packages[''].version !== expected) {
  errors.push(`package-lock root=${lock.packages[''].version}, expected=${expected}`);
}
if (!source.includes(`const APP_VERSION = '${expected}';`)) {
  errors.push(`src/index.js saknar APP_VERSION ${expected}`);
}

if (errors.length) {
  console.error('VERSIONSKONTROLL MISSLYCKADES');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`Versionskontroll OK: ${expected}`);
