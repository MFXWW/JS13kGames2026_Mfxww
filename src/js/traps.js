// ===================== 全局变量定义（统一前缀 TRAP_） =====================
// 存储所有陷阱实例，key: trapId, value: 陷阱状态对象
const TRAP_instances = {};
// BlackHole 相关全局静态变量
let TRAP_blackHole_spriteFrames = null;
// Destination 相关全局静态变量
let TRAP_destination_image = null;
// FloatRect 相关全局静态变量
let TRAP_floatRect_group = [];
// OneWay 相关全局静态变量
let TRAP_oneway_group = [];
// Button 相关全局静态变量
let TRAP_button_image_default = null;
let TRAP_button_image_triggered = null;

// ===================== 基础可移动陷阱通用函数 =====================
/**
 * 创建基础可移动陷阱
 * @param {string/number} id 陷阱ID
 * @param {number} posX X坐标
 * @param {number} posY Y坐标
 * @returns {object} 陷阱实例
 */
function createMoveableTrap(id, posX, posY) {
  TRAP_instances[id] = {
    id: id,
    c: { x: posX, y: posY, width: 1, height: 1 }, // c = collision
    m: null, // m = movement
    og: false, // og = occupyingGameThread
    t: 'moveableTrap', // t = type
    // 子类扩展属性默认值
    f: 0, // f = frameIndex
    ft: 0, // ft = frameTimer
    fi: 0.12, // fi = frameInterval
    h: false, // h = hidden
    n: false, // n = noCollision
    cl: null, // cl = color
    mh: 0, // mh = moving_direction_horizontal
    mv: 0, // mv = moving_direction_vertical
    p: false, // p = pressed
    r: false // r = required
  };
  return TRAP_instances[id];
}

/**
 * 调整陷阱碰撞盒大小
 * @param {string/number} id 陷阱ID
 * @param {number} width 宽度
 * @param {number} height 高度
 */
function trapResize(id, width, height) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  trap.c.width = width;
  trap.c.height = height;
}

/**
 * 设置陷阱移动参数
 * @param {string/number} id 陷阱ID
 * @param {array} args 移动参数 [objectIndex, x, y, duration, blockFlag]
 */
function trapSetMovement(id, args) {
  const trap = TRAP_instances[id];
  if (!trap) return;
  const fromX = trap.c.x;
  const fromY = trap.c.y;
  const targetX = args[1];
  const targetY = args[2];
  let duration = args[3];

  GAME_blockedByMovement = !!args[4];
  if (args[4]) trap.og = true;

  if (!duration || duration <= 0) {
    trap.c.x = targetX;
    trap.c.y = targetY;
    trap.m = null;
  } else {
    trap.m = {
      fx: fromX,
      fy: fromY,
      tx: targetX,
      ty: targetY,
      d: duration,
      e: 0,
      b: !!args[4] // b = 本次移动是否 -block（阻塞脚本）
    };
    // 机关开始移动时播放音效
    sfx(200, 0.15, 0.1, 3, 0.4, 300);
  }

  // 处理FloatRect/OneWay移动方向
  if ((trap.t === 'floatrect' || trap.t === 'oneway') && trap.m) {
    trap.mh = trap.m.fx === trap.m.tx ? 0 : (trap.m.tx > trap.m.fx ? 1 : -1);
    trap.mv = trap.m.fy === trap.m.ty ? 0 : (trap.m.ty > trap.m.fy ? 1 : -1);
  }
}

/**
 * 检查陷阱与玩家碰撞
 * @param {string/number} id 陷阱ID
 * @returns {boolean} 是否碰撞
 */
function trapCheckCollisionWithPlayer(id) {
  const trap = TRAP_instances[id];
  if (!trap) return false;
  let col = trap.c;
  // 如果有碰撞偏移（如 BlackHole 缩小碰撞盒居中），应用偏移
  if (trap.co) {
    col = {
      x: col.x + trap.co.x,
      y: col.y + trap.co.y,
      width: col.width,
      height: col.height
    };
  }
  return collideRect(PLAYER_collision, col);
}

/**
 * 检查玩家是否站在指定陷阱的顶部（脚底在陷阱顶部表面附近）
 * 注意：必须判断脚底靠近陷阱的 TOP 边缘，而非仅与陷阱任意部分重叠。
 * 否则对于细高柱子(fr2)，玩家站在旁边也会被误判为"站在上面"。
 * @param {object} trapCollision - 陷阱碰撞体
 * @returns {boolean}
 */
