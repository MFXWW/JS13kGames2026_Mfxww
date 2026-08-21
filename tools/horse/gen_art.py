from PIL import Image

W, H = 32, 32
FG = (0, 0, 0)      # 马体黑色（combiner 前景色）
BG = (255, 0, 0)    # 背景红色（combiner 背景色 = 透明）


def new_canvas():
    return [[BG] * W for _ in range(H)]


def fill(c, x0, y0, x1, y1, color=FG):
    x0, x1 = max(0, x0), min(W - 1, x1)
    y0, y1 = max(0, y0), min(H - 1, y1)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            c[y][x] = color


def pixel(c, x, y, color=FG):
    if 0 <= x < W and 0 <= y < H:
        c[y][x] = color


# ===================== 几何马 =====================
# 设计原则：纯几何形状（矩形、三角形、45° 斜线），
# 无椭圆/曲线，辨识度靠：棱角分明的长脸、三角耳、锯齿鬃毛、矩形身体。

def body(c, tail_up=False):
    # --- 尾巴（三角形）---
    if tail_up:
        fill(c, 3, 4, 4, 5)
        fill(c, 4, 6, 5, 6)
        pixel(c, 5, 7)
    else:
        fill(c, 5, 7, 6, 10)
        fill(c, 4, 8, 5, 9)

    # --- 身体（矩形 + 棱角肩）---
    fill(c, 9, 6, 18, 9)
    pixel(c, 8, 7)
    pixel(c, 8, 8)
    pixel(c, 19, 7)
    pixel(c, 19, 8)

    # --- 脖子（竖条 + 45° 肩斜）---
    fill(c, 20, 4, 21, 9)
    pixel(c, 22, 5)
    pixel(c, 22, 6)
    pixel(c, 22, 7)

    # --- 头（梯形，朝右，辨识度核心）---
    fill(c, 23, 4, 25, 7)   # 后脑（宽）
    fill(c, 25, 3, 28, 6)   # 中段
    fill(c, 28, 3, 30, 5)   # 鼻梁收窄
    pixel(c, 31, 4)          # 鼻尖

    # --- 耳（小三角）---
    pixel(c, 26, 1)
    pixel(c, 27, 0)
    pixel(c, 27, 1)

    # --- 鬃毛（沿脖子锯齿）---
    pixel(c, 20, 3)
    pixel(c, 21, 2)
    pixel(c, 22, 2)
    pixel(c, 22, 3)


def leg(c, x, bottom):
    fill(c, x, 10, x + 1, bottom)


def horse_idle():
    c = new_canvas()
    body(c, tail_up=False)
    leg(c, 10, 14)
    leg(c, 13, 14)
    leg(c, 16, 14)
    leg(c, 19, 14)
    return c


def horse_run1():
    c = new_canvas()
    body(c, tail_up=True)
    leg(c, 10, 14)
    leg(c, 13, 14)
    leg(c, 16, 12)
    leg(c, 19, 12)
    return c


def horse_run2():
    c = new_canvas()
    body(c, tail_up=True)
    leg(c, 10, 12)
    leg(c, 13, 12)
    leg(c, 16, 14)
    leg(c, 19, 14)
    return c


def horse_run3():
    c = new_canvas()
    body(c, tail_up=True)
    leg(c, 10, 14)
    leg(c, 13, 12)
    leg(c, 16, 12)
    leg(c, 19, 14)
    return c


def horse_jump():
    c = new_canvas()
    body(c, tail_up=True)
    leg(c, 10, 11)
    leg(c, 13, 11)
    leg(c, 16, 11)
    leg(c, 19, 11)
    return c


def save(name, canvas):
    img = Image.new('RGB', (W, H))
    img.putdata([pix for row in canvas for pix in row])
    img.save(f'frames/{name}.png')


def make_preview():
    """生成 5 帧横向拼接的预览图（缩放 6 倍）"""
    names = ['idle', 'run1', 'run2', 'run3', 'jumping']
    scale = 6
    gap = 4
    cols = len(names)
    preview = Image.new('RGB', (W * cols * scale + gap * (cols - 1), H * scale), BG)
    for i, name in enumerate(names):
        img = Image.open(f'frames/{name}.png')
        img = img.resize((W * scale, H * scale), Image.NEAREST)
        preview.paste(img, (i * (W * scale + gap), 0))
    preview.save('_preview.png')
    print(f'preview saved to _preview.png ({preview.size[0]}x{preview.size[1]})')


def main():
    frames = {
        'idle': horse_idle,
        'run1': horse_run1,
        'run2': horse_run2,
        'run3': horse_run3,
        'jumping': horse_jump,
    }
    for name, fn in frames.items():
        save(name, fn())
        print(f'generated {name}.png')
    make_preview()


if __name__ == '__main__':
    main()
