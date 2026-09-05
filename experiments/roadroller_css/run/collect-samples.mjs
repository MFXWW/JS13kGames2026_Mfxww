// 收集项目内真实 CSS 作为样本（src/index.html、level_editor、unicorn_canvas 等），
// 抽取 <style> 块，规范化后写入 samples/。避免实验依赖具体游戏源码路径。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..', '..'); // experiments/roadroller_css/run -> 仓库根
const outDir = path.resolve(here, '..', 'samples');
mkdirSync(outDir, { recursive: true });

const styleBlocksOf = file => {
  const html = readFileSync(path.join(root, file), 'utf8');
  return [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
};

const sources = [
  { name: 'game_ui.css', files: ['src/index.html'], type: 'style' },
  { name: 'level_editor.css', files: ['tools/level_editor/index.html'], type: 'style' },
  { name: 'unicorn.css', files: ['tools/unicorn_canvas/style.css'], type: 'css' },
];

for (const { name, files, type } of sources) {
  const parts = [];
  for (const f of files) {
    if (type === 'style') parts.push(...styleBlocksOf(f));
    else parts.push(readFileSync(path.join(root, f), 'utf8'));
  }
  writeFileSync(path.join(outDir, name), parts.join('\n'), 'utf8');
  console.log(`wrote samples/${name} (${Buffer.byteLength(parts.join('\n'), 'utf8')}B)`);
}
