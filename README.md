# Fallen rainbow

> **Fall. Die. Rise. Repeat.**  
> 一款像素风平台跳跃游戏，围绕「死亡与轮回」的核心机制展开。

---

## 概述

穿过 12 章的常规关卡，在坠落尽头进入隐藏的第 13 章 **"The Abandoned Place"**。每一次死亡都是一次教训，每一次轮回都离真相更近一步。打通隐藏关可获得王冠，开启「 crowned cycle」。

- **关卡总数**：35 关（常规 31 + 走廊 + 隐藏章 × 3）
- **核心机制**：平台跳跃 + 机关解谜（浮板、按钮、蹦床、黑洞、单向平台等）
- **视觉风格**：双色像素风（每章独特色彩主题）
- **操作**：键盘 — `A/D` 或 `←/→` 移动，`W/空格/↑` 跳跃，`R` 自杀重来

---

## 快速开始

### 运行游戏

项目使用 **纯静态前端**（HTML + Canvas + JavaScript），资源在**打包页尾切片**读取（单文件），需本地 HTTP 服务器：

```bash
# 进入项目目录
cd 13_times_of_death_V2

# 启动本地服务器（方式一：Python；方式二：双击 localServer.bat）
python -m http.server 8000
```

- **日常游玩 / 生产**：先 `npm run build`，浏览器打开 `http://localhost:8000/dist/`（或直接解压部署 `dist/fallen_rainbow.zip` 内的单文件页面）
- **开发调试**（未压缩源码，便于查错）：先 `node build\_make_verify.js` 生成验证页，再打开 `http://localhost:8000/build/_verify/index.html`
  - 注意：源码按页尾切片加载 img/lvl，`/src/` 无打包尾数据不能直接运行，请用上面的 `_verify` 页调试

### 编译（生产环境压缩）

```bash
# 改了精灵图（陷阱/玩家）先重合成 img.bin
npm run combine:sprites      # 或 cmd /c tools\bmp_combiner\combine.bat

# 一键构建（dom_rename → terser → roadroller → 合并关卡 → 单文件 zip）
npm run build        # 或直接运行 build\build_all.bat
```

- 产物：`dist/fallen_rainbow.zip`（**单文件**：HTML+JS 内联、img/lvl 尾部追加，可直接部署）
- 硬约束：zip ≤ **13312 B**（js13k，13 × 1024），构建末尾会打印实际大小与是否 PASS

---

## 操作说明

| 按键 | 功能 |
|------|------|
| `A` / `←` | 向左移动 |
| `D` / `→` | 向右移动 |
| `W` / `空格` / `↑` | 跳跃 |
| `R` | 自杀（立即重试） |
| `空格`（死亡后） | 重新开始当前关卡 |

---

## 项目架构