function player_isStandingOnTrap(trapCollision) {
  if (!PLAYER_collision) return false;
  const dir = PLAYER_gravityDir;
  // 重力方向的"脚底"与"表面"（倒置时在物理上方）
  const playerBottom = dir > 0 ? PLAYER_collision.y + PLAYER_collision.height : PLAYER_collision.y;
  const trapSurface = dir > 0 ? trapCollision.y : trapCollision.y + trapCollision.height;
  // 脚底必须在表面附近（允许极小偏差和陷进去一点的情况）
  if (dir > 0 ? (playerBottom < trapSurface - 0.05 || playerBottom > trapSurface + 0.3)
              : (playerBottom > trapSurface + 0.05 || playerBottom < trapSurface - 0.3)) return false;
  const feetRect = dir > 0
    ? { x: PLAYER_collision.x, y: PLAYER_collision.y + PLAYER_collision.height, width: PLAYER_collision.width, height: 0.1 }
    : { x: PLAYER_collision.x, y: PLAYER_collision.y - 0.1, width: PLAYER_collision.width, height: 0.1 };
  return collideRect(feetRect, trapCollision);
}

/**
 * 陷阱沿指定轴移动（水平/垂直共用）
 * @param {string/number} id 陷阱ID
 * @param {object} movement 移动状态对象
 * @param {number} progress 移动进度(0-1)
 * @param {string} axis 坐标轴 'x' 或 'y'
 * @returns {number} 移动距离
 */
function trapMoveOnAxis(id, movement, progress, axis) {
  const trap = TRAP_instances[id];
  if (!trap) return 0;
  const toKey = axis === 'x' ? 'tx' : 'ty';
  const fromKey = axis === 'x' ? 'fx' : 'fy';
  const totalDA = (movement[toKey] - movement[fromKey]) * progress;
  trap.c[axis] = movement[fromKey] + totalDA;
  trap.c[axis] = Math.round(trap.c[axis] * GAME_tileSize) / GAME_tileSize;
  return totalDA;
}

/**
 * 平台类陷阱（floatrect/oneway）沿轴移动：移动 + 携带玩家 + 推动
 */
function platformMoveAxis(id, movement, progress, axis) {
  const trap = TRAP_instances[id];
  if (!trap) return 0;

  const prev = trap.c[axis];
  const totalDA = trapMoveOnAxis(id, movement, progress, axis);
  const frameDA = trap.c[axis] - prev;

  if (frameDA === 0 || trap.n) return totalDA;

  // 撞到玩家：上下/横向推动；站在顶上的不带动（玩家自然下坠），侧面的推开/挤死
  // oneway 为单向平台：横向可穿行不推动，纵向仍可推动
  const dirKey = axis === 'x' ? 'mh' : 'mv';
  if (!GAME_awaitingRespawn && !(trap.t === 'oneway' && axis === 'x') && trap[dirKey] !== 0 && trapCheckCollisionWithPlayer(id)) {
    const dir = PLAYER_gravityDir;
    const playerBottom = dir > 0 ? PLAYER_collision.y + PLAYER_collision.height : PLAYER_collision.y;
    const trapSurface = dir > 0 ? trap.c.y : trap.c.y + trap.c.height;
    // 上升平台把站在顶上的玩家精确托起（对齐平台顶部），避免反复 push/抖动
    if (axis === 'y' && trap.mv * dir < 0 && (dir > 0 ? playerBottom <= trapSurface + 0.5 : playerBottom >= trapSurface - 0.5)) {
      PLAYER_collision.y = dir > 0 ? trapSurface - PLAYER_collision.height : trapSurface + PLAYER_collision.height;
      PLAYER_vy = 0;
      return totalDA;
    }
    // 玩家下落快于下降平台、正从上方穿过 → 不推（避免瞬移到下方）；被平台压（vy=0）仍 push 压死
    if (axis === 'y' && trap.mv * dir > 0 && PLAYER_vy * dir > 0) return totalDA;
    const onTop = dir > 0 ? playerBottom <= trapSurface + 0.05 : playerBottom >= trapSurface - 0.05;
    if (!onTop) {
      player_onPushed(trap.c, trap[dirKey], axis, axis === 'x' ? 'SQUEEZED' : 'SQUASHED');
    }
  }

  return totalDA;
}

/**
 * 推进陷阱移动计时，返回进度(0-1)；无移动返回 -1
 */
function trapAdvanceMovement(id, dt) {
  const trap = TRAP_instances[id];
  if (!trap || !trap.m) return -1;
  const m = trap.m;
  m.e += dt;
  return Math.min(1, m.e / m.d);
}

/**
 * 移动完成后清理移动状态
 */
function trapFinishMovement(id, progress) {
  if (progress < 1) return;
  const trap = TRAP_instances[id];
  const wasBlock = !!(trap.m && trap.m.b);
  trap.m = null;
  if (wasBlock) GAME_blockedByMovement = false;
}

/**
 * 平台类陷阱（floatrect/oneway）帧更新逻辑
 */
function platformTick(id, dt) {
  const progress = trapAdvanceMovement(id, dt);
  if (progress < 0) return;
  const trap = TRAP_instances[id];
  const thisMovement = trap.m;
  platformMoveAxis(id, thisMovement, progress, 'x');
  platformMoveAxis(id, thisMovement, progress, 'y');
  trapFinishMovement(id, progress);
}

