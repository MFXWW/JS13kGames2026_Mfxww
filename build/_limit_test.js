// 方案 C1 极限测试：roadroller -O∞ 长时间调参 + zopfli it100
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
async function buildZip(entries, it = 15) {
    const localParts = []; const centralParts = []; let offset = 0;
    for (const e of entries) {
        const comp = await zopfli.deflateAsync(e.data, { numiterations: it });
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
    // 两文件 C1: html 追加 [img][lvl(u8)]
    const h2 = Buffer.concat([html, img, lvl]);
    // 内联 JS 版本（单文件）
    const inlineHtml = Buffer.from(html.toString('utf8').replace('</body>', '<script>' + fs.readFileSync(path.join(DIST, 'game.rolled.js'), 'utf8') + '</script></body>'));

    console.log('C1 两文件 (it15):', await buildZip([{ name: 'index.html', data: h2 }, { name: 'g.js', data: fs.readFileSync(path.join(DIST, 'game.rolled.js')) }], 15));
    console.log('C1 两文件 (it100):', await buildZip([{ name: 'index.html', data: h2 }, { name: 'g.js', data: fs.readFileSync(path.join(DIST, 'game.rolled.js')) }], 100));

    // 单文件方案：需要把 min.js 重新 roadroller 后内联（这里先用现有 rolled）
    console.log('单文件 (it15):', await buildZip([{ name: 'index.html', data: Buffer.concat([inlineHtml, img, lvl]) }], 15));
    console.log('单文件 (it100):', await buildZip([{ name: 'index.html', data: Buffer.concat([inlineHtml, img, lvl]) }], 100));

    // roadroller -O∞ 跑一段时间测 rolled 输出
    console.log('开始 -O∞ 调参...');
    const tmpIn = path.join(DIST, '_min.js');
    const tmpOut = path.join(DIST, '_r.js');
    fs.writeFileSync(tmpIn, minjs);
    const t0 = Date.now();
    execSync('npx --no-install roadroller -O "..\\dist\\_min.js" -o "..\\dist\\_r.js"', { cwd: path.join(ROOT, 'build'), stdio: 'pipe', timeout: 120000 });
    const rolled = fs.readFileSync(tmpOut);
    console.log(`-O∞ 输出 ${rolled.length}B (耗时 ${Date.now() - t0}ms)`);
    const inline2 = Buffer.from(html.toString('utf8').replace('</body>', '<script>' + rolled.toString('utf8') + '</script></body>'));
    console.log('单文件+O∞ (it100):', await buildZip([{ name: 'index.html', data: Buffer.concat([inline2, img, lvl]) }], 100));
    fs.unlinkSync(tmpIn); fs.unlinkSync(tmpOut);
})();
