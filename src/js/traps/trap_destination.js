// ===================== Destination（终点陷阱）专用函数 =====================
/**
 * 创建Destination陷阱
 * @param {string/number} id 陷阱ID
 * @param {number} x X坐标
 * @param {number} y Y坐标
 * @returns {object} 陷阱实例
 */
function createDestination(id, x, y) {
  const trap = createMoveableTrap(id, x, y);
  trap.t = 'destination';
}

/**
 * Destination碰撞玩家处理
 * @param {string/number} id 陷阱ID
 */
function destinationOnCollidedWithPlayer(id) {
  gameOnDestinationReached();
}

/**
 * Destination帧更新逻辑
 * @param {string/number} id 陷阱ID
 * @param {number} dt 帧间隔时间
 */
function destinationTick(id, dt) {
  trapBaseTick(id, dt);
}

/**
 * Destination渲染逻辑
 * @param {string/number} id 陷阱ID
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 */
function destinationRender(id, ctx) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  // hidden → 不渲染
  if (trap.h) return;
  
  const tx = trap.c.x * GAME_tileSize;
  const ty = trap.c.y * GAME_tileSize;
  const w = GAME_tileSize;
  const h = GAME_tileSize;
  if (TRAP_destination_image) {
    ctx.drawImage(TRAP_destination_image, tx, ty, w, h);
  }
}