/**
 * 基础陷阱帧更新逻辑
 * @param {string/number} id 陷阱ID
 * @param {number} dt 帧间隔时间
 */
function trapBaseTick(id, dt) {
  const trap = TRAP_instances[id];
  if (!trap) return;

  // 碰撞检测 & 执行对应碰撞逻辑（noCollision 或死亡时跳过）
  if (!trap.n && !GAME_awaitingRespawn && trapCheckCollisionWithPlayer(id)) {
    switch (trap.t) {
      case 'blackhole':
        blackHoleOnCollidedWithPlayer(id);
        break;
      case 'destination':
        destinationOnCollidedWithPlayer(id);
        break;
      case 'button':
        buttonOnCollidedWithPlayer(id);
        break;
      case 'bounce':
        bounceOnCollidedWithPlayer(id);
        break;
    }
  }

  // 处理移动逻辑
  const progress = trapAdvanceMovement(id, dt);
  if (progress < 0) return;
  const thisMovement = trap.m;
  trapMoveOnAxis(id, thisMovement, progress, 'x');
  trapMoveOnAxis(id, thisMovement, progress, 'y');
  trapFinishMovement(id, progress);
}

// ===================== TrapManager（陷阱管理器）函数 =====================
/**
 * 初始化所有陷阱类
 */
let TRAP_tickDispatch = null;
let TRAP_renderDispatch = null;

/** 水平翻转一张精灵位图，返回新 canvas */
function flipBitmapHorizontally(bmp) {
  const cvs = document.createElement('canvas');
  cvs.width = bmp.width;
  cvs.height = bmp.height;
  const c = cvs.getContext('2d');
  c.translate(bmp.width, 0);
  c.scale(-1, 1);
  c.drawImage(bmp, 0, 0);
  return cvs;
}

function trapManagerInitializeTrapClasses() {
  TRAP_tickDispatch = {
    blackhole: blackHoleTick,
    destination: destinationTick,
    floatrect: platformTick,
    button: buttonTick,
    bounce: bounceTick,
    oneway: platformTick,
  };
  TRAP_renderDispatch = {
    blackhole: blackHoleRender,
    destination: destinationRender,
    floatrect: floatRectRender,
    button: buttonRender,
    bounce: bounceRender,
    oneway: onewayRender,
  };
  // 黑洞动画序列：帧1 → 帧2 → 帧1左右翻转 → 帧2左右翻转
  const bh1 = GAME_SpriteFrameCache['black_hole1.png'];
  const bh2 = GAME_SpriteFrameCache['black_hole2.png'];
  TRAP_blackHole_spriteFrames = [
    bh1,
    bh2,
    flipBitmapHorizontally(bh1),
    flipBitmapHorizontally(bh2),
  ];
  TRAP_button_image_default = GAME_SpriteFrameCache['button_default.png'];
  TRAP_button_image_triggered = GAME_SpriteFrameCache['button_triggered.png'];
  TRAP_bounce_image_default = GAME_SpriteFrameCache['bounce_default.png'];
  TRAP_bounce_image_triggered = GAME_SpriteFrameCache['bounce_triggered.png'];
  TRAP_destination_image = GAME_SpriteFrameCache['destination.png'];
}

/**
 * 所有陷阱帧更新
 * @param {number} dt 帧间隔时间
 */
function trapManagerTick(dt) {
  for (const id of Object.keys(TRAP_instances)) {
    const trap = TRAP_instances[id];
    (TRAP_tickDispatch[trap.t] || trapBaseTick)(id, dt);
  }
}

/**
 * 渲染所有陷阱
 * @param {CanvasRenderingContext2D} ctx 画布上下文
 */
function trapManagerRender(ctx) {
  // 先渲染其他机关（最底层）
  for (const id of Object.keys(TRAP_instances)) {
    const trap = TRAP_instances[id];
    if (trap.t !== 'floatrect') {
      TRAP_renderDispatch[trap.t](id, ctx);
    }
  }
  // 再渲染 floatrect（覆盖在其他机关上方）
  for (const id of Object.keys(TRAP_instances)) {
    const trap = TRAP_instances[id];
    if (trap.t === 'floatrect') {
      TRAP_renderDispatch[trap.t](id, ctx);
    }
  }
}

/**
 * 清空所有陷阱
 */
function trapManagerClear() {
  // 重置所有陷阱实例
  for (const k in TRAP_instances) delete TRAP_instances[k];
  // 重置FloatRect组
  TRAP_floatRect_group = [];
  // 重置OneWay组
  TRAP_oneway_group = [];
  // 清空黑洞尾迹
  GAME_blackHoleTrail = [];
}

/**
 * 注册陷阱移动
 * @param {array} args 移动参数 [objectIndex, x, y, duration, blockFlag]
 */
function trapManagerRegisterMovement(args) {
  trapSetMovement(args[0], args);
}

