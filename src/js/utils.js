// Tool functions: collision detection
// Rect :: { x: number, y: number, width: number, height: number }
function collideRect(rect1, rect2) {
    return (
        rect1.x <= rect2.x + rect2.width &&
        rect1.x + rect1.width >= rect2.x &&
        rect1.y <= rect2.y + rect2.height &&
        rect1.y + rect1.height >= rect2.y
    );
}

// ===================== 精灵帧加载（img.bin 位压缩 + 代码提供 rect） =====================
let GAME_SpriteFrameCache = {};

// 精灵帧在 img.bin 中的位置/尺寸（陷阱左侧 3 列 x 32，玩家右侧 6 帧 x 24）
// 陷阱使用关卡主题色；玩家固定黑色渲染（fg 黑 / bg 透明）
const GAME_SpriteRects = {
    'black_hole1.png':      { x: 0,  y: 0,  w: 16, h: 16 },
    'black_hole2.png':      { x: 0,  y: 16, w: 16, h: 16 },
    'bounce_default.png':   { x: 16, y: 0,  w: 16, h: 16 },
    'bounce_triggered.png': { x: 16, y: 16, w: 16, h: 16 },
    'button_default.png':   { x: 32, y: 0,  w: 16, h: 8 },
    'button_triggered.png': { x: 32, y: 8,  w: 16, h: 8 },
    'destination.png':      { x: 32, y: 16, w: 16, h: 16 },
    idle:  { x: 48,  y: 0, w: 24, h: 32, fg: '#000000', bg: 'rgba(0,0,0,0)' },
    jump:  { x: 72,  y: 0, w: 24, h: 32, fg: '#000000', bg: 'rgba(0,0,0,0)' },
    run1:  { x: 96,  y: 0, w: 24, h: 32, fg: '#000000', bg: 'rgba(0,0,0,0)' },
    run2:  { x: 120, y: 0, w: 24, h: 32, fg: '#000000', bg: 'rgba(0,0,0,0)' },
    run3:  { x: 144, y: 0, w: 24, h: 32, fg: '#000000', bg: 'rgba(0,0,0,0)' },
    run4:  { x: 168, y: 0, w: 24, h: 32, fg: '#000000', bg: 'rgba(0,0,0,0)' },
};

function cssColorToRGBA(colorStr) {
    const cvs = document.createElement('canvas');
    cvs.width = cvs.height = 1;
    const c = cvs.getContext('2d', { willReadFrequently: true });
    c.fillStyle = colorStr;
    c.fillRect(0, 0, 1, 1);
    return Array.from(c.getImageData(0, 0, 1, 1).data);
}

/**
 * 从位压缩的 img.bin 按 rect 裁切出所有精灵帧
 * @param {string} fileName bin 文件路径
 * @param {string} foreground 陷阱前景色（默认）
 * @param {string} background 陷阱背景色（默认）
 * @param {object} frameRects { 名称: {x,y,w,h,fg?,bg?} }，rect 可覆盖配色
 * @returns {Promise<object>} 名称 → ImageBitmap
 */
async function initializeSpriteFramesFromBinFile(fileName, foreground, background, frameRects) {
    const fileResponse = await fetch(fileName);
    if (!fileResponse.ok) throw new Error(`Failed to fetch file for ${fileName}`);
    const view = new DataView(await fileResponse.arrayBuffer());
    // 行宽 = 最大 rect 右边界（须为 8 的倍数）
    const rowWidth = Math.max(...Object.values(frameRects).map(r => r.x + r.w));
    const rowBytes = rowWidth / 8;
    const rowCount = view.byteLength / rowBytes;
    // 解码为逐像素 0/1 位数组
    const bits = [];
    for (let row = 0; row < rowCount; row++) {
        let lineString = '';
        for (let b = 0; b < rowBytes; b++) {
            lineString += view.getUint8(row * rowBytes + b).toString(2).padStart(8, '0');
        }
        for (let px = 0; px < rowWidth; px++) bits.push(lineString[px]);
    }
    const fg = cssColorToRGBA(foreground);
    const bg = cssColorToRGBA(background);
    const cache = {};
    for (const name in frameRects) {
        const r = frameRects[name];
        const rfg = r.fg ? cssColorToRGBA(r.fg) : fg;
        const rbg = r.bg ? cssColorToRGBA(r.bg) : bg;
        const cvs = document.createElement('canvas');
        cvs.width = r.w;
        cvs.height = r.h;
        const c = cvs.getContext('2d');
        const img = c.createImageData(r.w, r.h);
        const d = img.data;
        for (let y = 0; y < r.h; y++) {
            for (let x = 0; x < r.w; x++) {
                const col = bits[(r.y + y) * rowWidth + (r.x + x)] === '1' ? rfg : rbg;
                const o = (y * r.w + x) * 4;
                d[o] = col[0];
                d[o + 1] = col[1];
                d[o + 2] = col[2];
                d[o + 3] = col[3];
            }
        }
        c.putImageData(img, 0, 0);
        cache[name] = await createImageBitmap(cvs);
    }
    return cache;
}

