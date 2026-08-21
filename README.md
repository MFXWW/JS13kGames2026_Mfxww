# Fallen rainbow

> **Fall. Die. Rise. Repeat.**  
> 一款像素风平台跳跃游戏，围绕「死亡与轮回」的核心机制展开。

---

## 概述

穿过 12 章的常规关卡，在坠落尽头进入隐藏的第 13 章 **"The Abandoned Place"**。每一次死亡都是一次教训，每一次轮回都离真相更近一步。打通隐藏关可获得王冠，开启「 crowned cycle」。

- **关卡总数**：36 关（常规 32 + 走廊 + 隐藏章 × 3，未完成关卡自动跳过）
- **核心机制**：平台跳跃 + 机关解谜（浮板、按钮、蹦床、黑洞、单向平台等）
- **视觉风格**：双色像素风（每章独特色彩主题）
- **操作**：键盘 — `A/D` 或 `←/→` 移动，`W/空格/↑` 跳跃，`R` 自杀重来

---

## 快速开始

### 运行游戏

项目使用 **纯静态前端**（HTML + Canvas + JavaScript），无需构建工具。需要本地 HTTP 服务器（因 `fetch()` 加载二进制关卡文件）：

```bash
# 进入项目目录
cd 13_times_of_death_V2

# 方式一：Python（推荐）
python -m http.server 8000

# 方式二：双击 localServer.bat
```

浏览器打开 `http://localhost:8000` 即可游玩。

### 编译（生产环境压缩）

```bash
# 需要安装 terser
npm install -g terser

# 运行编译脚本
terser_compile.bat
```

编译产物输出至 `compiled/` 目录，可直接部署。

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
│   │   ├── game_core.js    # 核心循环、关卡管理、输入处理
│   │   ├── level_parser.js # 二进制关卡解析
│   │   ├── ui.js           # DOM 获取与 class 切换（id/class 名集中于此）
│   │   ├── copy.js / entities.js / utils.js / sound.js / traps.js
│   │   └── traps/          # trap_bounce / trap_button / trap_blackhole / trap_destination / trap_floatrect / trap_oneway
│   └── assets/             # 运行资源
│       ├── img.bin         # 精灵图二进制
│       └── lvl/            # 关卡 .bin（1-1 ~ 13-3、corridor、12-2-void）
├── build/                  # 构建脚本（npm run build 或直接跑 build_all.bat）
│   ├── build_all.bat       # 一键构建：dom_rename → terser → roadroller → 资源 → zopfli zip
│   ├── terser_compile.bat  # terser 压缩（读 src/js，产出 dist/game.min.js）
│   ├── dom_rename.js       # 构建时把 id/class 名改成短名（a-r/s-z）+ 生成 dist/index.html
│   ├── css_min.js          # CSS 压缩
│   └── zopfli_zip.js       # 最优 deflate 打 zip
├── tools/                  # 辅助工具
│   ├── level_editor/       # 可视化关卡编辑器 + 文本→二进制编译器
│   ├── bmp_combiner/       # 精灵图合成（combine.bat 产出 src/assets/img.bin）
│   └── horse/              # 玩家精灵源文件
├── dist/                   # 构建产物（可直接部署）
│   ├── index.html          # 入口（id/class 已短名化，CSS 已压缩）
│   ├── game.rolled.js      # roadroller 压缩后的完整游戏
│   ├── img.bin / lvl/lvl.bin
│   └── fallen_rainbow.zip  # 交付包
└── localServer.bat         # 本地服务器（开发 /src/，生产 /dist/）
```

构建：`npm run build` 或 `build\build_all.bat`。改 UI 只动 `src/index.html` + `src/js/ui.js`，其余勿改（构建时统一压缩/改名）。

---

## 关卡结构

### 常规关卡（第 1~12 章）

1-7 章与第 9 章每章 3 关，8、10~12 章每章 2 关，共 32 关。每章有独立的双色主题（未完成的关卡会在流程中自动跳过）：

| 章 | 关数 | 背景色 | 前景色 | 主题意象 |
|----|------|--------|--------|----------|
| 1  | 3 | 金色 | 棕色 | 初识 |
| 2  | 3 | 紫色 | 亮紫 | 迷雾 |
| 3  | 3 | 蓝色 | 深蓝 | 深渊 |
| 4  | 3 | 红色 | 暗红 | 愤怒 |
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

游戏使用双色像素精灵图，通过 Python 脚本合成：

1. 将 `.png` 素材放入 `bmp_combiner/processing_images/`
2. 运行 `combine.bat` 生成 `img.bin` 和 `img.bin.index`
3. 将生成的 `img.bin` / `img.bin.index` 复制到项目根目录

游戏启动时通过 `img.bin` + `img.bin.index` 加载所有精灵帧并缓存。

---

## 技术要点

- **渲染**：Canvas 2D，像素级渲染（`imageRendering: pixelated`）
- **音效**：Web Audio API，程序化生成（OscillatorNode），无外部音频文件
- **关卡存储**：自定义位流编码，MSB-first，支持半步/四分之一步精度坐标
- **配色生成**：基于种子的 HSL 算法，确保每局色彩一致
- **循环体系**：通关最后一关（12-2）轮回到 1-1（普通轮回）；打通隐藏关获得王冠（ crowned cycle）

---

## 许可证

MIT License
