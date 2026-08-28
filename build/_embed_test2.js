// 完整组合测试：b64 嵌入 + lvl 前缀 u8 + roadroller 参数
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zopfli = require('@gfx/zopfli');

const DIST = path.join(__dirname, '..', 'dist');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(DIST, 'index.html'));
const minjs = fs.readFileSync(path.join(DIST, 'game.min.js'));
const img = fs.readFileSync(path.join(DIST, 'img.bin'));
const lvlOld = fs.readFileSync(path.join(DIST, 'lvl', 'lvl.bin'));

// lvl 前缀 u16→u8
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

function makeDataJs(data) {
    return Buffer.concat([minjs, Buffer.from('\nvar D="' + data.toString('base64') + '";')]);
}

async function roll(file, out, opt) {
    execSync(`npx --no-install roadroller ${opt} "${file}" -o "${out}"`, { cwd: path.join(ROOT, 'build'), stdio: 'pipe' });
    return fs.readFileSync(out);
}

(async () => {
    const dataU8 = Buffer.concat([img, lvl]);
    const tmp = path.join(DIST, '_data.js');
    fs.writeFileSync(tmp, makeDataJs(dataU8));
    const rolled = await roll(tmp, path.join(DIST, '_drolled.js'), '-O2');
    const z = await buildZip([
        { name: 'index.html', data: html },
        { name: 'g.js', data: rolled },
    ]);
    console.log('b64嵌入 + lvl前缀u8 + O2:', z);
    fs.unlinkSync(tmp);

    // 更高 iteration zopfli
    const comp = await zopfli.deflateAsync(rolled, { numiterations: 100 });
    const localParts = []; const centralParts = []; let offset = 0;
    for (const e of [{ name: 'index.html', data: html }, { name: 'g.js', data: rolled }]) {
        const c2 = e.name === 'g.js' ? comp : await zopfli.deflateAsync(e.data, { numiterations: 15 });
        const name = Buffer.from(e.name); const [tm, dt] = dosDateTime(new Date()); const crc = crc32(e.data);
        const lh = Buffer.alloc(30); lh.write('PK\x03\x04', 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
        lh.writeUInt16LE(tm, 10); lh.writeUInt16LE(dt, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp ? c2.length : 0, 18); lh.writeUInt32LE(e.data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
        localParts.push(lh, name, c2);
        const ch = Buffer.alloc(46); ch.write('PK\x01\x02', 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10);
        ch.writeUInt16LE(tm, 12); ch.writeUInt16LE(dt, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(c2.length, 20); ch.writeUInt32LE(e.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
        centralParts.push(ch, name); offset += 30 + name.length + c2.length;
    }
    const central = Buffer.concat(centralParts); const eocd = Buffer.alloc(22);
    eocd.write('PK\x05\x06', 0); eocd.writeUInt16LE(2, 8); eocd.writeUInt16LE(2, 10); eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(offset, 16);
    console.log('同结构 + zopfli it100:', Buffer.concat([...localParts, central, eocd]).length);
    fs.unlinkSync(path.join(DIST, '_drolled.js'));
})();
