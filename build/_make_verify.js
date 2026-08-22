// 生成验证页 build/_verify/index.html：用未压缩 src 脚本 + 追加 img/lvl/footer（同生产格式）
// 这样 page.evaluate 能直接调用 gameLoadLevel(i) 逐关验证。用法：node _make_verify.js
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'src', 'index.html'), 'utf8');
const img = fs.readFileSync(path.join(ROOT, 'src', 'assets', 'img.bin'));
const lvl = fs.readFileSync(path.join(ROOT, 'src', 'assets', 'lvl', 'lvl.bin'));

const out = path.join(__dirname, '_verify', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });

// 改脚本路径为绝对（/src/js/...），便于从 /build/_verify/ 加载
let page = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, '<script src="/src/$1"></script>');

// 追加数据（与 package_single.js 相同格式：`<!--\n` + img + lvl + footer）
const footer = Buffer.alloc(4);
footer.writeUInt16BE(img.length, 0);
footer.writeUInt16BE(lvl.length, 2);
const data = Buffer.concat([Buffer.from('<!--\n'), img, lvl, footer]);
fs.writeFileSync(out, Buffer.concat([Buffer.from(page, 'utf8'), data]));

console.log(`verify page: ${out} (${Buffer.concat([Buffer.from(page, 'utf8'), data]).length} bytes)`);
