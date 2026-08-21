// ===================== Bounce（蹦床）专用函数 =====================
let TRAP_bounce_image_default = null;
let TRAP_bounce_image_triggered = null;

/**
 * 创建Bounce陷阱
 * @param {string/number} id 陷阱ID
 * @param {number} x X坐标
 * @param {number} y Y坐标
 */
function createBounce(id, x, y) {
  const trap = createMoveableTrap(id, x, y);
  trap.t = 'bounce';
  trap.a = false; // a = active
  trap.rt = 0; // rt = recoverTimer
  trap.rd = 0.5; // rd = recoverDelay
  // 碰撞箱只占下半格（类似部分陷阱的缩小碰撞盒策略）
  trap.c.width = 1;
  trap.c.height = 0.5;
  trap.co = { x: 0, y: 0.5 };
}

/**
 * Bounce碰撞玩家处理
 * @param {string/number} id 陷阱ID
 */
function bounceOnCollidedWithPlayer(id) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  // 仅在未激活时触发一次弹起效果
  if (!trap.a) {
    trap.a = true;
    trap.rt = trap.rd;
    // 使用玩家已有的垂直速度变量实现弹起
    // PLAYER_vy 与 player_getDY 配合使用（负值向上）
    if (typeof PLAYER_vy !== 'undefined') {
      // 设置为更强的跳跃力，使蹦床弹得更高（倒置重力下反向弹出）
      PLAYER_vy = PLAYER_jumpForce * 1.6 * PLAYER_gravityDir;
    }
    // 播放弹簧音效 — 快速上升的弹性音
    sfx(350, 0.3, 0.08, 0, 0.4, 900);
    sfx(600, 0.2, 0.12, 3, 0.3, 1200, 0, 40);
  }
}

/**
 * Bounce帧更新逻辑
 * @param {string/number} id 陷阱ID
 * @param {number} dt 帧间隔时间
 */
function bounceTick(id, dt) {
  trapBaseTick(id, dt);
  const trap = TRAP_instances[id];
  if (!trap) return;
  if (trap.a) {
    trap.rt -= dt;
    if (trap.rt <= 0) {
      trap.a = false;
      trap.rt = 0;
    }
  }
}

/**
 * Bounce渲染逻辑
 * @param {string/number} id 陷阱ID
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 */
function bounceRender(id, ctx) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  // hidden → 不渲染
  if (trap.h) return;
  const px = trap.c.x * GAME_tileSize;
  const py = trap.c.y * GAME_tileSize;
  if (trap.a && TRAP_bounce_image_triggered) {
    ctx.drawImage(TRAP_bounce_image_triggered, px, py, GAME_tileSize, GAME_tileSize);
  } else if (TRAP_bounce_image_default) {
    ctx.drawImage(TRAP_bounce_image_default, px, py, GAME_tileSize, GAME_tileSize);
  }
}