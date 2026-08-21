// ===================== BlackHole（黑洞陷阱）专用函数 =====================
// 玩家接触后被黑洞吞没，播放环状像素坍缩效果，玩家死亡
// 注意：精灵图由用户自行提供 blackhole_0.png / blackhole_1.png（16×16，双色像素风）

/** 全局坍缩环动画状态 */
let GAME_ringBlast = null;
/** 黑洞吸入动画状态（玩家被逐渐吸入洞心） */
let GAME_blackHoleSuck = null;
/** 黑洞移动尾迹粒子（逐渐变小的空心正方形） */
let GAME_blackHoleTrail = [];
const BLACKHOLE_TRAIL_INTERVAL = 0.05;  // 生成间隔（秒）
const BLACKHOLE_TRAIL_DURATION = 0.45;  // 粒子持续（秒）
const BLACKHOLE_TRAIL_HALF = 6;         // 初始半边长（逻辑像素，worldScale 下放大）

/** 在路径上生成一个尾迹粒子 */
function spawnBlackHoleTrail(cx, cy) {
    GAME_blackHoleTrail.push({ x: cx, y: cy, life: 0, duration: BLACKHOLE_TRAIL_DURATION, half: BLACKHOLE_TRAIL_HALF });
}

/** 推进尾迹粒子（逐渐变小） */
function blackHoleTrailTick(dt) {
    for (let i = GAME_blackHoleTrail.length - 1; i >= 0; i--) {
        const p = GAME_blackHoleTrail[i];
        p.life += dt;
        if (p.life >= p.duration) { GAME_blackHoleTrail.splice(i, 1); continue; }
        p.half = BLACKHOLE_TRAIL_HALF * (1 - p.life / p.duration);
    }
}

/** 渲染尾迹粒子（空心正方形边框） */
function blackHoleTrailRender(ctx) {
    ctx.fillStyle = GAME_foregroundColor;
    for (const p of GAME_blackHoleTrail) {
        const h = p.half;
        const x0 = p.x - h, y0 = p.y - h, d = h * 2;
        ctx.fillRect(x0, y0, d, 1);
        ctx.fillRect(x0, y0 + d - 1, d, 1);
        ctx.fillRect(x0, y0, 1, d);
        ctx.fillRect(x0 + d - 1, y0, 1, d);
    }
}

/**
 * 在指定像素位置生成坍缩环
 * @param {number} cx 黑洞中心像素X
 * @param {number} cy 黑洞中心像素Y
 */
function spawnRingBlast(cx, cy) {
    GAME_ringBlast = { r: 0, life: 12, cx, cy };
}

/**
 * 渲染坍缩环像素动画（在 game_core.js 的 gameRender 中调用）
 * @param {CanvasRenderingContext2D} ctx
 */
function renderRingExplosion(ctx) {
    if (!GAME_ringBlast) return;
    const { cx, cy } = GAME_ringBlast;
    ctx.fillStyle = "#fff";
    GAME_ringBlast.r += 2;
    GAME_ringBlast.life--;
    // 环形离散像素点，模拟像素风吸积环
    for (let a = 0; a < Math.PI * 2; a += 0.35) {
        const px = Math.floor(cx + Math.cos(a) * GAME_ringBlast.r);
        const py = Math.floor(cy + Math.sin(a) * GAME_ringBlast.r);
        ctx.fillRect(px, py, 1, 1);
    }
    if (GAME_ringBlast.life <= 0) GAME_ringBlast = null;
}

/**
 * 创建BlackHole陷阱
 * @param {string/number} id 陷阱ID
 * @param {number} x X坐标
 * @param {number} y Y坐标
 * @returns {object} 陷阱实例
 */
function createBlackHole(id, x, y) {
  const trap = createMoveableTrap(id, x, y);
  trap.t = 'blackhole';
  trap.e = false; // e = swallowed
  trap.f = 0;
  trap.ft = 0;
  trap.fi = 0.12;
  // 缩小碰撞盒（宽高从1缩到0.7），存储偏移量使碰撞盒居中
  trap.c.width = 0.7;
  trap.c.height = 0.7;
  trap.co = { x: 0.15, y: 0.15 };
}

/**
 * BlackHole碰撞玩家处理 — 吞没！
 * @param {string/number} id 陷阱ID
 */
function blackHoleOnCollidedWithPlayer(id) {
  const trap = TRAP_instances[id];
  if (!trap || trap.e) return;
  trap.e = true;
  // 播放吞没音效 — 低沉轰鸣 + 高频碎裂
  sfx(120, 0.6, 0.3, 2, 0.5, 30);
  sfx(200, 0.35, 0.2, 1, 0, 60, 0, 50);
  sfx(80, 0.2, 0.4, 0, 0.3, 0, 0, 100);
  // 在黑洞中心生成坍缩环
  const px = (trap.c.x + trap.c.width / 2) * GAME_tileSize;
  const py = (trap.c.y + trap.c.height / 2) * GAME_tileSize;
  spawnRingBlast(px, py);
  // 吸入动画：玩家从当前位置逐渐缩小并被吸向洞心，结束后才真正死亡
  GAME_blackHoleSuck = {
    t: 0,
    duration: 0.7,
    fromX: PLAYER_collision.x + PLAYER_collision.width / 2,
    fromY: PLAYER_collision.y + PLAYER_collision.height / 2,
    id, // 记录黑洞ID，吸入目标实时跟随移动中的黑洞
  };
}

/**
 * BlackHole帧更新逻辑
 * @param {string/number} id 陷阱ID
 * @param {number} dt 帧间隔时间
 */
function blackHoleTick(id, dt) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  // 记录移动前位置，移动时生成尾迹
  const px = trap.c.x, py = trap.c.y;
  trapBaseTick(id, dt);
  const dx = trap.c.x - px, dy = trap.c.y - py;
  // 隐藏黑洞移动时不生成尾迹
  if (dx * dx + dy * dy > 1e-6 && !trap.h) {
    trap.trailT = (trap.trailT || 0) + dt;
    if (trap.trailT >= BLACKHOLE_TRAIL_INTERVAL) {
      trap.trailT = 0;
      // 粒子中心与黑洞精灵中心对齐（精灵绘制于 c.x*tileSize，中心 +tileSize/2）
      spawnBlackHoleTrail(
        trap.c.x * GAME_tileSize + GAME_tileSize / 2,
        trap.c.y * GAME_tileSize + GAME_tileSize / 2
      );
    }
  } else {
    trap.trailT = 0;
  }
  // 已吞没不再更新（吸入动画期间继续脉动）
  if (trap.e && !GAME_blackHoleSuck) return;

  // 帧动画逻辑（黑洞脉动 / 吸积闪烁：1→2→1镜→2镜）
  trap.ft += dt;
  if (trap.ft >= trap.fi) {
    trap.ft -= trap.fi;
    trap.f = (trap.f + 1) % 4;
  }
}

/**
 * BlackHole渲染逻辑
 * @param {string/number} id 陷阱ID
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 */
function blackHoleRender(id, ctx) {
  if (!TRAP_blackHole_spriteFrames) return;
  const trap = TRAP_instances[id];
  if (!trap) return;
  // 吞没后仅吸入动画期间继续显示黑洞
  if (trap.e && !GAME_blackHoleSuck) return;
  if (trap.h) return;
  
  const px = trap.c.x * GAME_tileSize;
  const py = trap.c.y * GAME_tileSize;
  const idx = (trap.f || 0) % 4;
  const f = TRAP_blackHole_spriteFrames[idx];
  ctx.drawImage(f, px, py, GAME_tileSize, GAME_tileSize);
}
