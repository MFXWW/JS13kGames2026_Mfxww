// 压缩管线组装：CSS 前置处理（词法化 + 可选 token 缩写）→ roadroller(text) 打包。
// 目标是验证"CSS 专用词法层能否让 roadroller 核心(text 模型)对 CSS 更有效"。
//
// 组合三种处理强度，便于对照：
//  A. raw          —— 什么都不做
//  B. min          —— 仅词法化压缩（空白折叠/去注释，安全子集）
//  C. min+abbr     —— 词法化 + 高频 token 缩写（缩写表随载荷携带）
//
// 输出统一为 roadroller 打包（内含被 DEFLATE 后的最终体积近似 zipSize）。

import { tokenize, normalize } from './css-tokenizer.js';
import { chooseAbbr, applyAbbr, encodeTable } from './abbrev.js';
import { rrPackText, zipSize } from './roadroller.js';

// 词法化压缩（安全子集）：折叠空白 + 去注释。
// 说明：本版保守——不在选择器/值内部做有风险的空格剔除（如 `div p`、`1px solid`），
// 只把 token 之间多余空白折叠为 1 个空格并去掉注释。更深层空格剔除属后续优化。
export function minifyCssLexically(css) {
  return normalize(css);
}

// 组装各强度载荷文本（roadroller 之前的字符串）。
export function preparePayload(css, { abbr = true, min = true } = {}) {
  const stage1 = min ? minifyCssLexically(css) : css;
  if (!abbr) return { payload: stage1, meta: { min, abbr: false, table: '' } };
  const { identToChar, charToIdent } = chooseAbbr(stage1);
  const abbrText = applyAbbr(stage1, identToChar);
  const table = encodeTable(charToIdent);
  // 缩写表随载荷携带（解码端需要它还原）
  const payload = table + '\n' + abbrText;
  return { payload, meta: { min, abbr: true, table, numAbbr: identToChar.size } };
}

export async function measurePipeline(css, { abbr = true, min = true, optimizeLevel = 0 } = {}) {
  const { payload, meta } = preparePayload(css, { abbr, min });
  const start = Date.now();
  const { code } = await rrPackText(payload, { optimizeLevel });
  const finalSize = zipSize(code);
  return {
    meta,
    payloadBytes: Buffer.byteLength(payload, 'utf8'),
    rrCodeBytes: Buffer.byteLength(code, 'utf8'),
    finalZipEstimate: finalSize,
    elapsedMs: Date.now() - start,
  };
}

// 一趟批量测多个 css（并行太占内存，roadroller 每趟 ~几百 MB，这里串行）
export async function measureAll(css, { optimizeLevel = 0 } = {}) {
  const out = {};
  out.raw = await measurePipeline(css, { min: false, abbr: false, optimizeLevel });
  out.min = await measurePipeline(css, { min: true, abbr: false, optimizeLevel });
  out.minAbbr = await measurePipeline(css, { min: true, abbr: true, optimizeLevel });
  return out;
}

export { tokenize };
