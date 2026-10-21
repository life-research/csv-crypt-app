// Renames the single-file build output and writes its SHA-256 checksum.
import {createHash} from 'node:crypto';
import {readFileSync, renameSync, writeFileSync} from 'node:fs';

const dir = 'build-single';
const target = `${dir}/csv-crypt.html`;
renameSync(`${dir}/index.html`, target);
const hash = createHash('sha256').update(readFileSync(target)).digest('hex');
writeFileSync(`${target}.sha256`, `${hash}  csv-crypt.html\n`);
console.log(`${target}\nSHA-256: ${hash}`);
