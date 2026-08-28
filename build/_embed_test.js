// 测：把 img.bin + lvl.bin 嵌入 JS，走 roadroller 后 zip 大小
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const zopfli = require('@gfx/zopfli');

const DIST = path.join(__dirname, '..', 'dist');
const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(DIST, 'index.html'));
const minjs = fs.readFileSync(path.join(DIST, 'game.min.js'));
const img = fs.readFileSync(path.join(DIST, 'img.bin'));
const lvl = fs.readFileSync(path.join(DIST, 'lvl', 'lvl.bin'));

// 生成嵌入 JS（在 min.js 后拼接数据声明）
function makeDataJs(mode) {
    const data = Buffer.concat([img, lvl]);
    let decl;
    if (mode === 'array') {
        decl = 'var D=[' + Array.from(data).join(',') + '];';
    } else if (mode === 'b64') {
        decl = 'var D="' + data.toString('base64') + '";';
    } else if (mode === 'latin1') {
        decl = 'var D="' + data.toString('latin1').replace(/["\\]/g, '\\$&').replace(/[\x00-\x1f\x7f-\xff]/g, c => '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0')) + '";';
    }
    return Buffer.concat([minjs, Buffer.from('\n' + decl)]);
}

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

async function roll(file, out) {
    execSync(`npx --no-install roadroller -O2 "${file}" -o "${out}"`, { cwd: path.join(ROOT, 'build'), stdio: 'pipe' });
    return fs.readFileSync(out);
}

(async () => {
    const base = await buildZip([
        { name: 'index.html', data: html },
        { name: 'game.rolled.js', data: fs.readFileSync(path.join(DIST, 'game.rolled.js')) },
        { name: 'img.bin', data: img },
        { name: 'lvl/lvl.bin', data: lvl },
    ]);
    console.log('基准4文件:', base);

    for (const mode of ['array', 'b64', 'latin1']) {
        const tmp = path.join(DIST, '_data.js');
        fs.writeFileSync(tmp, makeDataJs(mode));
        const rolled = await roll(tmp, path.join(DIST, '_drolled.js'));
        fs.unlinkSync(tmp);
        const z = await buildZip([
            { name: 'index.html', data: html },
            { name: 'g.js', data: rolled },
        ]);
        console.log(`模式 ${mode}: 2文件zip=${z} 省=${base - z}`);
    }
})();
