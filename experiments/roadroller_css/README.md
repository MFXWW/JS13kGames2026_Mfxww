# roadroller-css-exp

实验：**给 CSS 加"词法分析 + token 缩写"预处理层，喂给 roadroller 的 text 模型**，
验证能否让 roadroller 的核心（上下文混合 CM + rANS 熵编码）对 CSS 更有效，
逼近它对 JS 的压缩效果。

## 背景（为什么会有这个实验）

roadroller 对 JS 是 `js` 模式：先做词法分析（`prepareJs`），把高频标识符缩写成
单字符、对字符串引号单独建模型，再进同一个 CM+rANS 核心。对 CSS/Python 等只能
走 `text` 模式——纯文本、没有这些词法手段，压缩增益远低于 JS。

本实验想回答：**给 text 输入加一层"CSS 专用词法层"（tokenize → 高频 token 缩写），
能否换来接近 JS 模式的增益？**

## 目录

- `src/css-tokenizer.js` — CSS 词法分析器：严格可逆 token 化（空白/注释/字符串/url/数字+单位/ident/函数名/#hash/@keyword/标点）。保证 `tokenize→detokenize` 恒等，缩写绝不动字符串/url 内部。
- `src/abbrev.js` — 高频 token 统计 + 缩写选择 + 应用/还原 + 还原表编解码。缩写只发生在 ident/函数名，单字符均取自"原文绝不出现"的可打印 ASCII。
- `src/pipeline.js` — 管线组装：raw / min / min+abbr → roadroller(text)。
- `src/roadroller.js` — roadroller 封装：按游戏构建约定定位用户级安装（本实验不内置依赖）。
- `run/collect-samples.mjs` — 从游戏仓库抽取真实 CSS 到 `samples/`。
- `run/benchmark.mjs` — 三种强度管线 + deflate9 参照的对比。
- `run/roundtrip.mjs` — 可逆性校验。

## 用法

```
npm run samples   # 抽取 samples/*.css（首次）
npm run verify    # tokenize 可逆 / normalize 幂等 / abbr 还原恒等
npm run bench     # 对照基准（体积 = roadroller 产物再经 DEFLATE 的估算 zip 占用）
```

## 实验结论（2026-09-05，样本=游戏真实 UI/编辑器 CSS）

| 样本 | raw | deflate9 | rr+zip(raw) | min | rr+zip(min) | abbr content-only | abbr net(明文表) |
|---|---|---|---|---|---|---|---|
| game_ui.css | 5485 | 1500 | 1764 | 3932 | **1552** | 1406 | 1600 |
| level_editor.css | 11013 | 2486 | 2506 | 8214 | **2251** | 2112 | 2302 |
| unicorn.css | 3202 | 1299 | 1559 | 2262 | **1319** | 1176 | 1408 |

1. **roadroller 的 text 模式对 CSS 远不如 JS 模式**（此实验出发点成立），且在这些中小样本上
   **连 deflate9 都打不过**（raw 行 rr+zip > deflate9）。原因：CM 模型在重复性强的 CSS 上
   榨不出比 LZ 更多的油水，却要背负固定成本（解码器第二行 ~594B + 两行拆分在 DEFLATE 下
   不再共享字典）。
2. **词法化压缩（min：折叠空白/去注释）真实有效且零成本**：rr+zip -212~-255B
   （-10~-15%）。因为 CSS 里的换行/缩进/注释属于"唯一内容"，正好是 deflate 压不掉、
   而预处理能直接删掉的部分。（与游戏仓库既有经验一致：此管线只减"唯一内容"。）
3. **token 缩写对 roadroller 的模型侧有明确收益**：content-only（表免费）相对 min 再省
   139~146B——印证"把高频长词换成单字符能降低上下文模型的负担"这一 roadroller JS 模式的核心思想。
4. **但明文还原表成本（360~452B）吃掉了全部缩写收益，净值反而 +48~+89B**。
   关键差别就在这：roadroller JS 模式的缩写不需要明文表——它把"还原代码"生成进
   解码器第二行，随解码代码一起被 DEFLATE 高效压缩。纯 text 模式没有解码器生成能力，
   表只能当数据明文携带，太贵。

### 由此得到的下一步方向（按性价比）

- **A（推荐）词法化压缩 + deflate 直接上**：既然本规模下 deflate9 就优于 rr+zip，
  对中小 CSS 不必上 roadroller；`min` 层对 deflate9 同样有效（如 game_ui deflate9
  1500→1221），可直接并入游戏现有 CSS 压缩管线（对 `src/index.html` 的 style 块做词法化）。
- **B 让缩写可用：需要"解码器代码生成"**——复刻 roadroller JS 模式的做法，把
  `还原表 + 逐字符还原代码`生成成可执行 JS（第二行），使表随代码而非随数据走，
  才能兑现 content-only 那 ~140B 的模型侧收益。这是本实验下一里程碑（超出当前
  "基准对比脚手架"范围）。
- **C 大样本再评估**：CSS 与 JS 混入同一输入或显著更大的 CSS 集合时，固定解码器
  开销被摊薄，text 模式可能更有竞争力；本样本 3~11KB 偏小，对 roadroller 不利。

## 备注

- 体积口径与游戏一致：roadroller 产物（`firstLine+secondLine`）再过 zlib level9，
  近似 zip 内占用；未跑 `-O2`（数百次调参太慢），默认参数趋势一致。
- roadroller 安装位置：本机为用户级 `%USERPROFILE%\node_modules\roadroller`，
  与游戏构建 `npx --no-install roadroller` 指向同一份，勿在本实验内重复安装。
