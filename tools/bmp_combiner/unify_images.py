from PIL import Image
import os

# 统一贴图：把陷阱（processing_images）与玩家帧（../horse）合成一张 192x32 横向贴图，
# 统一配色为黑色前景 + 透明背景（陷阱红底、玩家紫底在此归一）。
SHEET_W, SHEET_H = 192, 32
FG = (0, 0, 0, 255)
BG = (0, 0, 0, 0)
TRAP_BG = (255, 0, 0)  # 陷阱背景红

BASE = os.path.dirname(os.path.abspath(__file__))
TRAP_DIR = os.path.join(BASE, 'processing_images')
HORSE_DIR = os.path.abspath(os.path.join(BASE, '..', 'horse'))
OUT_DIR = os.path.join(BASE, 'processing_images_unified')

# (来源路径, x, y)：陷阱 3 列 x 32 高（6 个 16x16 单元，button 两帧合 1 单元），右侧为玩家 6 帧（24 宽）
layout = [
    (os.path.join(TRAP_DIR, 'black_hole1.png'),      0,  0),
    (os.path.join(TRAP_DIR, 'black_hole2.png'),      0, 16),
    (os.path.join(TRAP_DIR, 'bounce_default.png'),  16,  0),
    (os.path.join(TRAP_DIR, 'bounce_triggered.png'),16, 16),
    (os.path.join(TRAP_DIR, 'button_default.png'),  32,  0),
    (os.path.join(TRAP_DIR, 'button_triggered.png'),32,  8),
    (os.path.join(TRAP_DIR, 'destination.png'),     32, 16),
    (os.path.join(HORSE_DIR, 'idle.png'),           48,  0),
    (os.path.join(HORSE_DIR, 'jump.png'),           72,  0),
    (os.path.join(HORSE_DIR, 'run.png'),            96,  0),
]

sheet = Image.new('RGBA', (SHEET_W, SHEET_H), BG)
for src, x, y in layout:
    img = Image.open(src).convert('RGBA')
    sheet.paste(img, (x, y))

# 统一配色：透明/红 -> 透明，其余（黑/紫）-> 黑
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
