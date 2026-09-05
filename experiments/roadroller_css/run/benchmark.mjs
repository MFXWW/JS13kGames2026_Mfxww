// 基准：对每个 CSS 样本对比多条管线（体积 = roadroller 产物再经 DEFLATE 的估算 zip 占用）。
// 参照：deflate9 —— 游戏最终 zip 直接压缩 CSS 的近似（roadroller 的假想敌）。
// 管线：
//   raw        原样喂 roadroller(text)
//   min        词法化压缩（折叠空白/去注释）。零额外成本，真实可用。
//   abbr*      高频 token 缩写（缩略语表需随载荷携带才能还原）
//     content-only = 只算缩写后内容的 rr+zip（表免费 = 模型侧收益上限）
//     net          = 表 + 缩写内容一起喂 rr（真实净收益；当前明文表成本偏高）
// 用法：npm run bench
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { normalize } from '../src/css-tokenizer.js';
import { chooseAbbr, applyAbbr, encodeTable } from '../src/abbrev.js';
import { rrPackText, zipSize } from '../src/roadroller.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(here, '..', 'samples');
const names = readdirSync(samplesDir).filter(f => f.endsWith('.css')).sort();
if (names.length === 0) { console.error('samples/ 为空，请先 npm run samples'); process.exit(1); }

const d9 = s => deflateSync(Buffer.from(s, 'utf8'), { level: 9 }).length;
const signed = n => (n >= 0 ? '+' : '') + n;
const charToIdent = m => new Map([...m].map(([k, v]) => [v, k]));

const rows = [];
for (const name of names) {
  const css = readFileSync(path.join(samplesDir, name), 'utf8');
  const min = normalize(css);
  const { identToChar } = chooseAbbr(min);
  const abbrText = applyAbbr(min, identToChar);
  const table = encodeTable(charToIdent(identToChar));

  const zRaw = zipSize((await rrPackText(css)).code);
  const zMin = zipSize((await rrPackText(min)).code);
  const zAbbrOnly = zipSize((await rrPackText(abbrText)).code);
  const zAbbrNet = zipSize((await rrPackText(table + '\n' + abbrText)).code);

  rows.push({ name, raw: Buffer.byteLength(css, 'utf8'), min: Buffer.byteLength(min, 'utf8'),
    num: identToChar.size, table: Buffer.byteLength(table, 'utf8'),
    zRaw, zMin, zAbbrOnly, zAbbrNet,
    d9raw: d9(css), d9min: d9(min) });

  console.log(`=== ${name} ===`);
  console.log(`  raw ${Buffer.byteLength(css, 'utf8')}B  deflate9=${d9(css)}B  rr+zip=${zRaw}B`);
  console.log(`  min ${Buffer.byteLength(min, 'utf8')}B  deflate9=${d9(min)}B  rr+zip=${zMin}B   (rr+zip ${signed(zMin - zRaw)}B)`);
  console.log(`  abbr(${identToChar.size}) content-only rr+zip=${zAbbrOnly}B  (相对 min ${signed(zAbbrOnly - zMin)}B)`);
  console.log(`  abbr net (明文表 ${Buffer.byteLength(table, 'utf8')}B) rr+zip=${zAbbrNet}B  (相对 min ${signed(zAbbrNet - zMin)}B)`);
  console.log('');
}
console.log('缩略语表必须随载荷携带才能还原；content-only 列=表免费时的模型侧收益上限（见 README 结论）。');
