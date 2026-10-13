// PWA アイコンを依存なしで生成する（背景 #0B1026 + "T" 風の図形）。
// 使い方: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const BG = [0x0b, 0x10, 0x26];
const FG = [0xf8, 0xfa, 0xfc];
const ACCENT = [0xfa, 0xcc, 0x15];

function render(size) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  const u = size / 16; // グリッド単位
  const inRect = (x, y, x0, y0, x1, y1) => x >= x0 * u && x < x1 * u && y >= y0 * u && y < y1 * u;
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let c = BG;
      // "T"（マスカブル対応で中央 60% に収める）
      if (inRect(x, y, 4, 4, 12, 6) || inRect(x, y, 7, 6, 9, 12)) c = FG;
      // 右下に星（アクセント）
      if (inRect(x, y, 10.5, 10.5, 12.5, 12.5)) c = ACCENT;
      const o = y * stride + 1 + x * 3;
      raw[o] = c[0];
      raw[o + 1] = c[1];
      raw[o + 2] = c[2];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, render(size));
  console.log(`wrote public/icons/icon-${size}.png`);
}
