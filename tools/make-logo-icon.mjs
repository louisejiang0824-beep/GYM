import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const sharp = require('C:\\Users\\Administrator\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\sharp');

const source = fileURLToPath(new URL('../app-icon.png', import.meta.url));
await sharp(source).resize(180, 180).png().toFile(fileURLToPath(new URL('../apple-touch-icon.png', import.meta.url)));
const png = await sharp(source).resize(256, 256).png().toBuffer();
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // icon type
header.writeUInt16LE(1, 4); // image count
const entry = Buffer.alloc(16);
entry.writeUInt8(0, 0); // 256px is represented by 0
entry.writeUInt8(0, 1);
entry.writeUInt8(0, 2); // color count
entry.writeUInt8(0, 3);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(22, 12);
fs.writeFileSync(new URL('../logo.ico', import.meta.url), Buffer.concat([header, entry, png]));
