// 单文件打包：把 dist/index.html（dom_rename 产物）内联 game.rolled.js，
// 尾部追加 [img.bin][lvl.bin(u8)][u16 imgLen][u16 lvlLen]（大端），然后打成单文件 zip。
// 运行时 JS 用 gameAssetsLoaded() 从页尾按偏移 slice 出 img/lvl。
// 用法：node package_single.js（build_all.bat 第 3 步调用，需先跑 lvl_combine.js）
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = path.join(__dirname, '..', 'dist');
const SRC_ASSETS = path.join(__dirname, '..', 'src', 'assets');
const OUT_ZIP = path.join(DIST, 'fallen_rainbow.zip');

let zopfli = null;
try { zopfli = require('@gfx/zopfli'); } catch (e) { /* 未安装走 zlib */ }

// ---- 1. 内联 JS + 追加数据 ----
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const rolled = fs.readFileSync(path.join(DIST, 'game.rolled.js'));
const img = fs.readFileSync(path.join(SRC_ASSETS, 'img.bin'));
const lvl = fs.readFileSync(path.join(SRC_ASSETS, 'lvl', 'lvl.bin'));

let js = rolled.toString('utf8').split('</script').join('<\\/script');
const inlined = html.replace(/<script src="game\.rolled\.js"><\/script>/, '<script>' + js + '</script>');
if (inlined === html) { console.error('未找到 <script src="game.rolled.js">，内联失败'); process.exit(1); }

// 尾部数据用未闭合注释 `<!--\n` 包裹（到 EOF），避免二进制被当作文本渲染；
// footer 仍在文件最末 4 字节，JS 偏移逻辑不变。须确保数据区不含 `-->`（会提前闭合注释）
const footer = Buffer.alloc(4);
footer.writeUInt16BE(img.length, 0);
footer.writeUInt16BE(lvl.length, 2);
const data = Buffer.concat([img, lvl, footer]);
if (data.indexOf(Buffer.from('-->')) !== -1 || data.indexOf(Buffer.from('--!>')) !== -1) {
    console.error('尾部数据含 --> 或 --!>，会提前闭合注释'); process.exit(1);
}

const htmlBuf = Buffer.from(inlined, 'utf8');
const single = Buffer.concat([htmlBuf, Buffer.from('<!--\n'), data]);
fs.writeFileSync(path.join(DIST, 'index.html'), single);
console.log(`single index.html: ${single.length} bytes (html ${htmlBuf.length} + <!--\\n 5 + img ${img.length} + lvl ${lvl.length} + footer 4)`);

// ---- 2. 打包 zip（单文件，zopfli 优先） ----
const crcTable = [];
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
}
function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}
function dosDateTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return [time & 0xffff, date & 0xffff];
}
function deflateOne(raw) {
    if (zopfli) return zopfli.deflateAsync(raw, { numiterations: 15 });
    return Promise.resolve(zlib.deflateSync(raw, { level: 9 }));
}

(async () => {
    const name = Buffer.from('index.html');
    const comp = await deflateOne(single);
    const [tm, dt] = dosDateTime(new Date());
    const crc = crc32(single);

    const lh = Buffer.alloc(30);
    lh.write('PK\x03\x04', 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(tm, 10);
    lh.writeUInt16LE(dt, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18);
    lh.writeUInt32LE(single.length, 22);
    lh.writeUInt16LE(name.length, 26);
    lh.writeUInt16LE(0, 28);

    const ch = Buffer.alloc(46);
    ch.write('PK\x01\x02', 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(tm, 12);
    ch.writeUInt16LE(dt, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20);
    ch.writeUInt32LE(single.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(0, 42);

    const central = Buffer.concat([ch, name]);
    const eocd = Buffer.alloc(22);
    eocd.write('PK\x05\x06', 0);
    eocd.writeUInt16LE(1, 8);
    eocd.writeUInt16LE(1, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(30 + name.length + comp.length, 16);

    const zip = Buffer.concat([lh, name, comp, central, eocd]);
    fs.writeFileSync(OUT_ZIP, zip);
    const ok = zip.length <= 13312;
    console.log(`${OUT_ZIP}: ${zip.length} bytes (raw ${single.length}, deflate ${comp.length}, encoder: ${zopfli ? 'zopfli' : 'zlib'}) ${ok ? 'PASS <=13312' : 'OVER 13312'}`);
    process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
