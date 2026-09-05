// CSS 专用词法分析器 —— 目标是"严格可逆 token 化"，供 token 缩写与安全压缩使用。
//
// 设计要点（为什么不是通用正则）：
//  - 必须能识别字符串 / 注释 / url(...) / 数字单位，绝不改写"用户数据"里的字面量。
//  - 输出 token 流按序拼接必须 == 原始输入（严格可逆），还原端只需逆操作。
//  - 为缩写服务：把"可作为独立标识符整体替换"的 token 类型标记出来。
//
// 本实现按 CSS Syntax Level 3 的 token 概念简化：不追求 100% 规范，只保证
//  1) tokenize→detokenize 恒等；2) 真实项目 CSS（含字符串/url/注释/变量）不误拆。

export const T_WS = 1;        // 空白（含换行）
export const T_COMMENT = 2;   // /* ... */
export const T_STRING = 3;    // '...' / "..."
export const T_URL = 4;       // url( ... ) 整体
export const T_IDENT = 5;     // 标识符 / 关键字 / 选择器名 / 属性名 / 值名 / 自定义属性名
export const T_FUNCTION = 6;  // 函数名（如 rgba，不含括号）——可独立缩写
export const T_HASH = 7;      // #xxx（id 选择器 / hex 色，含 #）
export const T_ATKEYWORD = 8; // @media 等（含 @）
export const T_NUMBER = 9;    // 纯数字
export const T_DIMENSION = 10;// 数字+单位（如 10px / .5s）——整体不缩写
export const T_PUNCT = 11;    // 其余符号

const isWs = c => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const isDigit = c => c >= '0' && c <= '9';
const isIdentStart = c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
const isNmChar = c => isIdentStart(c) || isDigit(c) || c === '-';

export function tokenize(css) {
  const tokens = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    const ch = css[i];

    // --- 空白 ---
    if (isWs(ch)) {
      let j = i + 1;
      while (j < n && isWs(css[j])) j++;
      tokens.push({ type: T_WS, raw: css.slice(i, j) });
      i = j;
      continue;
    }

    // --- 注释 ---
    if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const j = end < 0 ? n : end + 2;
      tokens.push({ type: T_COMMENT, raw: css.slice(i, j) });
      i = j;
      continue;
    }

    // --- 字符串（单/双引号，可含转义） ---
    if (ch === '"' || ch === "'") {
      const q = ch;
      let j = i + 1;
      let closed = false;
      while (j < n) {
        if (css[j] === '\\') { j += 2; continue; }
        if (css[j] === q) { j++; closed = true; break; }
        j++;
      }
      if (!closed) j = n;
      tokens.push({ type: T_STRING, raw: css.slice(i, j) });
      i = j;
      continue;
    }

    // --- url(...)（含引号/无引号/带空白，仅当整段以 ) 收尾） ---
    if ((ch === 'u' || ch === 'U') && /^url\(/i.test(css.slice(i, i + 4))) {
      let j = i + 4;
      while (j < n && isWs(css[j])) j++;
      let quote = null;
      let depth = 0;
      let k = j;
      for (; k < n; k++) {
        const c = css[k];
        if (quote) {
          if (c === '\\') { k++; continue; }
          if (c === quote) quote = null;
          continue;
        }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === '(') depth++;
        else if (c === ')') {
          if (depth === 0) break;
          depth--;
        }
      }
      const end = k < n ? k + 1 : n;
      if (css[end - 1] === ')') {
        tokens.push({ type: T_URL, raw: css.slice(i, end) });
        i = end;
        continue;
      }
      // 不是合法 url，落到 ident 逻辑
    }

    // --- 数字 / 数字+单位 ---
    if (isDigit(ch) || (ch === '.' && isDigit(css[i + 1])) ||
        ((ch === '+' || ch === '-') && (isDigit(css[i + 1]) || (css[i + 1] === '.' && isDigit(css[i + 2]))))) {
      const m = /^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/.exec(css.slice(i));
      if (m) {
        const j = i + m[0].length;
        const unit = /^[a-zA-Z]+/.exec(css.slice(j));
        if (unit) {
          // 数字+字母单位 => dimension；% 单独留在 number 后（不吞 %）
          tokens.push({ type: T_DIMENSION, raw: css.slice(i, j + unit[0].length) });
          i = j + unit[0].length;
        } else {
          tokens.push({ type: T_NUMBER, raw: css.slice(i, j) });
          i = j;
        }
        continue;
      }
    }

    // --- ident / 函数名 / 自定义属性 / vendor 前缀 ---
    if (isNmStartAt(css, i)) {
      let j = i + 1;
      while (j < n && isNmChar(css[j])) j++;
      const raw = css.slice(i, j);
      // 紧跟 ( 且不在伪类 : 之后 => 函数名；伪类(:not 等)保守当 ident
      const prevIsColon = i > 0 && css[i - 1] === ':';
      if (!prevIsColon && css[j] === '(') {
        tokens.push({ type: T_FUNCTION, raw });
      } else {
        tokens.push({ type: T_IDENT, raw });
      }
      i = j;
      continue;
    }

    // --- #hash ---
    if (ch === '#') {
      let j = i + 1;
      if (isNmChar(css[j])) {
        while (j < n && isNmChar(css[j])) j++;
        tokens.push({ type: T_HASH, raw: css.slice(i, j) });
        i = j;
        continue;
      }
    }

    // --- @keyword ---
    if (ch === '@') {
      let j = i + 1;
      if (isNmChar(css[j])) {
        while (j < n && isNmChar(css[j])) j++;
        tokens.push({ type: T_ATKEYWORD, raw: css.slice(i, j) });
        i = j;
        continue;
      }
    }

    // --- punct（聚合连续符号；遇到会被上面分支吃掉的起始字符即停） ---
    let j = i + 1;
    while (j < n) {
      const c = css[j];
      const stop =
        isWs(c) || isDigit(c) || isNmStartAt(css, j) || c === '"' || c === "'" ||
        (c === '/' && css[j + 1] === '*') ||
        (c === '.' && isDigit(css[j + 1])) ||
        ((c === '+' || c === '-') && (isDigit(css[j + 1]) || (css[j + 1] === '.' && isDigit(css[j + 2])))) ||
        (c === '#' && isNmChar(css[j + 1])) ||
        (c === '@' && isNmChar(css[j + 1]));
      if (stop) break;
      j++;
    }
    tokens.push({ type: T_PUNCT, raw: css.slice(i, j) });
    i = j;
  }
  return tokens;
}

