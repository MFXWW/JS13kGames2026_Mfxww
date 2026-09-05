// 原型实验：给 CSS/HTML 加"token 缩写"式预处理后，喂 roadroller(text) 还能净省多少？
// 对比含"映射表成本"的真实净收益（映射表与内容一同进入压缩流）。
import { Packer } from 'file:///C:/Users/41984/node_modules/roadroller/index.mjs';
import { deflateSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const rd = p => readFileSync(p, 'utf8');
const bytes = s => Buffer.byteLength(s, 'utf8');
const deflate = s => deflateSync(Buffer.from(s, 'utf8'), { level: 9 }).length;
const TARGET = 19000;
const trunc = s => s.slice(0, TARGET);

// ---------- 组装样本 ----------
const styleOf = f => [...rd(f).matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
const css = trunc([
    styleOf('src/index.html'),
    styleOf('tools/level_editor/index.html'),
    rd('tools/unicorn_canvas/style.css'),
].join('\n'));
const html = trunc(rd('src/index.html').replace(/<script[\s\S]*?<\/script>/g, ''));

// ---------- roadroller text 模式 ----------
function rr(data) {
    const packer = new Packer([{ data, type: 'text', action: 'eval' }], {});
    const code = packer.makeDecoder().firstLine + packer.makeDecoder().secondLine;
    return deflate(code);
}
// 注意：makeDecoder 两次调用各压一次，下面统一一次调用
function rrOnce(data) {
    const packer = new Packer([{ data, type: 'text', action: 'eval' }], {});
    const { firstLine, secondLine } = packer.makeDecoder();
    return { dataBytes: bytes(firstLine), outBytes: deflate(firstLine + secondLine) };
}

// ---------- token 缩写预处理（测量用，近似 roadroller 的 JS 标识符缩写哲学） ----------
// ident 近似：CSS/HTML 里的标识符 / 关键字 / 类名等
const TOKEN_RE = /[A-Za-z_][\w-]*/g;

function abbreviate(text, opts = {}) {
    // 1) 统计 ident 频率
    const freqs = new Map();
    for (const m of text.matchAll(TOKEN_RE)) {
        const t = m[0];
        if (t.length > (opts.minLen ?? 1)) freqs.set(t, (freqs.get(t) || 0) + 1);
    }

    // 2) 找出原文未出现过的"可用"单字符（可打印 ASCII，避开引号/反斜杠/空格）
    const used = new Set(text);
    const forbidden = new Set([' ', '"', "'", '`', '\\']);
    const pool = [];
    for (let c = 33; c <= 126; ++c) {
        const ch = String.fromCharCode(c);
        if (!used.has(ch) && !forbidden.has(ch)) pool.push(ch);
    }

    // 3) 启发式打分后取前 K 个（池不够就少用）
    const scored = [...freqs.entries()]
        .map(([t, f]) => [t, t.length * (f - 1)])
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1]);
    const K = Math.min(pool.length, scored.length);
    const map = new Map(scored.slice(0, K).map(([t], i) => [t, pool[i]]));

    // 4) 替换（顺序处理避免嵌套；本测量只做单遍 token 替换）
    const replaced = text.replace(TOKEN_RE, m => map.get(m[0]) ?? m[0]);

    // 5) 映射表（可逆、需随内容一起传输/压缩）
    const table = [...map].map(([t, a]) => `${a} ${t}`).join('\n');
    return { replaced, table, K, poolSize: pool.length };
}

function report(name, data, opts = {}) {
    const raw = bytes(data);
    const d9 = deflate(data);
    const base = rrOnce(data);
    console.log(`\n[${name}] raw=${raw}  deflate9=${d9}  rr(text)=${base.outBytes}  (rr 比 deflate 省 ${(100 - base.outBytes / d9 * 100).toFixed(1)}%)`);

    const { replaced, table, K, poolSize } = abbreviate(data, opts);
    // 映射表 + 缩写内容 一起进压缩流 = 真实净收益（含还原所需全部信息）
    const combined = table + '\n' + replaced;
    const combDef = deflate(combined);
    const combRR = rrOnce(combined);
    console.log(`  -> token缩写: 池=${poolSize} 可用/用K=${K}  缩后内容=${bytes(replaced)}B +表=${bytes(table)}B`);
    console.log(`  -> 缩写后(整体)  deflate9=${combDef}  rr(text)=${combRR.outBytes}  (整体比原rr ${(100 - combRR.outBytes / base.outBytes * 100).toFixed(1)}%)`);
    return { base: base.outBytes, comb: combRR.outBytes };
}

console.log('=== 收益上限原型（含映射表成本，近似"真实可用"数字）===');
report('CSS', css);
report('HTML', html);
