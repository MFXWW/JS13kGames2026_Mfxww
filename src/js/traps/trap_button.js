// ===================== Button（按钮）专用函数 =====================
/**
 * 创建Button陷阱
 * @param {string/number} id 陷阱ID
 * @param {number} x X坐标
 * @param {number} y Y坐标
 * @returns {object} 陷阱实例
 */
function createButton(id, x, y) {
  const trap = createMoveableTrap(id, x, y);
  trap.t = 'button';
  trap.p = false;
  trap.r = false;
  // 碰撞盒对齐半格贴图（16×8 位于格子下半部）：0.9 宽居中，避免擦边误触发
  trap.c.width = 0.9;
  trap.c.height = 0.5;
  trap.co = { x: 0.05, y: 0.5 };
}

/**
 * Button游戏注册处理
 * @param {string/number} id 陷阱ID
 */
function buttonOnGameRegister(id) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  trap.r = true;
}

/**
 * Button碰撞玩家处理
 * @param {string/number} id 陷阱ID
 */
function buttonOnCollidedWithPlayer(id) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  if (!trap.p) sfx(800, 0.25, 0.06, 0, 0.3, 600);
  trap.p = true;
  if (!trap.r) return;
  gameOnButtonPressed();
  trap.r = false;
}

/**
 * Button帧更新逻辑
 * @param {string/number} id 陷阱ID
 * @param {number} dt 帧间隔时间
 */
function buttonTick(id, dt) {
  trapBaseTick(id, dt);
}

/**
 * Button渲染逻辑
 * @param {string/number} id 陷阱ID
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 */
function buttonRender(id, ctx) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  // hidden → 不渲染
  if (trap.h) return;
  
  const x = trap.c.x * GAME_tileSize;
  const y = (trap.c.y + 0.5) * GAME_tileSize;
  ctx.drawImage(
    trap.p ? TRAP_button_image_triggered : TRAP_button_image_default,
    x,
    y
  );
}