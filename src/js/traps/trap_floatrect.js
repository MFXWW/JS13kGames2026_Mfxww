// ===================== FloatRect（浮动矩形）专用函数 =====================
/**
 * 创建FloatRect陷阱
 * @param {string/number} id 陷阱ID
 * @param {number} x X坐标
 * @param {number} y Y坐标
 * @param {number} w 宽度
 * @param {number} h 高度
 * @param {boolean} hidden 是否隐藏
 * @returns {object} 陷阱实例
 */
function createFloatRect(id, x, y, w, h, hidden = false, noCollision = false) {
  const trap = createMoveableTrap(id, x, y);
  trap.t = 'floatrect';
  trap.h = hidden;
  trap.n = noCollision;
  trapResize(id, w, h);
  trap.cl = GAME_foregroundColor;
  trap.mh = 0;
  
  TRAP_floatRect_group.push(trap);
}

/**
 * 检查矩形是否与任意FloatRect碰撞
 */
function AnyfloatRectCollide(rect) {
    return TRAP_floatRect_group.some(r => !r.n && collideRect(r.c, rect));
}

/**
 * FloatRect渲染逻辑
 * @param {string/number} id 陷阱ID
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 */
function floatRectRender(id, ctx) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  
  const tileSize = GAME_tileSize;
  const collision = trap.c;
  const x = collision.x * tileSize;
  const y = collision.y * tileSize;
  const width = collision.width * tileSize;
  const height = collision.height * tileSize;

  if (trap.h) return;

  // 显示状态下填充颜色
  ctx.fillStyle = trap.cl;
  ctx.fillRect(x, y, width, height);
}