// ident 起始判定：字母/_/\\；'--'；或 '-' 后接字母/_
function isNmStartAt(css, i) {
  const c = css[i];
  if (isIdentStart(c)) return true;
  if (c === '-') {
    const nxt = css[i + 1];
    if (nxt === '-') return true; // 自定义属性 --x
    return isIdentStart(nxt);
  }
  return false;
}

export function detokenize(tokens) {
  return tokens.map(t => t.raw).join('');
}

// 词法级压缩（安全子集）：折叠空白为单空格、去注释。
// 语义安全依据：空白在 token 之间折叠不会改变 CSS 语义，
// 因为 token 边界由非空白字符决定（字符串/url 内部不会受影响）。
export function normalize(css) {
  const toks = tokenize(css);
  const out = [];
  for (const t of toks) {
    if (t.type === T_WS || t.type === T_COMMENT) continue;
    if (out.length > 0 && needsSpaceAfter(out[out.length - 1], t)) out.push(' ');
    out.push(t.raw);
  }
  return out.join('').trim();
}

// 判断两个相邻 token 间是否必须保留一个空格以防语义合并。
// CSS 中只有"两个可直接拼接的 name-like/数字 token"之间才需要空白分隔，
// 例如 `1px solid` 的 `px` 与 `solid`、或两个 ident（选择器 `div p`）。
function needsSpaceAfter(prevRaw, curTok) {
  const prev = prevRaw[prevRaw.length - 1];
  const cur = curTok.raw[0];
  // 前一 token 末字符与后一 token 首字符都可能成为同一 name/数字的一部分 => 需空格
  const nameLike = c => /[a-zA-Z0-9_-]/.test(c);
  const needs = nameLike(prev) && nameLike(cur);
  // 但 `--` 与 `:` 等场景另算；保守起见只要两头都是 name-like 就留一个空格
  return needs;
}

// 可被"整体缩写"的 token：缩写只在 ident/函数名发生，
// 字符串/url/数字/注释等字面量一律不动，保证还原可逆且不改语义。
export function isAbbreviatable(type) {
  return type === T_IDENT || type === T_FUNCTION;
}
