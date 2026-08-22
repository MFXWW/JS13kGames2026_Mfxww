// 单文件方案复核脚本：验证实际构建产物 dist/index.html（单文件）与 zip 是否达标
// 用法：node _single_test.js（在 build_all.bat 之后运行）
// 说明：单文件方案已由 package_single.js 实现；本脚本只做产物核对，不再模拟预测。
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');
const single = fs.readFileSync(path.join(DIST, 'index.html'));
const zip = fs.readFileSync(path.join(DIST, 'fallen_rainbow.zip'));

// 从页尾解析 footer（与 gameAssetsLoaded 相同的偏移逻辑）
const view = new DataView(single.buffer, single.byteOffset, single.byteLength);
const il = view.getUint16(single.length - 4, false);
const ll = view.getUint16(single.length - 2, false);
const is = single.length - 4 - il - ll;
const imgOk = is >= 0 && il > 0 && is + il <= single.length - 4;
const lvlOk = is + il + ll === single.length - 4;

console.log(`dist/index.html: ${single.length} bytes`);
console.log(`  footer: imgLen=${il}, lvlLen=${ll}, imgStart=${is}  区域合法=${imgOk && lvlOk}`);
console.log(`dist/fallen_rainbow.zip: ${zip.length} bytes  ${zip.length <= 13312 ? 'PASS <=13312' : 'OVER 13312'}`);
console.log(`  margin: ${13312 - zip.length} bytes`);
if (!imgOk || !lvlOk) { console.error('footer 解析异常'); process.exit(1); }
if (zip.length > 13312) { console.error('超限'); process.exit(1); }
