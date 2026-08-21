// 构建时 DOM 名压缩：从可读的根 index.html + ui.js 生成压缩版 compiled/index.html 与 ui.tmp.js
// 用法：node dom_rename.js（在 build_all.bat 第 0 步调用）
// 产出：
//   compiled/index.html  ← 根 index.html 的：dev 脚本块→game.rolled.js + id/class 短名 + CSS 压缩
//   compiled/ui.tmp.js   ← ui.js 的 id/class 字符串改为短名（供 terser 使用）
const fs = require('fs');
const path = require('path');

const SRC_HTML = path.join(__dirname, '..', 'src', 'index.html');
const SRC_UI = path.join(__dirname, '..', 'src', 'js', 'ui.js');
const OUT_HTML = path.join(__dirname, '..', 'dist', 'index.html');
const OUT_UI = path.join(__dirname, '..', 'dist', 'ui.tmp.js');

const html = fs.readFileSync(SRC_HTML, 'utf8');
const ui = fs.readFileSync(SRC_UI, 'utf8');

// 1. 收集 id 与 class 名（顺序稳定：id 按出现顺序，class 按出现顺序）
const ids = [];
const classes = [];
for (const m of html.matchAll(/\bid="([^"]+)"/g)) if (!ids.includes(m[1])) ids.push(m[1]);
for (const m of html.matchAll(/\bclass="([^"]+)"/g)) for (const c of m[1].split(/\s+/)) if (c && !classes.includes(c)) classes.push(c);
// CSS 选择器里的 class（.active/.visible/.level-label 等）
for (const m of html.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
    const c = m[1];
    if (c === 'level-label' || c === 'level-sub' || c === 'cycle-notice' || c === 'intro-title' || c === 'intro-body' || c === 'intro-hint' || c === 'active' || c === 'visible' || c === 'ov' || c === 'cf') {
        if (!classes.includes(c)) classes.push(c);
    }
}

// 2. 分配短名（a-z 然后 aa,ab,...）
function shortName(i) {
    let s = '';
    i++;
    while (i > 0) { i--; s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26); }
    return s;
}
const idMap = {};
ids.forEach((id, i) => { idMap[id] = shortName(i); });
const classMap = {};
classes.forEach((c, i) => { classMap[c] = shortName(ids.length + i); });

function renameStr(s, order) {
    // 按名长降序替换，避免子串误伤
    const all = order.sort((a, b) => b.length - a.length);
    let out = s;
    for (const name of all) out = out.split(name).join(idMap[name] || classMap[name] || name);
    return out;
}
const idNames = Object.keys(idMap);
const classNames = Object.keys(classMap);

// 3. 生成 compiled/index.html
// 3a. 替换 dev 脚本块为 game.rolled.js
let out = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>\s*/g, '');
out = out.replace('</body>', '<script src="game.rolled.js"></script>\n</body>');
// 3b. 重命名 id/class（HTML 属性 + CSS 选择器）
out = renameStr(out, [...idNames, ...classNames]);
// 3c. CSS 压缩
out = out.replace(/(<style>)([\s\S]*?)(<\/style>)/, (m, a, css, b) => {
    const min = css
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\s*([{}:;,>~])\s*/g, '$1')
        .replace(/;}/g, '}')
        .replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi, '#$1$2$3')
        .replace(/\s+/g, ' ');
    return a + min + b;
});
out = out.replace(/<!--[\s\S]*?-->/g, '');
fs.writeFileSync(OUT_HTML, out);

// 4. 生成 compiled/ui.tmp.js：只替换单引号字符串字面量内的 id/class 名（变量名不动，交给 terser）
const uiOut = ui.replace(/'[^']*'/g, (q) => {
    let inner = q.slice(1, -1);
    inner = renameStr(inner, [...idNames, ...classNames]);
    return "'" + inner + "'";
});
fs.writeFileSync(OUT_UI, uiOut);

console.log('ids:', JSON.stringify(idMap));
console.log('classes:', JSON.stringify(classMap));
console.log(`index.html ${html.length} -> ${out.length}；ui.js ${ui.length} -> ${uiOut.length}`);
