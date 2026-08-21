// 压缩 compiled/index.html 的 <style> 块（去注释、压空白、缩写色值），原地覆盖
// 可重复执行（幂等）；可读的 CSS 参照根目录 index.html
const fs = require('fs');
const FILE = 'compiled/index.html';

function minifyCss(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')                              // 注释
        .replace(/\s*([{}:;,>~])\s*/g, '$1')                            // 括号/冒号/分号/逗号/组合器旁空白
        .replace(/;}/g, '}')                                             // 块尾分号
        .replace(/#([0-9a-f])\1([0-9a-f])\2([0-9a-f])\3/gi, '#$1$2$3')  // #rrggbb -> #rgb
        .replace(/\s+/g, ' ');                                           // 其余空白折叠为单空格
}

const html = fs.readFileSync(FILE, 'utf8');
const styleRe = /(<style>)([\s\S]*?)(<\/style>)/;
const m = html.match(styleRe);
if (!m) { console.error('未找到 <style> 块'); process.exit(1); }
const css = m[2];
const min = minifyCss(css);
const out = html.replace(styleRe, m[1] + min + m[3]).replace(/<!--[\s\S]*?-->/g, '');
fs.writeFileSync(FILE, out);
console.log(`CSS 块 ${css.length} -> ${min.length}；index.html ${html.length} -> ${out.length}`);
