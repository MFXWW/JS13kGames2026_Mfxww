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
 * 数值已展平为顶层 const（原 CONFIG 字典），便于压缩器常量折叠。
 */
(function () {
  'use strict';

  // ================= 常量（原 CONFIG 展平） =================
  // 画布逻辑尺寸
  const W = 96, H = 120;
  // 站位（固定）
  const BODY_X = 44, BODY_CY = 72;

  // 颜色
  const COLOR_BODY = '#efe6fb', COLOR_NECK = '#dcc9f2', COLOR_HEAD = '#f7f0ff';
  const COLOR_LEG_FAR = '#9c86c9', COLOR_LEG_NEAR = '#cdb8ec', COLOR_HORN = '#ffd66b';
  const COLOR_EYE = '#2a2440', COLOR_GROUND = 'rgba(0,0,0,0.35)', COLOR_BG = '#0b0c12';

  // 身体（方形/略长方形块）
  const BODY_W = 26, BODY_H = 20;

  // 腿：髋部沿身体底缘分布，粗线向下到地面
  const LEG_LEN = 22, LEG_FAR_W = 6, LEG_NEAR_W = 6;
  const SWING_AMP = 0.55, BOB_AMP = 1.3;
  // x: 髋部横坐标(局部), part 前/后, near 远/近(颜色/粗细/绘制层)
  const LEGS = [
    { x: -8, part: 'back', near: false, diag: 'B' },
    { x: -6.5, part: 'back', near: true, diag: 'A' },
    { x: 6.5, part: 'front', near: false, diag: 'A' },
    { x: 8, part: 'front', near: true, diag: 'B' },
  ];

  // 脖子：梯形，近头窄、近身宽；与身体同色
  const NECK_BASE_X = 7, NECK_BASE_Y = -7;
  const NECK_DIR_X = 11, NECK_DIR_Y = -20;
  const NECK_W_TOP = 4, NECK_W_BASE = 16;

  // 头：三角形（offX/offY 相对脖子端点偏移）
  const HEAD_LEN = 20, HEAD_RISE = -1, HEAD_BASE_W = 12, HEAD_ANG = 3, HEAD_OFF_X = -2, HEAD_OFF_Y = 0;

  // 角
  const HORN_LEN = 16, HORN_BASE_W = 7;

  // 跳跃动画
  const JUMP_H = 17, JUMP_DUR = 1.0;

  // 步态频率(基准)
  const RUN_FREQ = 3.64;

  // ================= DOM =================
  const canvas = document.getElementById('stage');
  const mainCtx = canvas.getContext('2d');
  // 离屏画布：始终按“朝右”渲染整只独角兽，最后按 dir 整块位图翻转
  const off = document.createElement('canvas');
  off.width = W;
  off.height = H;
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
    return BODY_H / 2 + LEG_LEN;
  }

  function drawBody() {
    poly([
      [-BODY_W / 2, -BODY_H / 2],
      [BODY_W / 2, -BODY_H / 2],
      [BODY_W / 2, BODY_H / 2],
      [-BODY_W / 2, BODY_H / 2],
    ], COLOR_BODY, 'rgba(0,0,0,0.15)');
  }

  // 一条腿：绕髋部 (lg.x, BODY_H/2) 旋转 angle，长度乘 lenK(滞空收腿用)
  function drawLeg(lg, angle, col, w, lenK) {
    const hx = lg.x, hy = BODY_H / 2;
    const len = LEG_LEN * (lenK == null ? 1 : lenK);
    const fx = hx + Math.sin(angle) * len;
    const fy = hy + Math.cos(angle) * len;
    thickLine(hx, hy, fx, fy, col, w);
  }

  // 脖子：梯形(近头窄、近身宽)，用与身体相同的颜色/描边
  function drawNeck() {
    const len = Math.hypot(NECK_DIR_X, NECK_DIR_Y);
    const dx = NECK_DIR_X / len, dy = NECK_DIR_Y / len;
    // 垂直方向单位向量
    const px = -dy, py = dx;
    const x0 = NECK_BASE_X, y0 = NECK_BASE_Y;   // 近身体端(宽)
    const x1 = x0 + dx * len, y1 = y0 + dy * len; // 近头端(窄)
    const half = (w) => w / 2;
    poly([
      [x0 - px * half(NECK_W_BASE), y0 - py * half(NECK_W_BASE)],
      [x0 + px * half(NECK_W_BASE), y0 + py * half(NECK_W_BASE)],
      [x1 + px * half(NECK_W_TOP), y1 + py * half(NECK_W_TOP)],
      [x1 - px * half(NECK_W_TOP), y1 - py * half(NECK_W_TOP)],
    ], COLOR_BODY, 'rgba(0,0,0,0.15)');
    return [x1, y1];
  }

  // 头：以脖端(neckTop)为基准接入点，整体可加偏移，尖朝前
  function drawHead(neckTop) {
    // 接入点 = 脖子端点 + 偏移（头部整体相对脖子挪动）
    const cx = neckTop[0] + HEAD_OFF_X, cy = neckTop[1] + HEAD_OFF_Y;
    const a = rot(cx, cy - HEAD_BASE_W / 2, cx, cy, HEAD_ANG);
    const b = rot(cx, cy + HEAD_BASE_W / 2, cx, cy, HEAD_ANG);
    const tipX = cx + HEAD_LEN, tipY = cy + HEAD_RISE;
    poly([a, [tipX, tipY], b], COLOR_HEAD, 'rgba(0,0,0,0.15)');
    return { tip: [tipX, tipY], forehead: [cx + HEAD_LEN * 0.68, cy - HEAD_BASE_W * 0.2], base: [cx, cy] };
  }

  // 角：从头部前额向上前方斜插
  function drawHorn(forehead) {
    const cx = forehead[0], cy = forehead[1];
    const lean = 0.18;
    const tip = [cx + Math.sin(lean) * HORN_LEN, cy - Math.cos(lean) * HORN_LEN];
    poly([
      [cx - HORN_BASE_W / 2, cy],
      [cx + HORN_BASE_W / 2, cy],
      tip,
    ], COLOR_HORN, 'rgba(0,0,0,0.12)');
    thickLine(cx - 1, cy - 2, tip[0], tip[1] + 2, 'rgba(255,255,255,0.5)', 1.6);
  }

  // ================= 姿态 =================
  function poseAt(dt) {
    const p = { bob: 0, pitch: 0, legAngles: [0, 0, 0, 0], legLenK: 1, mode: 'idle' };

    const inputX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);

    // ---- 状态推进：先处理逻辑（每帧只跑一遍，避免分层 dt）----
    updateDemo(inputX, dt);

    // ---- 根据状态取姿态 ----
    if (!state.onGround) {
      // 滞空：身体沿正弦抛物，前后腿向前/后张开、略微收拢(跳跃姿势)
      const u = state.airT / JUMP_DUR;          // 0~1
      p.bob = Math.sin(Math.PI * u) * JUMP_H;   // 顶点最高
      p.mode = 'jump';
      // 张开量：起跳/落地小，中段最大
      const spread = Math.sin(Math.PI * u) * 0.55;
      p.legAngles = LEGS.map((lg) => {
        const f = lg.part === 'front' ? 1 : -1; // 前腿向前摆，后腿向后摆
        return f * spread;
      });
      p.legLenK = 1 - 0.35 * Math.sin(Math.PI * u); // 中段腿略收
      p.pitch = 0.1; // 略前倾，像向前跳
    } else if (inputX !== 0) {
      p.mode = 'run';
      // 对角步态：前左+后右(diag A) 同步、前右+后左(diag B) 同步，两组相位反相
      const w = state.runPhase;
      const bob = Math.abs(Math.sin(w)) * BOB_AMP;
      p.bob = bob;
      p.legAngles = LEGS.map((lg) => {
        const base = lg.diag === 'A' ? w : w + Math.PI;
        return Math.sin(base) * SWING_AMP;
      });
      p.pitch = 0.1; // 奔跑略前倾
    } else {
      // 待机：轻微呼吸起伏，四腿基本竖直
      p.mode = 'idle';
      const breathe = Math.sin(state.idlePhase * 1.5) * 0.5;
      p.bob = Math.max(0, breathe);
      p.legAngles = LEGS.map((lg) => {
        const side = lg.near ? 1 : -1;
        return side * Math.sin(state.idlePhase * 0.7) * 0.04;
      });
      p.pitch = 0.02;
    }
    return p;
  }

  // ================= 原地演示逻辑（无位移） =================
  function updateDemo(inputX, dt) {
    // A/D：只切换朝向并推进奔跑步态（角色原地奔跑）
    if (inputX !== 0) {
      state.dir = inputX;
      if (state.onGround) state.runPhase += dt * RUN_FREQ;
    }
    // 待机相位（呼吸）始终走
    state.idlePhase += dt;

    // 跳跃
    if (!state.onGround) {
      state.airT += dt;
      if (state.airT >= JUMP_DUR) {
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
  function drawLegs(p, near) {
    LEGS.forEach((lg, i) => {
      if (lg.near === near) {
        const col = near ? COLOR_LEG_NEAR : COLOR_LEG_FAR;
        const w = near ? LEG_NEAR_W : LEG_FAR_W;
        drawLeg(lg, p.legAngles[i], col, w, p.legLenK);
      }
    });
  }

  function drawFigure(p) {
    // 前倾绕脚底（朝右语义：头端略微下沉）
    ctx.translate(0, BODY_H / 2);
    ctx.rotate(p.pitch);
    ctx.translate(0, -BODY_H / 2);

    drawLegs(p, false);           // 远侧腿（身体之后）
    const neckTop = drawNeck();   // 脖子 / 头 / 角
    const head = drawHead(neckTop);
    drawHorn(head.forehead);
    const eyeX = head.base[0] + HEAD_LEN * 0.5 - 5;   // 眼睛随头接入点偏移
    const eyeY = head.base[1] - HEAD_BASE_W * 0.15;
    ctx.fillStyle = COLOR_EYE;
    ctx.fillRect(eyeX, eyeY, 2, 2.6);
    drawBody();                   // 身体
    drawLegs(p, true);            // 近侧腿（盖在身体前）
  }

  function render(p) {
    // 背景（主画布）
    mainCtx.fillStyle = COLOR_BG;
    mainCtx.fillRect(0, 0, W, H);

    const gy = BODY_CY + groundLocal();   // 地面画布 y
    const by = BODY_CY - p.bob;           // 身体中心画布 y（抬升 = 上移）

    // 地面线 & 固定阴影（角色不移动）
    mainCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    mainCtx.lineWidth = 1;
    mainCtx.beginPath();
    mainCtx.moveTo(0, gy);
    mainCtx.lineTo(W, gy);
    mainCtx.stroke();
    mainCtx.fillStyle = COLOR_GROUND;
    mainCtx.beginPath();
    mainCtx.ellipse(BODY_X, gy + 2, BODY_W * 0.7, 3, 0, 0, TAU);
    mainCtx.fill();

    // 1) 按“朝右”画到离屏
    ctx = offCtx;
    offCtx.clearRect(0, 0, W, H);
    offCtx.save();
    offCtx.translate(BODY_X, by);
    drawFigure(p);
    offCtx.restore();

    // 2) 贴回主画布；dir<0 时整体水平翻转（位图级，姿态方向不会被镜像干扰）
    ctx = mainCtx;
    mainCtx.save();
    if (state.dir < 0) {
      mainCtx.translate(BODY_X, 0);
      mainCtx.scale(-1, 1);
      mainCtx.translate(-BODY_X, 0);
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
