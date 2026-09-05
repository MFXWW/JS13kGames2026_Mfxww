// roadroller 封装：与游戏构建一致的用法（默认参数/可配 -O 级别）。
// roadroller 未随本实验安装，按游戏构建约定定位到用户级安装。
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

function findRoadrollerEntry() {
  // 1) 本实验若已本地安装（npm i roadroller）
  try {
    return require.resolve('roadroller/index.mjs');
  } catch { /* ignore */ }
  // 2) 用户级 npm 全局目录（Windows: C:\Users\<user>\node_modules）
  try {
    const userGlobal = path.join(os.homedir(), 'node_modules', 'roadroller', 'index.mjs');
    require.resolve(userGlobal);
    return userGlobal;
  } catch { /* ignore */ }
  return null;
}

export async function loadRoadroller() {
  const entry = findRoadrollerEntry();
  if (!entry) {
    throw new Error('找不到 roadroller。请先 `npm i roadroller`（本地）或确认用户级 node_modules 已装 roadroller。');
  }
  return import(pathToFileURL(entry).href);
}

// 用 roadroller 压缩一段"文本"，返回 {firstLine, secondLine, code}。
// type: 'text' 走纯文本模型；本实验目标就是给 text 输入做 CSS 前置处理。
export async function rrPackText(text, { optimizeLevel = 0 } = {}) {
  const { Packer } = await loadRoadroller();
  const packer = new Packer([{ data: text, type: 'text', action: 'eval' }], {});
  if (optimizeLevel > 0) {
    await packer.optimize(optimizeLevel);
  }
  const { firstLine, secondLine } = packer.makeDecoder();
  return { firstLine, secondLine, code: firstLine + secondLine };
}

// 等价于 game 构建里 zopfli 之后 zip 内对 rolled.js 的处理：
// roadroller 产物会被 DEFLATE 再压。这里用 zlib level9 近似最终 zip 体积。
import { deflateSync } from 'node:zlib';
export function zipSize(code) {
  return deflateSync(Buffer.from(code, 'utf8'), { level: 9 }).length;
}
