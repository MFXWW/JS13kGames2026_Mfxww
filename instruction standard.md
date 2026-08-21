# 统一关卡二进制数据规范

本规范定义关卡文件的二进制布局和字段位宽。位置字段采用“半步精度”编码：用最后一位表示 0.5（权重为 0.5），前面的位表示整数部分。move 指令的 duration 字段采用“四分之一步精度”编码：用最后两位表示 0、0.25、0.5 和 0.75。

## 总体约定

- 位序：按从高位到低位顺序写入/读取（MSB-first）。
- 计数字段位宽：map 命令数、对象数、脚本指令数均为 7 位（0..127）。
- 字节对齐：位串在写入后按字节边界右侧补 0。

### 1. Map 区块

- base: 1 bit（1 = solid，0 = empty）
- command_count: 7 bits
- 每条命令共 19 bits：
  - type: 1 bit（1 = solid，0 = empty）
  - startX: 5 bits (0..31)
  - startY: 4 bits (0..15)
  - endX: 5 bits (0..31)
  - endY: 4 bits (0..15)

写入顺序：base (1) → command_count (7) → N × [type(1) startX(5) startY(4) endX(5) endY(4)]。

最大命令数受 7 位限制（127）。解析器应先根据 base 初始化地图（例如 32×16），再按命令修改。

### 2. Object 区块

- object_count: 7 bits
- 每个对象最小字段（19 bits）：
  - type: 4 bits（类型映射，例如 blackhole=0000, floatrect=0001, button=0010, bounce=0011, destination=0100, oneway=0101）
  - object_index: 6 bits
  - x: 5 bits (0..31)
  - y: 4 bits (0..15)
- 对于具有尺寸的对象（如 `floatrect`），额外字段：width:5 bits，height:4 bits。
- 对于 `oneway`（单向平台），额外字段：width:5 bits（**不含 height**，高度固定为 1 格）。
- **所有类型的末尾**统一带有 hidden(1) + noCollision(1) 标志位。

#### Object 类型映射

| type 编码 | 类型 | 额外字段 |
| --------- | ---- | -------- |
| `0000` | blackhole（黑洞） | 无 + hidden(1) + noCollision(1) |
| `0001` | floatrect（浮动矩形） | width(5) + height(4) + hidden(1) + noCollision(1) |
| `0010` | button（按钮） | 无 + hidden(1) + noCollision(1) |
| `0011` | bounce（蹦床） | 无 + hidden(1) + noCollision(1) |
| `0100` | destination（终点） | 无 + hidden(1) + noCollision(1) |
| `0101` | oneway（单向平台） | width(5) + hidden(1) + noCollision(1) |

写入顺序：object_count (7) → 对象列表，每个对象按上面字段顺序写入。

> **hidden(1)** — 值为 `1` 时陷阱被隐藏（不渲染贴图/颜色，仅编辑器可见红色边框）。
> **noCollision(1)** — 值为 `1` 时陷阱无碰撞体积，玩家可自由穿透；碰撞事件（如触发按钮、踩蹦床、接触黑洞、到达终点、平台携带玩家）均不会触发。机关动画（如黑洞脉动）仍会播放。
> 在源文本中使用 `-hidden` 与 `-no-collision` 标志定义，例如：`floatrect fr1 8 7 2 9 -hidden -no-collision`

### 3. Script 区块

- instruction_count: 7 bits
- 每条指令以 1 bit 类型位开始：instr_type（1 = move，0 = wait）

#### move 指令（位宽25bit/条）

- instr_type: 1 bit (值 '1')
- object_index: 6 bits
- x: 6 bits（含半步精度）
  - 编码规则：前 5 位为整数部分（0..31），最后 1 位为 0.5 标志（0 = 0，1 = +0.5）。因此 x 可表示为 0..31.5，超限应裁剪并发出警告。
- y: 5 bits（含半步精度）
  - 编码规则：前 4 位为整数部分（0..15），最后 1 位为 0.5 标志（0 = 0，1 = +0.5）。因此 y 可表示为 0..15.5，超限应裁剪并发出警告。
- duration: 6 bits（四分之一步精度）
  - 编码规则：前 4 位为整数部分（0..15），最后 2 位为 0.25、0.5、0.75 标志（00=0，01=0.25，10=0.5，11=0.75）。因此可表示的最大时间为 15.75 单位。若数值超限应裁剪并发出警告。
- block_flag: 1 bit（脚本是否在此动作完成前阻塞）

示例（move fr1 2.5）→ durationVal = 2.5 → intPart=2 -> 前4位 "0010"，四分之一位=2 -> duration bits = "001010"（代表 2.5）。
示例（move fr1 x=3.5 y=7）→ x 整数 3 -> 前5位 "00011"，半位=1 -> x bits = "000111"（6 位）；y 整数 7 -> 前4位 "0111"，半位=0 -> y bits = "01110"（5 位）。

#### wait 指令（变长，含 instr_type=0 与 2-bit eventType）

- instr_type: 1 bit (值 '0')
- event_type: 2 bits
  - 00 = player-in-area → x1(5) y1(4) width(3) height(3)  （共 1+2+15 = 18 bits，宽高范围1~7）
  - 01 = button-press → object_index(6)                 （共 1+2+6  = 9 bits）
  - 10 = for-seconds → seconds(6)                      （共 1+2+6  = 9 bits，半步精度：前5位整数0~31，末位0.5标志）

写入顺序：instruction_count (7) → 每条指令的位序（instr_type → 其余字段）。

## 兼容性与注意事项

- 编译器与解析器必须对 duration 字段采用相同的四分之一步编码；否则会产生数值偏差（此前发现解析器将最低位当作 0.5，但编译器写作整数）。
- for-seconds 采用半步编码（5位整数0~31 + 1位0.5标志），最大可表示 31.5 秒。旧版以整数编码（6位0~63），修改此编码后需重新编译所有含 for-seconds 的关卡文件。
- 半步编码将最大可表示整数范围从 31 缩小为 15（若需要更大范围，请改用更多位或不同协议）。
- object_index 使用 6 位（0..63），确保对象数量与引用不会超出此范围。
- player-in-area 的宽高已从 x2(5)/y2(4) 改为 width(3)/height(3)（范围1~7），修改后需重新编译所有含 player-in-area 的关卡文件。源文本格式同步改为 `wait player-in-area <x1> <y1> <width> <height>`。

## 示例位串片段（说明）

- map base solid + 1 command (示例): 1 (base) + 0000001 (count=1) + [type startX startY endX endY]
- script move 示例（move obj0 x=2 y=3 duration=1.5 block）:
  - instr_type: 1
  - object_index: 000000
  - x: 00010（整数2）→ 补半步0 → 000100
  - y: 0011（整数3）→ 补半步0 → 00110
  - duration (1.5): int=1 -> 0001，四分之一位=2（0.5）-> 10 → 000110
  - block_flag: 1

---
本文件与实现相关：`level_parser.js`、`lvl/level_compiler.js`。请在修改任一端实现后同步更新另一端实现以及更新此文档。
