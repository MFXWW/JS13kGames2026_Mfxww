// Token 频率统计 + 高频 token 缩写（roadroller JS 模式"标识符缩写"思路在 CSS 上的移植）。
//
// 缩写方案（与 roadroller prepareJs 同哲学，但为可逆做减法）：
//  - 只缩写 isAbbreviatable 的 token（ident/函数名，长度 >= 2），且保证：
//    * 每个缩写字符是原文本中【绝不出现】的单字节可打印 ASCII；
//    * 缩写是 token 级整词替换，绝不触碰字符串/url 内部；
//    * 还原表随内容走（后续接入解码器时与压缩流一起携带）。
//  - 缩写字符若在原文相邻 token 处可能造成歧义（如两个缩写相邻、或缩写与数字相邻
//    可能被 CSS 语义合并），本模块做保守校验：首选"前后都是分隔符/空白"的字符位。
//    实际 CSS 里 ident 之间必有空白或标点，所以缩写后仍可安全还原（token 流不变）。

import { tokenize, isAbbreviatable } from './css-tokenizer.js';

// 可用的缩写字符池：可打印 ASCII 中，排除会在原文出现的、以及会破坏还原/嵌入的。
// 排除规则：
//  - 原文本已出现的字符
//  - 空白、引号(会与外层包裹冲突)、反斜杠、回车换行、DEL
function buildCharPool(usedChars) {
  const excluded = new Set([' ', '\t', '\n', '\r', '\f', '"', "'", '`', '\\', '\x7f']);
  const pool = [];
  for (let c = 0x21; c <= 0x7e; c++) {
    const ch = String.fromCharCode(c);
    if (usedChars.has(ch) || excluded.has(ch)) continue;
    pool.push(ch);
  }
  return pool;
}

// 统计可缩写 token 频率，返回 Map<token, 次数>
export function collectFreq(css) {
  const freq = new Map();
  for (const t of tokenize(css)) {
    if (!isAbbreviatable(t.type)) continue;
    if (t.raw.length < 2) continue; // 单字符缩写无收益
    freq.set(t.raw, (freq.get(t.raw) || 0) + 1);
  }
  return freq;
}

// 选择缩写方案：按"节省量"排序取前 K 个。
// 节省量启发：与 roadroller 相同，(len-1)*freq 越大越值得缩（长度计为节省原始字节数的近似）。
// return { identToChar: Map, charToIdent: Map }
export function chooseAbbr(css, { maxAbbr = 64 } = {}) {
  const freq = collectFreq(css);
  const usedChars = new Set(css);
  const pool = buildCharPool(usedChars);

  const scored = [...freq.entries()]
    .map(([tok, f]) => [tok, (tok.length - 1) * f])
    .filter(([, s]) => s > 0)
    .sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const identToChar = new Map();
  const charToIdent = new Map();
  const k = Math.min(maxAbbr, scored.length, pool.length);
  for (let i = 0; i < k; i++) {
    const [tok] = scored[i];
    const ch = pool[i];
    identToChar.set(tok, ch);
    charToIdent.set(ch, tok);
  }
  return { identToChar, charToIdent };
}

// 应用缩写：重跑 tokenize，仅替换可缩写 token。
// 由于 token 流严格可逆，缩写后文本经 detokenize 即得；还原只需把单字符换回原词。
export function applyAbbr(css, identToChar) {
  const tokens = tokenize(css);
  const out = [];
  for (const t of tokens) {
    if (isAbbreviatable(t.type)) {
      const abbr = identToChar.get(t.raw);
      if (abbr) { out.push(abbr); continue; }
    }
    out.push(t.raw);
  }
  return out.join('');
}

// 还原：把每个缩写字符替换回原 token（token 流不变，故逐字符替换即安全）。
// 注意：输入必须是"经过 applyAbbr 且未再被 token 化改写"的文本。
export function restoreAbbr(text, charToIdent) {
  let out = '';
  for (const ch of text) {
    const ident = charToIdent.get(ch);
    out += ident !== undefined ? ident : ch;
  }
  return out;
}

// 生成随内容携带的还原表文本（未来解码端据此还原）。
// 格式：每行 "字符 原token"，字符与 token 间单个空格。
// 为了可逆解析，token 内不可能含空格（ident 无空格），可安全 split。
export function encodeTable(charToIdent) {
  const rows = [...charToIdent.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return rows.map(([ch, tok]) => `${ch} ${tok}`).join('\n');
}

export function decodeTable(text) {
  const charToIdent = new Map();
  for (const line of text.split('\n')) {
    const sp = line.indexOf(' ');
    if (sp <= 0) continue;
    charToIdent.set(line[0], line.slice(sp + 1));
  }
  return charToIdent;
}
