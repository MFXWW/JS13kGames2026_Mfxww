from sys import exit, argv
from bin_file import bin_str_to_bin_file
import argparse
from PIL import Image, ImageColor
import json
from os import listdir

arg_parser = argparse.ArgumentParser(description="Dual-color sprite combiner (vertical or horizontal layout).")
arg_parser.add_argument("--foreground-color", type=str, default="#000000", help="The color to use for the foreground sprites.")
arg_parser.add_argument("--background-color", type=str, default="#ff0000", help="The color to use for the background sprites.")
arg_parser.add_argument("--output-file", type=str, default="img.bin", help="The output file to save the combined sprites.")
arg_parser.add_argument("--input-dir", type=str, default="processing_images", help="Directory containing the input .png files.")
arg_parser.add_argument("--row-width", type=int, default=16, help="Bits (pixels) per encoded row.")
arg_parser.add_argument("--horizontal", action="store_true", help="Place images side by side into one horizontal strip.")
arg_parser.add_argument("--no-index", action="store_true", help="Skip the .index JSON (rects are provided by the game code).")

args = arg_parser.parse_args()
settings = {
    "row_width": args.row_width,
    "foreground_color": tuple(ImageColor.getrgb(args.foreground_color)),
    "background_color": tuple(ImageColor.getrgb(args.background_color)),
    "input_dir": args.input_dir,
    "input_files": [args.input_dir + '\\' + f for f in listdir(args.input_dir)],
    "output_file": args.output_file,
    "horizontal": args.horizontal,
    "no_index": args.no_index,
}
for filename in settings["input_files"].copy():
    if not filename.endswith(".png"):
        print(f"Warning: {filename} is not a png file, skipped.")
        settings["input_files"].remove(filename)
print(json.dumps(settings, indent=4))

# 每项: (文件名, 宽, 高, 按行拼接的0/1字符串)
images_data = []
origin_images = [Image.open(file) for file in settings["input_files"]]

for name, image in zip(settings["input_files"], origin_images):
    pix = image.load()
    if pix is None:
        continue
    w, h = image.size
    stringified_pix = ""
    for y in range(h):
        for x in range(w):
            p = pix[x, y]
            if len(p) == 4 and p[3] == 0:
                stringified_pix += "0"  # 全透明像素视为背景（空白）
            elif p[:3] == settings["foreground_color"]:
                stringified_pix += "1"
            elif p[:3] == settings["background_color"]:
                stringified_pix += "0"
            else:
                print(f"Error: {image.filename} contains unknown color {p} at ({x}, {y}).")
                stringified_pix += "?"
    if "?" in stringified_pix:
        continue
    # 预览（按图片自身宽度打印）
    for line_index in range(0, len(stringified_pix), w):
        print(stringified_pix[line_index:line_index + w].replace("0", " ").replace("1", "█"))
    print()
    images_data.append((name, w, h, stringified_pix))

if not images_data:
    raise SystemExit("Error: no valid images to combine.")

if settings["horizontal"]:
    heights = {h for (_, _, h, _) in images_data}
    if len(heights) != 1:
        raise SystemExit("Error: horizontal layout requires all images to have the same height.")
    total_width = sum(w for (_, w, _, _) in images_data)
    if total_width != settings["row_width"]:
        raise SystemExit(f"Error: sum of image widths {total_width} != --row-width {settings['row_width']}")
    height = next(iter(heights))
    combined = ""
    positions = []
    x = 0
    for (_, w, _, _) in images_data:
        positions.append((x, 0))
        x += w
    for y in range(height):
        for (_, w, _, sp) in images_data:
            combined += sp[y * w:(y + 1) * w]
else:
    for (_, w, _, _) in images_data:
        if w != settings["row_width"]:
            raise SystemExit(f"Error: image width {w} != --row-width {settings['row_width']}")
    combined = "".join(sp for (_, _, _, sp) in images_data)
    positions = []
    y = 0
    for (_, _, h, _) in images_data:
        positions.append((0, y))
        y += h

bin_str_to_bin_file(combined, settings["output_file"])

if not settings["no_index"]:
    exporting_data = {}
    for (name, w, h, _), (px, py) in zip(images_data, positions):
        exporting_data[name.split("\\")[-1]] = {"size": [w, h], "position": [px, py]}
    with open(settings["output_file"] + '.index', 'w') as f:
        json.dump(exporting_data, f, indent=4)
print(f"Combined bin file saved to {settings['output_file']}.")
