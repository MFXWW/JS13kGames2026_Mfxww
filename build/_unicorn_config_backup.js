/* Unicorn 矢量画布原型
 *
 * 目标：先用 HTML/CSS 搭出“pixelated 画布”，再用 Canvas 画一只
 * 全部由矢量几何组成的简易独角兽：
 *   - 方形身体 / 四条粗线腿 / 斜置方形脖子 / 三角形头 / 头上的金色角
 *
 * 说明：本页只做【原地动画演示】，角色不产生实际位移。
 *   待机(默认) → A/D 切换朝向 + 原地奔跑步态 → Space 跳跃(1s 滞空动画)
 *
 * 坐标系统：身体中心为局部原点 (0,0)，+x 朝右，+y 朝下；
 * 角色始终站在画面固定位置 bodyX，用 ctx.scale(dir) 实现左右镜像朝向。
 * 数值集中在 CONFIG，部件绘制函数与主循环解耦，方便迁移进游戏。
 */
(function () {
  'use strict';

  // ================= CONFIG =================
  const CONFIG = {
    // 画布逻辑尺寸（CSS 负责整数倍放大成像素颗粒）
    W: 96,
    H: 120,

    // 站位（固定，不移动）
    bodyX: 44,        // 身体中心画布 x（原地演示，居中偏右留头）
    bodyCy: 72,       // 站地时身体中心的画布 y

    color: {
      body: '#efe6fb',
      neck: '#dcc9f2',
      head: '#f7f0ff',
      legFar: '#9c86c9',
      legNear: '#cdb8ec',
      horn: '#ffd66b',
      eye: '#2a2440',
      ground: 'rgba(0,0,0,0.35)',
      bg: '#0b0c12',
    },

    // --- 身体（方形/略长方形块）---
    body: { w: 26, h: 20 },

    // --- 腿：髋部沿身体底缘分布，粗线向下到地面 ---
    leg: {
      len: 22,          // 腿长（髋部到底）
      farW: 6,
      nearW: 6,
      swingAmp: 0.55,   // 奔跑摆动幅度(弧度)
      bobAmp: 1.3,      // 奔跑起伏
    },
    // x: 髋部横坐标(局部), part 前/后, near 远/近(颜色/粗细/绘制层)
    // 奔跑是对角步态：前左+后右(diag A) 同步、前右+后左(diag B) 同步、两组反相。
    // 侧视看“前后腿分别几乎重合”，远/近腿的髋点只差一点缝以示纵深。
    legs: [
      { x: -8, part: 'back',  near: false, diag: 'B' },  // 后左(远)
      { x: -6.5, part: 'back',  near: true,  diag: 'A' },  // 后右(近)
      { x:  6.5, part: 'front', near: false, diag: 'A' },  // 前左(远)
      { x:  8, part: 'front', near: true,  diag: 'B' },  // 前右(近)
    ],

    // --- 脖子：梯形，近头窄、近身宽；与身体同色 ---
    neck: { baseX: 7, baseY: -7, dir: { x: 11, y: -20 }, wTop: 4, wBase: 16 },

    // --- 头：三角形 ---
    // offX/offY: 相对脖子端点(neckTop)的整体偏移，微调头与脖子的衔接
    head: { len: 20, rise: -1, baseW: 12, ang: 3, offX: -2, offY: 0 },

    // --- 角 ---
    horn: { len: 16, baseW: 7 },

    // --- 跳跃动画 ---
    jump: {
      h: 17,            // 跳跃最高抬升(逻辑像素)
      dur: 1.0,         // 一次跳跃总时长(秒)
    },

    // --- 步态频率(基准) ---
    runFreq: 3.64,      // 步态周期倍数(弧度/秒)，调节“腿摆多快”
  };

  // 反推抛物线：以 1 秒周期、最高点 17 像素给出近似正弦上升/下落
  // 我们直接用正弦分段，不需要真实重力，见 update()。

  // ================= DOM =================
  const canvas = document.getElementById('stage');
  const mainCtx = canvas.getContext('2d');
  // 离屏画布：始终按“朝右”渲染整只独角兽，最后按 dir 整块位图翻转
  const off = document.createElement('canvas');
  off.width = CONFIG.W;
  off.height = CONFIG.H;
  const offCtx = off.getContext('2d');
  // 位图翻转贴回时保持像素锐利（配合 CSS 的 pixelated 放大）
  mainCtx.imageSmoothingEnabled = false;
  // 部件绘制统一写到离屏（= 朝右那一版），背景画在主画布
  let ctx = offCtx;
  const gridEl = document.getElementById('grid');
  const btnPlay = document.getElementById('btnPlay');
  const gridToggle = document.getElementById('gridToggle');

  const state = {
    running: true,
    last: performance.now(),
    // 演示状态
    dir: 1,               // 1=朝右, -1=朝左（仅镜像朝向，不产生位移）
    onGround: true,
    airT: 0,              // 滞空计时(0~jump.dur)
    runPhase: 0,          // 奔跑步态相位
    idlePhase: 0,
  };

  // 输入状态
  const keys = { left: false, right: false, jumpBuf: false };

  // ================= 小工具 =================
  const TAU = Math.PI * 2;

  function poly(points, c, stroke) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function thickLine(x1, y1, x2, y2, c, w) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // 绕 (cx,cy) 旋转 (x,y)
  function rot(x, y, cx, cy, rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    const dx = x - cx, dy = y - cy;
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  }

  // ================= 部件绘制（局部坐标，原点=身体中心） =================
  // 地面在局部坐标下的 y
  function groundLocal() {
    return CONFIG.body.h / 2 + CONFIG.leg.len;
  }

  function drawBody() {
    const b = CONFIG.body;
    poly([
      [-b.w / 2, -b.h / 2],
      [b.w / 2, -b.h / 2],
      [b.w / 2, b.h / 2],
      [-b.w / 2, b.h / 2],
    ], CONFIG.color.body, 'rgba(0,0,0,0.15)');
  }

  // 一条腿：绕髋部 (cfg.x, h/2) 旋转 angle，长度乘 lenK(滞空收腿用)
  function drawLeg(cfg, angle, col, w, lenK) {
    const b = CONFIG.body;
    const hx = cfg.x, hy = b.h / 2;
    const len = CONFIG.leg.len * (lenK == null ? 1 : lenK);
    const fx = hx + Math.sin(angle) * len;
    const fy = hy + Math.cos(angle) * len;
    thickLine(hx, hy, fx, fy, col, w);
  }

  // 脖子：梯形(近头窄 wTop、近身宽 wBase)，用与身体相同的颜色/描边
  function drawNeck() {
    const n = CONFIG.neck;
    const len = Math.hypot(n.dir.x, n.dir.y);
    const dx = n.dir.x / len, dy = n.dir.y / len;
    // 垂直方向单位向量
    const px = -dy, py = dx;
    const x0 = n.baseX, y0 = n.baseY;              // 近身体端(宽)
    const x1 = x0 + dx * len, y1 = y0 + dy * len;  // 近头端(窄)
    const half = (w) => w / 2;
    poly([
      [x0 - px * half(n.wBase), y0 - py * half(n.wBase)],
      [x0 + px * half(n.wBase), y0 + py * half(n.wBase)],
      [x1 + px * half(n.wTop), y1 + py * half(n.wTop)],
      [x1 - px * half(n.wTop), y1 - py * half(n.wTop)],
    ], CONFIG.color.body, 'rgba(0,0,0,0.15)');
    return [x1, y1];
  }

  // 头：以脖端(neckTop)为基准接入点，整体可加 offX/offY 偏移，尖朝前
  function drawHead(neckTop) {
    const h = CONFIG.head;
    // 接入点 = 脖子端点 + 偏移（头部整体相对脖子挪动）
    const cx = neckTop[0] + h.offX, cy = neckTop[1] + h.offY;
    const a = rot(cx, cy - h.baseW / 2, cx, cy, h.ang);
    const b = rot(cx, cy + h.baseW / 2, cx, cy, h.ang);
    const tipX = cx + h.len, tipY = cy + h.rise;
    poly([a, [tipX, tipY], b], CONFIG.color.head, 'rgba(0,0,0,0.15)');
    return { tip: [tipX, tipY], forehead: [cx + h.len * 0.68, cy - h.baseW * 0.2], base: [cx, cy] };
  }

  // 角：从头部前额向上前方斜插
  function drawHorn(forehead) {
    const h = CONFIG.horn;
    const cx = forehead[0], cy = forehead[1];
    const lean = 0.18;
    const tip = [cx + Math.sin(lean) * h.len, cy - Math.cos(lean) * h.len];
    poly([
      [cx - h.baseW / 2, cy],
      [cx + h.baseW / 2, cy],
      tip,
    ], CONFIG.color.horn, 'rgba(0,0,0,0.12)');
    thickLine(cx - 1, cy - 2, tip[0], tip[1] + 2, 'rgba(255,255,255,0.5)', 1.6);
  }

  // ================= 姿态 =================
  // 返回本帧绘制参数：
  //  { bob: 身体离地抬升, pitch: 身体前倾, legAngles: 四腿摆角, eye }
  function poseAt(dt) {
    const cfg = CONFIG;
    const p = { bob: 0, pitch: 0, legAngles: [0, 0, 0, 0], legLenK: 1, mode: 'idle' };

    const inputX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    // ---- 状态推进：先处理逻辑（每帧只跑一遍，避免分层 dt）----
    updateDemo(inputX, dt);

    // ---- 根据状态取姿态 ----
    if (!state.onGround) {
      // 滞空：身体沿正弦抛物，前后腿向前/后张开、略微收拢(跳跃姿势)
      const u = state.airT / cfg.jump.dur;          // 0~1
      p.bob = Math.sin(Math.PI * u) * cfg.jump.h;   // 顶点最高
      p.mode = 'jump';
      // 张开量：起跳/落地小，中段最大
      const spread = Math.sin(Math.PI * u) * 0.55;
      p.legAngles = cfg.legs.map((lg) => {
        const f = lg.part === 'front' ? 1 : -1;   // 前腿向前摆，后腿向后摆
        return f * spread;
      });
      p.legLenK = 1 - 0.35 * Math.sin(Math.PI * u); // 中段腿略收
      p.pitch = 0.1; // 略前倾，像向前跳
    } else if (inputX !== 0) {
      p.mode = 'run';
      // 对角步态：前左+后右(diag A) 同步、前右+后左(diag B) 同步，两组相位反相
      const w = state.runPhase;
      const bob = Math.abs(Math.sin(w)) * cfg.leg.bobAmp;
      p.bob = bob;
      p.legAngles = cfg.legs.map((lg) => {
        const base = lg.diag === 'A' ? w : w + Math.PI;
        return Math.sin(base) * cfg.leg.swingAmp;
      });
      p.pitch = 0.1; // 奔跑略前倾
    } else {
      // 待机：轻微呼吸起伏，四腿基本竖直
      p.mode = 'idle';
      const breathe = Math.sin(state.idlePhase * 1.5) * 0.5;
      p.bob = Math.max(0, breathe);
      p.legAngles = cfg.legs.map((lg) => {
        const side = lg.near ? 1 : -1;
        return side * Math.sin(state.idlePhase * 0.7) * 0.04;
      });
      p.pitch = 0.02;
    }
    return p;
  }

  // ================= 原地演示逻辑（无位移） =================
  function updateDemo(inputX, dt) {
    const cfg = CONFIG;

    // A/D：只切换朝向并推进奔跑步态（角色原地奔跑）
    if (inputX !== 0) {
      state.dir = inputX;
      if (state.onGround) state.runPhase += dt * cfg.runFreq;
    }
    // 待机相位（呼吸）始终走
    state.idlePhase += dt;

    // 跳跃
    if (!state.onGround) {
      state.airT += dt;
      if (state.airT >= cfg.jump.dur) {
        state.onGround = true;      // 落地
        state.airT = 0;
      }
    } else if (keys.jumpBuf) {
      keys.jumpBuf = false;
      state.onGround = false;
      state.airT = 0;
      // 起跳瞬间抬升 0，随后按正弦升到顶点再回落
    }
  }

  // ================= 组装 =================
  // 独角兽永远按“朝右(+x)”画到离屏(此时 ctx=offCtx)，姿态里不含任何 dir；
  // 朝向由 render 最后用 drawImage 整块位图翻转实现。
  // 绘制顺序：远腿 → 脖子/头/角 → 身体 → 近腿（近腿盖在身体前）
  function drawLegs(p, cfg, near) {
    cfg.legs.forEach((lg, i) => {
      if (lg.near === near) {
        const col = near ? cfg.color.legNear : cfg.color.legFar;
        const w = near ? cfg.leg.nearW : cfg.leg.farW;
        drawLeg(lg, p.legAngles[i], col, w, p.legLenK);
      }
    });
  }

  function drawFigure(p, cfg) {
    // 前倾绕脚底（朝右语义：头端略微下沉）
    ctx.translate(0, cfg.body.h / 2);
    ctx.rotate(p.pitch);
    ctx.translate(0, -cfg.body.h / 2);

    drawLegs(p, cfg, false);          // 远侧腿（身体之后）
    const neckTop = drawNeck();       // 脖子 / 头 / 角
    const head = drawHead(neckTop);
    drawHorn(head.forehead);
    const eyeX = head.base[0] + cfg.head.len * 0.5 - 5;   // 眼睛随头接入点偏移
    const eyeY = head.base[1] - cfg.head.baseW * 0.15;
    ctx.fillStyle = cfg.color.eye;
    ctx.fillRect(eyeX, eyeY, 2, 2.6);
    drawBody();                       // 身体
    drawLegs(p, cfg, true);           // 近侧腿（盖在身体前）
  }

  function render(p) {
    const cfg = CONFIG;
    // 背景（主画布）
    mainCtx.fillStyle = cfg.color.bg;
    mainCtx.fillRect(0, 0, cfg.W, cfg.H);

    const gy = cfg.bodyCy + groundLocal();   // 地面画布 y
    const by = cfg.bodyCy - p.bob;           // 身体中心画布 y（抬升 = 上移）

    // 地面线 & 固定阴影（角色不移动）
    mainCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    mainCtx.lineWidth = 1;
    mainCtx.beginPath();
    mainCtx.moveTo(0, gy);
    mainCtx.lineTo(cfg.W, gy);
    mainCtx.stroke();
    mainCtx.fillStyle = cfg.color.ground;
    mainCtx.beginPath();
    mainCtx.ellipse(cfg.bodyX, gy + 2, cfg.body.w * 0.7, 3, 0, 0, TAU);
    mainCtx.fill();

    // 1) 按“朝右”画到离屏
    ctx = offCtx;
    offCtx.clearRect(0, 0, cfg.W, cfg.H);
    offCtx.save();
    offCtx.translate(cfg.bodyX, by);
    drawFigure(p, cfg);
    offCtx.restore();

    // 2) 贴回主画布；dir<0 时整体水平翻转（位图级，姿态方向不会被镜像干扰）
    ctx = mainCtx;
    mainCtx.save();
    if (state.dir < 0) {
      mainCtx.translate(cfg.bodyX, 0);
      mainCtx.scale(-1, 1);
      mainCtx.translate(-cfg.bodyX, 0);
    }
    mainCtx.drawImage(off, 0, 0);
    mainCtx.restore();
  }

  // ================= 主循环 =================
  function frame() {
    const now = performance.now();
    const dt = Math.min((now - state.last) / 1000, 0.05);
    state.last = now;
    if (state.running) {
      render(poseAt(dt));
    }
    requestAnimationFrame(frame);
  }

  // ================= 输入 =================
  function bindInput() {
    const code = (e) => e.code;
    const setKey = (e, on) => {
      const c = code(e);
      if (c === 'KeyA' || c === 'ArrowLeft') { keys.left = on; e.preventDefault(); }
      else if (c === 'KeyD' || c === 'ArrowRight') { keys.right = on; e.preventDefault(); }
      else if (c === 'Space' || c === 'KeyW' || c === 'ArrowUp') {
        if (on && state.onGround) keys.jumpBuf = true;
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', (e) => setKey(e, true));
    window.addEventListener('keyup', (e) => setKey(e, false));
  }

  // ================= 控件绑定 =================
  function bindControls() {
    btnPlay.onclick = () => {
      state.running = !state.running;
      btnPlay.textContent = state.running ? '⏸ 暂停' : '▶ 播放';
    };
    gridToggle.onchange = () => gridEl.classList.toggle('hidden', !gridToggle.checked);
  }

  bindInput();
  bindControls();
  requestAnimationFrame(frame);
})();
