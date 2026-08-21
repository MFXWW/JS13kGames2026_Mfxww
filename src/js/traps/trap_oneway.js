// ===================== OneWay（单向平台）专用函数 =====================
// 玩家可以下方跳穿，但能从上方站立；平台向上移动时推玩家上升
// 注意：TRAP_oneway_group 已在 traps.js 中声明

/**
 * 创建OneWay陷阱（高度固定1格）
 * @param {string/number} id 陷阱ID
 * @param {number} x X坐标
 * @param {number} y Y坐标
 * @param {number} w 宽度
 */
function createOneway(id, x, y, w, hidden = false, noCollision = false) {
  const trap = createMoveableTrap(id, x, y);
  trap.t = 'oneway';
  trap.h = hidden;
  trap.n = noCollision;
  trapResize(id, w, 1);
  trap.cl = GAME_foregroundColor;
  trap.mh = 0;
  trap.mv = 0;
  TRAP_oneway_group.push(trap);
}

/**
 * 检查矩形是否与任意OneWay碰撞
 */
function AnyOnewayCollide(rect) {
  return TRAP_oneway_group.some(t => !t.n && collideRect(t.c, rect));
}

/**
 * OneWay渲染逻辑 — 仅绘制顶部虚线（薄片样式）
 */
function onewayRender(id, ctx) {
  const trap = TRAP_instances[id];
  if (!trap) return;

  const tileSize = GAME_tileSize;
  const c = trap.c;
  const px = c.x * tileSize;
  const py = c.y * tileSize;
  const pw = c.width * tileSize;

  if (trap.h) {
    // 隐藏状态：红色虚线描边
    ctx.save();
    ctx.strokeStyle = '#f00';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px, py, pw, tileSize);
    ctx.restore();
    return;
  }

  // 顶部虚线 — 视觉上就是一块薄片
  ctx.save();
  ctx.strokeStyle = trap.cl;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + pw, py);
  ctx.stroke();
  ctx.restore();

  // 半透明辅助线（微弱的薄片厚度提示）
  ctx.fillStyle = trap.cl;
  ctx.globalAlpha = 0.08;
  ctx.fillRect(px, py, pw, tileSize);
  ctx.globalAlpha = 1.0;
}
