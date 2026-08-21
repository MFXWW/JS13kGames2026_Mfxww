// 用 zopfli（目前最优的 deflate 编码器）重新打包 zip，比 Compress-Archive/7-Zip 的 deflate 更小
// 用法: node zopfli_zip.js [输出zip路径]
// 未安装 @gfx/zopfli 时自动回退到 node 内置 zlib deflate（level 9），保证构建不中断
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DIST = path.join(__dirname, '..', 'dist');
const FILES = ['index.html', 'game.rolled.js', 'img.bin', 'lvl/lvl.bin'].map((f) => path.join(DIST, f));
const OUT = process.argv[2] || path.join(DIST, 'fallen_rainbow.zip');

let zopfli = null;
try { zopfli = require('@gfx/zopfli'); } catch (e) { /* 未安装，走 zlib 回退 */ }

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
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    let totalRaw = 0;
    let totalComp = 0;

    for (const rel of FILES) {
        const raw = fs.readFileSync(rel);
        const comp = await deflateOne(raw);
        const name = Buffer.from(path.relative(DIST, rel).replace(/\\/g, '/'));
        const [tm, dt] = dosDateTime(new Date());
        const crc = crc32(raw);

        const lh = Buffer.alloc(30);
        lh.write('PK\x03\x04', 0);
        lh.writeUInt16LE(20, 4);        // 版本
        lh.writeUInt16LE(0, 6);         // flags
        lh.writeUInt16LE(8, 8);         // method = deflate
        lh.writeUInt16LE(tm, 10);
        lh.writeUInt16LE(dt, 12);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(comp.length, 18);
        lh.writeUInt32LE(raw.length, 22);
        lh.writeUInt16LE(name.length, 26);
        lh.writeUInt16LE(0, 28);
        localParts.push(lh, name, comp);

        const ch = Buffer.alloc(46);
        ch.write('PK\x01\x02', 0);
        ch.writeUInt16LE(20, 4);        // 由谁创建
        ch.writeUInt16LE(20, 6);        // 需版本
        ch.writeUInt16LE(0, 8);         // flags
        ch.writeUInt16LE(8, 10);        // method
        ch.writeUInt16LE(tm, 12);
        ch.writeUInt16LE(dt, 14);
        ch.writeUInt32LE(crc, 16);
        ch.writeUInt32LE(comp.length, 20);
        ch.writeUInt32LE(raw.length, 24);
        ch.writeUInt16LE(name.length, 28);
        ch.writeUInt32LE(offset, 42);   // 本地头偏移
        centralParts.push(ch, name);

        totalRaw += raw.length;
        totalComp += comp.length;
        offset += 30 + name.length + comp.length;
    }

    const central = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.write('PK\x05\x06', 0);
    eocd.writeUInt16LE(FILES.length, 8);
    eocd.writeUInt16LE(FILES.length, 10);
    eocd.writeUInt32LE(central.length, 12);
    eocd.writeUInt32LE(offset, 16);

    const zip = Buffer.concat([...localParts, central, eocd]);
    fs.writeFileSync(OUT, zip);
    console.log(`${OUT}: ${zip.length} bytes (raw ${totalRaw}, deflate ${totalComp}, encoder: ${zopfli ? 'zopfli' : 'zlib'})`);
})().catch((e) => { console.error(e); process.exit(1); });
