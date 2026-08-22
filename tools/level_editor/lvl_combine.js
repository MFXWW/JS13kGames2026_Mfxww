// 关卡合并工具：把 lvl/*.bin 合并为单一 lvl.bin（长度前缀 + 指针定位）
// 每个关卡块 = [u8 长度][数据]（单关 <256B），按 levels 数组顺序排列
// 用法: node lvl_combine.js
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', '..', 'src', 'assets', 'lvl');
const OUT = path.join(SRC_DIR, 'lvl.bin');

// 与 game_core.js levels 数组顺序一致
function levelNames() {
    const names = [];
    const chapterLevelCounts = [3, 3, 3, 3, 3, 3, 3, 2, 3, 2, 2, 2];
    for (let ch = 1; ch <= 12; ch++) {
        for (let p = 1; p <= chapterLevelCounts[ch - 1]; p++) {
            names.push(`${ch}-${p}`);
        }
    }
    names.push('corridor');       // index 32
    names.push('13-1', '13-2', '13-3'); // index 33-35
    names.push('12-2-void');      // index 36（无冠首次 12-2 强制坠落版）
    return names;
}

const names = levelNames();
const chunks = [];
const offsets = []; // 每块在 lvl.bin 中的字节偏移（供运行时构建指针表）
let bytePos = 0;

for (const n of names) {
    const file = path.join(SRC_DIR, `${n}.bin`);
    if (!fs.existsSync(file)) {
        console.error(`MISSING: ${file}`);
        process.exit(1);
    }
    const data = fs.readFileSync(file);
    offsets.push(bytePos);
    // u8 长度前缀 + 数据
    chunks.push(Buffer.from([data.length]), data);
    bytePos += 1 + data.length;
}

const merged = Buffer.concat(chunks);
fs.writeFileSync(OUT, merged);

console.log(`Merged ${names.length} levels -> ${OUT} (${merged.length} bytes)`);
console.log(`Offsets: ${offsets.join(',')}`);
