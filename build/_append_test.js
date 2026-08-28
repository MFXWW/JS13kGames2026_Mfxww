// 方案C变体：img.bin+lvl.bin 追加到 index.html 尾部，JS fetch 自身按偏移读取
const fs = require('fs');
const path = require('path');
const zopfli = require('@gfx/zopfli');

const DIST = path.join(__dirname, '..', 'dist');
const html = fs.readFileSync(path.join(DIST, 'index.html'));
const img = fs.readFileSync(path.join(DIST, 'img.bin'));
const lvlOld = fs.readFileSync(path.join(DIST, 'lvl', 'lvl.bin'));

function lvlU8(buf) {
    const blocks = []; let ptr = 0;
    while (ptr + 2 <= buf.length) { const len = buf.readUInt16BE(ptr); blocks.push(buf.slice(ptr + 2, ptr + 2 + len)); ptr += 2 + len; }
    const parts = []; for (const d of blocks) parts.push(Buffer.from([d.length]), d);
    return Buffer.concat(parts);
}
const lvl = lvlU8(lvlOld);

const crcTable = [];
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function dosDateTime(d) { const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(); return [time & 0xffff, date & 0xffff]; }
async function buildZip(entries) {
    const localParts = []; const centralParts = []; let offset = 0;
    for (const e of entries) {
        const comp = await zopfli.deflateAsync(e.data, { numiterations: 15 });
        const name = Buffer.from(e.name); const [tm, dt] = dosDateTime(new Date()); const crc = crc32(e.data);
        const lh = Buffer.alloc(30); lh.write('PK\x03\x04', 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
        lh.writeUInt16LE(tm, 10); lh.writeUInt16LE(dt, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
        localParts.push(lh, name, comp);
        const ch = Buffer.alloc(46); ch.write('PK\x01\x02', 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10);
        ch.writeUInt16LE(tm, 12); ch.writeUInt16LE(dt, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
        centralParts.push(ch, name); offset += 30 + name.length + comp.length;
    }
    const central = Buffer.concat(centralParts); const eocd = Buffer.alloc(22);
    eocd.write('PK\x05\x06', 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(offset, 16);
    return Buffer.concat([...localParts, central, eocd]).length;
}

(async () => {
    const g = await import('./_embed_test2.js').catch(() => null);
    // 方案C1: index.html 追加 img(768) + lvl(u8)
    const c1 = await buildZip([
        { name: 'index.html', data: Buffer.concat([html, img, lvl]) },
        { name: 'g.js', data: fs.readFileSync(path.join(DIST, 'game.rolled.js')) },
    ]);
    console.log('C1 html+img+lvl(u8) 2文件:', c1);

    // 方案C2: index.html 追加 lvl(u8) + img
    const c2 = await buildZip([
        { name: 'index.html', data: Buffer.concat([html, lvl, img]) },
        { name: 'g.js', data: fs.readFileSync(path.join(DIST, 'game.rolled.js')) },
    ]);
    console.log('C2 html+lvl(u8)+img 2文件:', c2);

    // 对比: 当前
    const base = await buildZip([
        { name: 'index.html', data: html },
        { name: 'game.rolled.js', data: fs.readFileSync(path.join(DIST, 'game.rolled.js')) },
        { name: 'img.bin', data: img },
        { name: 'lvl/lvl.bin', data: lvlOld },
    ]);
    console.log('基准4文件:', base);
})();
