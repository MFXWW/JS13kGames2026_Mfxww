// 往返校验：tokenize 可逆性 + 缩写→还原恒等。
// 用法：npm run verify
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize, detokenize, normalize } from '../src/css-tokenizer.js';
import { chooseAbbr, applyAbbr, restoreAbbr, encodeTable, decodeTable } from '../src/abbrev.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesDir = path.resolve(here, '..', 'samples');

const names = readdirSync(samplesDir).filter(f => f.endsWith('.css')).sort();
let fail = 0;

for (const name of names) {
  const css = readFileSync(path.join(samplesDir, name), 'utf8');

  // 1) tokenize -> detokenize 必须恒等
  const toks = tokenize(css);
  const rt = detokenize(toks);
  const tokOk = rt === css;

  // 2) normalize 是"幂等 + 语义安全子集"：这里只校验再次 normalize 不变
  const min = normalize(css);
  const minOk = normalize(min) === min;

  // 3) 缩写 -> 还原 恒等（在 min 后的文本上做，与管线一致）
  const { identToChar, charToIdent } = chooseAbbr(min);
  const abbrText = applyAbbr(min, identToChar);
  const table = encodeTable(charToIdent);
  const restored = restoreAbbr(abbrText, decodeTable(table));
  const abbrOk = restored === min;

  const label = tokOk && minOk && abbrOk ? 'ok ' : 'FAIL';
  if (!tokOk || !minOk || !abbrOk) fail++;
  console.log(
    `${label} ${name}: tokenize可逆=${tokOk} normalize幂等=${minOk} abbr还原恒等=${abbrOk}` +
    ` (abbr ${identToChar.size}个, 缩后 ${Buffer.byteLength(abbrText, 'utf8')}B)`
  );
}

console.log(fail === 0 ? '\n全部通过' : `\n${fail} 个样本失败`);
process.exit(fail === 0 ? 0 : 1);
