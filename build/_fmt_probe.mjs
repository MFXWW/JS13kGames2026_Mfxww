// Roadroller 对不同文本格式的压缩效果探针（对比 deflate 基线）
import { Packer } from 'file:///C:/Users/41984/node_modules/roadroller/index.mjs';
import { deflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const TARGET = 19000;
const rd = p => readFileSync(p, 'utf8');

// --- 组装样本 ---
// JS: 真实完整 js13k 风格源码
const js = rd('src/js/entities.js');

// CSS: 项目内多处真实 CSS 拼接后截断到与 js/python 相近量级
const styleOf = f => [...rd(f).matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const cssRaw = [
    styleOf('src/index.html'),
    styleOf('tools/level_editor/index.html'),
    rd('tools/unicorn_canvas/style.css'),
].join('\n');

// Python: PyQt 编辑器源码截断
const pyRaw = rd('tools/level_editor/editor.py');

const trunc = s => s.slice(0, TARGET); // 仅 text 样本可安全截断
const css = trunc(cssRaw);
const py = trunc(pyRaw);

// --- 工具 ---
const bytes = s => Buffer.byteLength(s, 'utf8');
const deflate = s => deflateSync(Buffer.from(s, 'utf8'), { level: 9 }).length;

// roadroller: js 用 js 模式（tokenize+缩写+引号模型），css/py 用 text 模式（纯文本）
function roadroller(data, type) {
    const packer = new Packer([{ data, type, action: type === 'js' ? 'eval' : 'eval' }], {});
    const { firstLine, secondLine } = packer.makeDecoder(); // 默认参数（不做 -O 调参）
    const code = firstLine + secondLine;
    return {
        dataBytes: bytes(firstLine),   // 第一行 ≈ 熵压后的数据流
        deflatedBytes: deflate(code),  // 产物整体再过 deflate（zip 内最终大小）
    };
}

const samples = [
    { name: 'JavaScript (js 模式)', data: js, type: 'js' },
    { name: 'CSS        (text 模式)', data: css, type: 'text' },
    { name: 'Python     (text 模式)', data: py, type: 'text' },
];

console.log('格式                      rawB   deflate9B   rr-dataB   rr+deflateB   deflate压比   rr再省(def)');
for (const { name, data, type } of samples) {
    const raw = bytes(data);
    const def = deflate(data);
    const { dataBytes, deflatedBytes } = roadroller(data, type);
    const dRatio = (100 - def / raw * 100).toFixed(1);
    const extra = (100 - deflatedBytes / def * 100).toFixed(1);
    console.log(
        `${name.padEnd(26)} ${String(raw).padStart(5)}  ${String(def).padStart(6)}    ` +
        `${String(dataBytes).padStart(8)}   ${String(deflatedBytes).padStart(8)}     ` +
        `${String(dRatio).padStart(6)}%      ${String(extra).padStart(6)}%`
    );
}

// --- 补充: 把 css/python 也强制用 js 模式跑一次，看专用预处理能带来多少增益 ---
console.log('\n--- 对照: css/python 误用 js 模式(词法处理+标识符缩写生效) ---');
for (const { name, data } of [
    { name: 'CSS   as js', data: css },
    { name: 'Python as js', data: py },
]) {
    try {
        const raw = bytes(data);
        const def = deflate(data);
        const { dataBytes, deflatedBytes } = roadroller(data, 'js');
        console.log(
            `${name.padEnd(18)} raw ${String(raw).padStart(5)}  deflate9 ${String(def).padStart(6)}  ` +
            `rr-data ${String(dataBytes).padStart(8)}  rr+deflate ${String(deflatedBytes).padStart(8)}`
        );
    } catch (e) {
        console.log(`${name.padEnd(18)} 失败: ${e.message}`);
    }
}
