from PIL import Image
import os

# 统一贴图：陷阱（processing_images）合成 112x16 横向单行，玩家剪影 24x24 接在右侧（x=112）。
# 统一配色为黑色前景 + 透明背景（陷阱红底在此归一）。
SHEET_W, SHEET_H = 136, 24
FG = (0, 0, 0, 255)
BG = (0, 0, 0, 0)
TRAP_BG = (255, 0, 0)  # 陷阱背景红

BASE = os.path.dirname(os.path.abspath(__file__))
TRAP_DIR = os.path.join(BASE, 'processing_images')
OUT_DIR = os.path.join(BASE, 'processing_images_unified')
PLAYER_PNG = os.path.join(BASE, '..', 'unicorn_soul', 'unicorn.png')

# (来源路径, x, y)：各陷阱帧按 16px 高横向排列（button 两帧为 16x8，贴顶放）；玩家接在陷阱右侧
layout = [
    (os.path.join(TRAP_DIR, 'black_hole1.png'),       0,  0),
    (os.path.join(TRAP_DIR, 'black_hole2.png'),      16,  0),
    (os.path.join(TRAP_DIR, 'bounce_default.png'),   32,  0),
    (os.path.join(TRAP_DIR, 'bounce_triggered.png'), 48,  0),
    (os.path.join(TRAP_DIR, 'button_default.png'),   64,  0),
    (os.path.join(TRAP_DIR, 'button_triggered.png'), 80,  0),
    (os.path.join(TRAP_DIR, 'destination.png'),      96,  0),
    (PLAYER_PNG,                                    112,  0),
]

sheet = Image.new('RGBA', (SHEET_W, SHEET_H), BG)
for src, x, y in layout:
    img = Image.open(src).convert('RGBA')
    sheet.paste(img, (x, y))

# 统一配色：透明/红 -> 透明，其余（黑）-> 黑
px = sheet.load()
for yy in range(SHEET_H):
    for xx in range(SHEET_W):
        r, g, b, a = px[xx, yy]
        if a == 0 or (r, g, b) == TRAP_BG:
            px[xx, yy] = BG
        else:
            px[xx, yy] = FG

os.makedirs(OUT_DIR, exist_ok=True)
out = os.path.join(OUT_DIR, 'spritesheet.png')
sheet.save(out)
print(f'saved {out} {sheet.size}')
