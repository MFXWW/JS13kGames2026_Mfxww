# 压缩计划 — 目标 ≤ 13312 B（2026-08-21 起草，明日执行）

## 现状基线（已实测）

| 项 | 值 |
| --- | --- |
| 当前 zip 实际大小 | **13540 B**（`dist/fallen_rainbow.zip`） |
| js13k 目标上限 | **13312 B**（13 × 1024） |
| 缺口 | **228 B** |

当前 4 文件组成（压缩后）：

| 文件 | 原始 | 压缩 | 备注 |
| --- | --- | --- | --- |
| `game.rolled.js` | 11692 | 8740 | roadroller -O2 产物 |
| `lvl/lvl.bin` | 2656 | 2531 | u16 长度前缀合并格式 |
| `index.html` | 4441 | 1311 | CSS 已压缩 |
| `img.bin` | 768 | 548 | 精灵位图 |

## 已模拟验证的方案（复用 build/`_zip_sim.js`、`_combo_test.js`、`_single_test.js`）

| 方案 | zip 大小 | 达标 | 说明 |
| --- | --- | --- | --- |
| A 短文件名 | 13504 | ✗ | 仅省 36，不够 |
| B 合并 img+lvl（3文件） | 13417 | ✗ | 仍超 105 |
| C html+img+lvl 合并（2文件） | 13325 | ✗ | 超 13，紧 |
| **C1 两文件**（html+img+lvl / g.js，it100） | **13305** | ✓ | 余量仅 7，偏紧 |
| **单文件**（JS 内联 + lvl+img 追加） | **13223** | ✓ | 余量 89，**最稳** |

结论：**仅靠打包重组（不改造加载逻辑）达不到 13312**（方案 C 仍超 13 B）。必须配合 lvl 前缀改 u8 与/或 JS 内联。

## 关键改动点

### 1. lvl 长度前缀 u16 → u8（约省 125 B，必做）

- 现状：`lvl.bin` 每关 2 字节 u16 长度前缀（`lvl_combine.js` 生成）。
- 模拟：`_combo_test.js` 的 `lvlU8()` 改为 1 字节前缀后整体更小。
- 改动：
  - `tools/level_editor/lvl_combine.js` — 写 u8 前缀
  - `src/js/game_core.js`（L290 附近 `fetch('lvl/lvl.bin')` 指针式加载）— 同步按 1 字节前缀解析
  - ⚠️ 关卡最多 127 块，单块 <256B，u8 安全；先验证所有 36 关加载正常

### 2. 打包重组（选其一）

- **首选「单文件」**：`index.html` 内联 `<script>game.rolled.js</script>`，尾部追加 `img.bin`+`lvl.bin`（lvl 用 u8）。JS 改为 `fetch('index.html')` 后按已知偏移 slice 出 img/lvl（需在尾部记录长度）。
- 备选「C1 两文件」：`index.html` 尾部追加 img+lvl，`g.js` 独立。改动更小，但余量仅 7 B，任何内容增长即超标。
- 对应改动：
  - `src/js/utils.js`（`initializeSpriteFramesFromBinFile` 的 `fetch('img.bin')`）
  - `src/js/game_core.js`（lvl fetch 同源偏移读）
  - 新增/改写 `build/` 打包脚本（替代当前 `build_all.bat` 的 copy 资源 + `zopfli_zip.js` 步骤）

### 3. 可选内容压缩（有余量后再做）

- `copy.js` 文案（2713 B，叙事内容）— 压缩即改内容，需用户确认每处。
- `roadroller` 参数：已用 -O2；可试更多 iteration 的 zopfli（it100 只省 1-3 B）。
- 备用：`-D` dirty 模式（省 ~40 B，有单字母冲突风险，弃用）。

## 执行步骤（明日顺序）

1. 备份当前 `dist/` 与 `src/`（快照目录 `Desktop/13tod_snapshots/`）。
2. 改 `lvl_combine.js` + `game_core.js` 为 u8 前缀 → 重跑 build，浏览器验证 36 关。
3. 实施「单文件」重组（内联 JS + 尾部数据 + 偏移读取）→ 重打包，确认 zip ≤ 13312。
4. 用 `node build/_single_test.js` 等脚本复核模拟值与实际一致。
5. 浏览器完整通关验证（含隐藏关、王冠循环），确认无 fetch/解析回归。
6. 达标后提交 git，tag 记录。

## 验证清单

- [x] zip 实际字节 ≤ 13312（`(Get-Item dist/fallen_rainbow.zip).Length`）→ **13245 B**
- [x] Expand-Archive 与 7z 双端可解压 → 通过，hash 与 dist/index.html 一致
- [x] 36 关全部可加载、无控制台报错 → verify 页 0 错误
- [x] 隐藏关入口（12-2 坠落、13-3 掉顶）正常 → 12-2 无冠走 void 偏移、13-3 重力 -1
- [x] 王冠抉择/真结局/死亡计数正常 → 死亡计数 +1、抉择覆盖层在

---

## 执行结果（2026-08-22）

**达标：zip 13540 → 13245 B（余量 67）。**

| 改动 | 文件 | 说明 |
| --- | --- | --- |
| ① lvl u16→u8 | `tools/level_editor/lvl_combine.js`、`src/js/game_core.js` | lvl.bin 2656→2619 B；偏移扫描与长度读改 1 字节 |
| ② 单文件打包 | `build/package_single.js`（新增） | 取代 zopfli_zip.js：内联 rolled + 尾部 `<!--\n`+img+lvl+footer(2×u16 BE) + 打单文件 zip |
| ③ JS 侧切片 | `src/js/utils.js` | 新增 `gameAssetsLoaded()`（fetch 页 → 读 footer → slice），`initializeSpriteFramesFromBinFile`/`gameEnsureLvlLoaded` 共用 |
| ④ 构建流程 | `build/build_all.bat` | 第 3 步改为 lvl_combine + package_single.js |
| ⑤ 复核脚本 | `build/_single_test.js` | 改写为实际产物复核（footer 解析 + 达标检查） |
| ⑥ 验证页 | `build/_make_verify.js`、`build/_verify/` | 未压缩 src 脚本 + 追加数据，供逐关验证 |

**关键实现点**：尾部二进制用未闭合 HTML 注释 `<!--\n` 包裹到 EOF → 不渲染、不占布局；footer 仍在文件最末 4 字节，JS 偏移逻辑不变；打包脚本拒检 `-->`/`--!>` 序列。

**模拟 13223 vs 实际 13245**：差值来自单文件加载代码新增 ~90 minified 字节（模拟未计 fetch 逻辑改造成本）。

**遗留/上报**：
- `/src/` dev 页因 fetch 改为页尾切片而失效；dev/验证改用 `node build/_make_verify.js` → serve `build/_verify/index.html`。工作流需用户确认。
- 冗余空间：若需更大余量，可压缩 copy.js 文案（改内容，需确认）或重排 img.bin 布局。
- `_combo_test.js`/`_zip_sim.js` 已删除（建模已废弃的多文件方案）。