```
13_times_of_death_V2/
├── package.json            # 项目元数据 + npm scripts（npm run build）
├── src/                    # 可读源码（唯一修改源）
│   ├── index.html          # 开发入口（多脚本 + 可读 CSS）
│   ├── js/                 # 游戏 JS
│   │   ├── game_core.js    # 核心循环、关卡管理、输入处理、镜头/相机
│   │   ├── level_parser.js # 二进制关卡解析
│   │   ├── ui.js           # DOM 获取与 class 切换（id/class 名集中于此）
│   │   ├── copy.js / entities.js / utils.js / sound.js / traps.js
│   │   └── traps/          # trap_bounce / trap_button / trap_blackhole / trap_destination / trap_floatrect / trap_oneway
│   └── assets/             # 运行资源
│       ├── img.bin         # 精灵图二进制（构建由 bmp_combiner 产出：陷阱 + 玩家）
│       └── lvl/            # lvl.bin：35 关合并 + 12-2 void 变体（u8 长度前缀，指针式加载）
├── build/                  # 构建脚本
│   ├── build_all.bat       # 一键构建：dom_rename → terser → roadroller → lvl_combine → package_single
│   ├── terser_compile.bat  # terser 压缩（读 src/js，产出 dist/game.min.js）
│   ├── dom_rename.js       # 构建时把 id/class 名改成短名 + 生成 dist/index.html
│   ├── css_min.js          # CSS 压缩
│   ├── package_single.js   # 单文件打包：内联 rolled + 尾部追加 img/lvl + zopfli 打 zip
│   ├── _make_verify.js     # 生成未压缩验证页 build/_verify/index.html（含 _verify/）
│   └── COMPRESSION_PLAN.md # 压缩达标历程记录
├── tools/                  # 辅助工具
│   ├── level_editor/       # 可视化关卡编辑器 + 文本→二进制编译器（含 level_sources/*.txt）
│   ├── bmp_combiner/       # 精灵图合成（combine.bat 产出 src/assets/img.bin：陷阱 112x16 + 玩家 24x24）
│   ├── unicorn_soul/       # 玩家像素形象源（unicorn.aseprite + unicorn.png，combine.bat 的输入）
│   ├── unicorn_canvas/     # 玩家矢量/像素动画原型（已合入，仅留参考）
│   └── colorGen.html       # 配色工具
├── dist/                   # 构建产物
│   ├── game.min.js / game.rolled.js   # 中间产物（terser / roadroller）
│   ├── index.html          # 单文件版入口（JS 内联 + 尾部 img/lvl）
│   └── fallen_rainbow.zip  # 交付包（≤ 13312 B）
├── release/                # 历次达标 zip 归档
├── homepage.md             # 提交/主页文案（叙事原文游离于 13KB 之外）
├── copy_plan.md            # 文案源计划（游戏流程各节点 → 文案映射）
├── IMPROVEMENT_PLAN.md     # 改进空间与建议
└── localServer.bat         # 本地服务器（serve 验证页）
```

构建：`npm run build` 或 `build\build_all.bat`。改 UI 只动 `src/index.html` + `src/js/ui.js`，其余勿改（构建时统一压缩/改名）。

---

## 关卡结构

### 常规关卡（第 1~12 章）

1~3、5~7、9 章每章 3 关，4、8、10~12 章每章 2 关，共 31 关。每章有独立的双色主题：

| 章 | 关数 | 背景色 | 前景色 | 主题意象 |
|----|------|--------|--------|----------|
| 1  | 3 | 金色 | 棕色 | 初识 |
| 2  | 3 | 紫色 | 亮紫 | 迷雾 |
| 3  | 3 | 蓝色 | 深蓝 | 深渊 |
| 4  | 2 | 红色 | 暗红 | 愤怒 |
| 5  | 3 | 绿色 | 深绿 | 欺骗 |
| 6  | 3 | 橙色 | 赤褐 | 熔炉 |
| 7  | 3 | 青色 | 墨绿 | 沉没 |
| 8  | 2 | 粉红 | 深玫 | 纠缠 |
| 9  | 3 | 天蓝 | 靛蓝 | 虚空 |
| 10 | 2 | 米色 | 棕褐 | 遗迹 |
| 11 | 2 | 灰蓝 | 深灰 | 沉寂 |
| 12 | 2 | 暗红 | 血红 | 终末 |

### 隐藏关卡 — The Abandoned Place（第 13 章）

从 12-2 坠落触发，经由走廊（corridor）进入。共 3 关，主题色为暗紫色系。**13-3 为倒置重力关卡**，玩家吸附于天花板，掉出地图顶部即通关；打通 13-3 后轮回至 1-1，获得王冠标记。

---

## 陷阱系统

| 陷阱 | 说明 |
|------|------|
| **FloatRect**（浮板） | 可移动平台，玩家可站在上面被携带移动 |
| **Button**（按钮） | 玩家接触触发，可配合脚本驱动机关 |
| **Bounce**（蹦床） | 将玩家弹起 |
| **BlackHole**（黑洞） | 接触即被吞没，播放像素环状坍缩特效 |
| **Destination**（终点） | 到达后通关 |
| **OneWay**（单向平台） | 仅可从上方穿过 |

所有陷阱支持 `-hidden`（隐藏）和 `-no-collision`（无碰撞）标志位。

---

## 关卡文件格式

关卡使用 **自定义二进制格式** 存储，分为三个区块：Map（地图瓦片）、Object（陷阱对象）、Script（脚本指令）。详见 `instruction standard.md`。

### 文本源文件示例

```
:map
base empty
solid 0 13 31 15

:object
floatrect fr1 0 5 32 1
button btn1 3 2
destination dest1 28 13

:script
wait player-in-area 2 1 1 1
move fr1 28 3 14 -block
wait button-press btn1
move dest1 1 13

:end
```

### 编译关卡

```bash
cd level_editor
node node_level_compiler.js     # 编译所有关卡
```

或双击 `levelCompiler.bat`。

---

## 精灵图工作流

游戏使用双色像素精灵图，通过 Python 脚本合成。**陷阱与玩家同走这一条管线**（玩家剪影也是位图帧，运行时不再逐像素程序绘制）：

1. 陷阱 `.png` 素材放入 `tools/bmp_combiner/processing_images/`；玩家形象为 `tools/unicorn_soul/unicorn.png`（24×24，纯黑 + 透明）
2. 运行 `tools\bmp_combiner\combine.bat`：
   - `unify_images.py` 合成 **136×24** 统一贴图（陷阱 112×16 单行 + 玩家 24×24 接在 x=112），配色归一为黑前景/透明背景
   - `combiner.py --row-width 136` 位压缩编码为 `src/assets/img.bin`（1 bit/像素，17 B/行）
3. 各帧在 `img.bin` 中的矩形由 `src/js/utils.js` 的 `GAME_SpriteRects` 提供（无独立 index 文件）；玩家帧键为 `soul`，带 `fg:'#000000'` 覆盖（陷阱用关卡主题色重染，玩家恒黑）
4. 打包后 `img.bin` 追加在单文件页尾，运行时按 `GAME_SpriteRects` 裁切成 `ImageBitmap` 缓存（`GAME_SpriteFrameCache`）

> 只改玩家贴图也要重跑 `combine.bat`（`build_all.bat` 不会自动重跑），然后 `build_all.bat` 打包。

---

## 技术要点

- **渲染**：Canvas 2D，像素级渲染（`imageRendering: pixelated`）。1 tile = 16 逻辑 px，内部 **2× 渲染**（32 px/格）
- **玩家**：碰撞箱 `0.75 × 1.125` 格（12×18 逻辑 px）；贴图为 `img.bin` 中的 **24×24 剪影帧**，**1 源像素 = 1 逻辑 px**（2× 变换下即 2 设备 px，整数倍无小数缩放），**底边对齐碰撞箱底、水平居中于箱**，按 `PLAYER_face` 水平镜像、按 `PLAYER_gravityDir` 上下翻转
- **滚动镜头**：视口（`GAME_viewW/H`）随窗口自适应（默认约 20×12 格，最大整关 32×16），相机以玩家碰撞箱中心为焦点并钳制在地图内；相机每帧按 `gameCamFollow` **指数缓动**（~10/s）平滑跟随，重生/换关等瞬移时立即对齐
- **音效**：Web Audio API，程序化生成（OscillatorNode），无外部音频文件
- **关卡存储**：自定义位流编码，MSB-first，支持半步/四分之一步精度坐标；35 关 + 12-2 void 变体合并为单一 `lvl.bin`（u8 长度前缀，指针式加载）
- **关卡配色**：陷阱位图用关卡主题色重染；拿冠后逐章 `desaturateColor` 褪色
- **循环体系**：通关最后一关（12-2）轮回到 1-1（普通轮回）；打通隐藏关获得王冠（ crowned cycle）
- **体积**：单文件交付 `fallen_rainbow.zip` ≤ **13312 B** 硬约束（roadroller + zopfli）

---

## 许可证

MIT License
