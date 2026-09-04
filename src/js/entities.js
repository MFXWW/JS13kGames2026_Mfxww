// 全局变量前缀约定：
// GameMap -> GAMEMAP_ 前缀
// Player -> PLAYER_ 前缀

// ===================== GameMap 模块（原GameMap类） =====================
// GameMap全局变量
let GAMEMAP_tileMapArray = [];

/**
 * 渲染地图（替代原render方法）
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 */
function gamemap_render(ctx) {
    ctx.fillStyle = GAME_foregroundColor;
    for (let y = 0; y < GAME_mapHeight; y++) {
        for (let x = 0; x < GAME_mapWidth; x++) {
            if (gamemap_hasTile(x, y)) {
                ctx.fillRect(x * GAME_tileSize, y * GAME_tileSize, GAME_tileSize, GAME_tileSize);
            }
        }
    }
}

/**
 * 检查指定坐标是否有瓦片（替代原hasTile方法）
 * @param {number} tileX - 瓦片X坐标
 * @param {number} tileY - 瓦片Y坐标
 * @returns {boolean|null}
 */
function gamemap_hasTile(tileX, tileY) {
    if (tileX < 0 || tileX >= GAME_mapWidth || tileY < 0 || tileY >= GAME_mapHeight) return null;
    return GAMEMAP_tileMapArray[tileY][tileX] == "1";
}

// ===================== Player 模块（原Player类） =====================
// Player全局变量
let PLAYER_size_width = 0.625;
let PLAYER_size_height = 1.125;
let PLAYER_speed = 4.1;
let PLAYER_vy = 0;
let PLAYER_gravity = 34;
let PLAYER_jumpForce = -9;
let PLAYER_gravityDir = 1; // 1=正常重力, -1=倒置
let PLAYER_collision = {
    x: 0, y: 0, width: PLAYER_size_width, height: PLAYER_size_height
}
// 独角兽贴图已移除：玩家用红色碰撞箱表示
const PLAYER_COLOR = '#ff0000';

/**
 * 设置玩家位置（替代原setPosition方法）
 * @param {number} x - X坐标
 * @param {number} y - Y坐标
 */
function player_setPosition(x, y) {
    PLAYER_collision.x = x;
    PLAYER_collision.y = y;
    PLAYER_vy = 0;
    PLAYER_collision.width = PLAYER_size_width;
    PLAYER_collision.height = PLAYER_size_height;
}

/**
 * 获取水平位移（替代原getDX方法）
 * @param {number} deltaTime - 帧间隔时间
 * @returns {number}
 */
function player_getDX(deltaTime) {
    return (actions.right - actions.left) * PLAYER_speed * deltaTime;
}

/**
 * 获取垂直位移（替代原getDY方法）
 * @param {number} deltaTime - 帧间隔时间
 * @returns {number}
 */
function player_getDY(deltaTime) {
    PLAYER_vy += PLAYER_gravity * PLAYER_gravityDir * deltaTime;
    if (actions.jump && player_isOnGround()) {
        PLAYER_vy = PLAYER_jumpForce * PLAYER_gravityDir;
        actions.jump = false;
        sfx(280, 0.18, 0.10, 3, 0.3, 520);
    }
    return PLAYER_vy * deltaTime;
}

/**
 * 玩家帧更新（替代原tick方法）
 * @param {number} deltaTime - 帧间隔时间
 * @returns {boolean} 是否发生碰撞
 */
function player_tick(deltaTime) {
    if (GAME_awaitingRespawn) return;

    // 黑洞吸入动画：推进并最终触发死亡
    if (GAME_blackHoleSuck) {
        GAME_blackHoleSuck.t += deltaTime;
        if (GAME_blackHoleSuck.t >= GAME_blackHoleSuck.duration) {
            GAME_blackHoleSuck = null;
            gameKillPlayer('SWALLOWED');
        }
        return;
    }

    let dx = player_getDX(deltaTime);
    let dy = player_getDY(deltaTime);
    return player_updatePosition(dx, dy);
}

/**
 * 检查玩家是否在地面（替代原isOnGround方法）
 * @returns {boolean}
 */
function player_isOnGround() {
    const dir = PLAYER_gravityDir;
    const bottom = dir > 0 ? PLAYER_collision.y + PLAYER_collision.height : PLAYER_collision.y;
    const probe = {
        x: PLAYER_collision.x,
        y: dir > 0 ? bottom : bottom - 0.1,
        width: PLAYER_collision.width,
        height: 0.1
    };
    const probeY = dir > 0 ? bottom + 0.0625 : bottom - 0.0625;
    return gamemap_hasTile(Math.floor(PLAYER_collision.x), Math.floor(probeY))
        || gamemap_hasTile(Math.floor(PLAYER_collision.x + PLAYER_collision.width), Math.floor(probeY))
        || AnyfloatRectCollide(probe)
        || AnyOnewayCollide(probe);
}

/**
 * 玩家脚底（重力方向）正下方是否有瓦片（不含平台/单向板）
 * @returns {boolean}
 */
function player_hasTileBelowFeet() {
    const dir = PLAYER_gravityDir;
    const bottom = dir > 0 ? PLAYER_collision.y + PLAYER_collision.height : PLAYER_collision.y;
    const probeY = dir > 0 ? bottom + 0.0625 : bottom - 0.0625;
    return gamemap_hasTile(Math.floor(PLAYER_collision.x), Math.floor(probeY))
        || gamemap_hasTile(Math.floor(PLAYER_collision.x + PLAYER_collision.width), Math.floor(probeY));
}

/**
 * 玩家被平台推动（替代原onPushedHorizontally/Vertically方法）
 * @param {object} perpetratorCollision - 推动者碰撞体
 * @param {number} direction - 推动方向
 * @param {string} axis - 坐标轴 'x' 或 'y'
 * @param {string} deathReason - 挤压死亡原因
 */
function player_onPushed(perpetratorCollision, direction, axis, deathReason) {
    if (direction === 0) return;
    const singleD = direction / 16;
    while (collideRect(perpetratorCollision, {
        x: PLAYER_collision.x,
        y: PLAYER_collision.y,
        width: PLAYER_collision.width,
        height: PLAYER_collision.height
    })) {
        PLAYER_collision[axis] += singleD;
    }
    if (player_checkCollision()) {
        gameKillPlayer(deathReason);
    }
}

/**
 * 更新玩家位置（替代原updatePosition方法）
 * @param {number} dx - 水平位移
 * @param {number} dy - 垂直位移
 * @returns {boolean} 是否发生碰撞
 */
function player_updatePosition(dx, dy) {
    let collided = false;
    const prevY = PLAYER_collision.y;
    const dir = PLAYER_gravityDir;
    const falling = dy * dir > 0; // 是否向重力方向移动
    
    // === 水平移动 + 碰撞回退（瓦片 + floatrect）===
    PLAYER_collision.x += dx;
    if (player_checkCollision()) {
        // 瓦片碰撞 → 水平回退
        PLAYER_collision.x -= dx;
        collided = true;
    } else if (dx !== 0) {
        // floatrect 水平碰撞（像墙一样从侧面挡住）
        for (const trap of TRAP_floatRect_group) {
            if (trap.n) continue;
            if (!collideRect(PLAYER_collision, trap.c)) continue;
            // 玩家在重力方向的表面外侧 → 不阻挡（允许站在上面或跳过头顶）
            const playerEdge = dir > 0 ? PLAYER_collision.y + PLAYER_collision.height : PLAYER_collision.y;
            const trapSurface = dir > 0 ? trap.c.y : trap.c.y + trap.c.height;
            if ((playerEdge - trapSurface) * dir <= 0.01) continue;
            PLAYER_collision.x -= dx;
            collided = true;
            break;
        }
    }
    
    PLAYER_collision.y += dy;
    
    // === 瓦片垂直碰撞回退 ===
    if (player_checkCollision()) {
        PLAYER_collision.y -= dy;
        if (falling) {
            if (Math.abs(PLAYER_vy) > 3) sfx(100, 0.12, 0.08, 0, 0.2, 60);
            PLAYER_vy = 0;
        }
        else if (dy * dir < 0) PLAYER_vy = 0;
        collided = true;
    }
    
    // === floatrect 垂直碰撞 ===
    // 下落：检查是否站在 floatrect 上
    if (falling) {
        const TOLERANCE = 1 / GAME_tileSize; // 匹配瓦片 Math.floor 的 1 像素容差
        for (const trap of TRAP_floatRect_group) {
            if (trap.n) continue;
            // 玩家脚底下方已有不动 tile（站在其它地面）→ 不接住，避免被拉进 tile
            if (player_hasTileBelowFeet()) continue;
            // 用容差检测：玩家在重力方向的表面附近也算碰撞
            const pc = PLAYER_collision;
            const tc = trap.c;
            const overlaps = pc.x <= tc.x + tc.width &&
                             pc.x + pc.width >= tc.x &&
                             pc.y <= tc.y + tc.height + (dir < 0 ? TOLERANCE : 0) &&
                             pc.y + pc.height >= tc.y - (dir > 0 ? TOLERANCE : 0);
            if (!overlaps) continue;
            if (dir > 0 ? prevY + PLAYER_collision.height <= tc.y + 0.01
                        : prevY >= tc.y + tc.height - 0.01) {
                PLAYER_collision.y = dir > 0 ? tc.y - PLAYER_collision.height : tc.y + tc.height;
                PLAYER_vy = 0;
                collided = true;
                break;
            }
        }
    }
    
    // 上跳：检查是否撞到 floatrect 底部（天花板）
    if (!falling && !collided) {
        for (const trap of TRAP_floatRect_group) {
            if (trap.n) continue;
            if (!collideRect(PLAYER_collision, trap.c)) continue;
            if (dir > 0 ? prevY + PLAYER_collision.height >= trap.c.y + trap.c.height - 0.01
                        : prevY <= trap.c.y + 0.01) {
                PLAYER_collision.y = dir > 0 ? trap.c.y + trap.c.height : trap.c.y - PLAYER_collision.height;
                PLAYER_vy = 0;
                collided = true;
                break;
            }
        }
    }
    
    // 单向平台碰撞检测（仅下落时，没被 tile 或 floatrect 挡住，且移动前在平台表面外侧）
    if (falling && !collided) {
        for (const trap of TRAP_oneway_group) {
            if (trap.n) continue;
            if (!collideRect(PLAYER_collision, trap.c)) continue;
            if (dir > 0 ? prevY + PLAYER_collision.height <= trap.c.y + 0.01
                        : prevY >= trap.c.y + trap.c.height - 0.01) {
                PLAYER_collision.y = dir > 0 ? trap.c.y - PLAYER_collision.height : trap.c.y + trap.c.height;
                PLAYER_vy = 0;
                collided = true;
                break;
            }
        }
    }
    
    const fellOut = dir > 0 ? PLAYER_collision.y > GAME_mapHeight : PLAYER_collision.y + PLAYER_collision.height < 0;
    if (fellOut && !GAME_awaitingRespawn) {
        // 12-2跳入虚空 → corridor（带冠/无冠皆可进隐藏关；带冠抉择移师13-3）
        if (typeof GAME_currentLevelIndex !== 'undefined' && GAME_currentLevelIndex === GAME_NORMAL_LAST_INDEX) {
            gameEnterHiddenRealm();
            return collided;
        }
        // 13-3掉出顶部 → 通关（带冠与否由 gameOnDestinationReached 决定）
        if (typeof GAME_currentLevelIndex !== 'undefined' && GAME_currentLevelIndex === GAME_HIDDEN_START_INDEX + 2) {
            gameOnDestinationReached();
            return collided;
        }
        gameKillPlayer('FALLEN');
    }
    return collided;
}

/**
 * 检查玩家碰撞（替代原checkCollision方法）
 * @returns {boolean}
 */
function player_checkCollision() {
    const thisCollision = {
        x: PLAYER_collision.x,
        y: PLAYER_collision.y,
        width: PLAYER_collision.width,
        height: PLAYER_collision.height
    };
    // 底部两角使用微小偏移，避免 Math.floor 精度问题导致站在地面时误判碰撞
    const eps = 0.001;
    const points = [
        {x: thisCollision.x, y: thisCollision.y},
        {x: thisCollision.x + thisCollision.width, y: thisCollision.y},
        {x: thisCollision.x, y: thisCollision.y + thisCollision.height - eps},
        {x: thisCollision.x + thisCollision.width, y: thisCollision.y + thisCollision.height - eps}
    ];
    for (const p of points) {
        if (gamemap_hasTile(Math.floor(p.x), Math.floor(p.y))) return true;
    }
    return false;
}

// ===================== 王冠系统 =====================
// 主体色相随时间连续循环渐变，顶部白色宝珠固定
const PLAYER_CROWN_CYCLE_SECONDS = 2.8; // 渐变循环一周所需秒数
// 像素王冠模板（'.'=透明，其余=主体色，'W'=白色宝珠）
const PLAYER_CROWN_PIXELS = [
    '......WW......',
    '......##......',
    '.#....##....#.',
    '.##..####..##.',
    '.###.####.###.',
    '.############.',
    '.############.',
];

/**
 * 在角色头顶绘制像素王冠
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} drawX - 角色精灵左边缘（世界像素）
 * @param {number} drawY - 角色精灵顶边（世界像素）
 * @param {number} drawW - 角色精灵宽度（世界像素）
 */
function player_renderCrown(ctx, drawX, drawY, drawW) {
    const t = performance.now() / 1000;
    const hue = (t / PLAYER_CROWN_CYCLE_SECONDS * 360) % 360;
    const gw = PLAYER_CROWN_PIXELS[0].length;
    const gh = PLAYER_CROWN_PIXELS.length;
    const scale = Math.max(1, Math.round(drawW * 0.56 / gw));
    const crownW = gw * scale;
    const crownH = gh * scale;
    const px = Math.round(drawX + (drawW - crownW) / 2);
    const py = Math.round(drawY - crownH);
    for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
            const ch = PLAYER_CROWN_PIXELS[y][x];
            if (ch === '.') continue;
            ctx.fillStyle = ch === 'W' ? '#ffffff' : `hsl(${hue}, 90%, 55%)`;
            ctx.fillRect(px + x * scale, py + y * scale, scale, scale);
        }
    }
    // 王冠光晕：冠周一圈随色相脉动的辉光（呼应颜色=记忆主题）
    ctx.globalAlpha = 0.4 + 0.35 * Math.sin(t * 9);
    ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
    ctx.lineWidth = scale;
    ctx.strokeRect(px - scale, py - scale, crownW + 2 * scale, crownH + 2 * scale);
    ctx.globalAlpha = 1;
}

/**
 * 渲染玩家（替代原render方法）
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 */
function player_render(ctx) {
    if (GAME_awaitingRespawn) return;

    // 黑洞吸入：红色碰撞箱缩小并被吸向洞心
    if (GAME_blackHoleSuck) {
        player_renderSuck(ctx);
        return;
    }

    // 玩家以红色碰撞箱表示（世界坐标即原生像素，1 tile=16px）
    const ts = GAME_tileSize;
    const x = PLAYER_collision.x * ts;
    const y = PLAYER_collision.y * ts;
    const w = PLAYER_collision.width * ts;
    const h = PLAYER_collision.height * ts;
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(x, y, w, h);
    // 王冠画在碰撞箱顶部（碰撞箱居中对称，无需朝向镜像/重力翻转）
    if (GAME_hasCrown) player_renderCrown(ctx, x, y, w);
}

/**
 * 黑洞吸入渲染：红色碰撞箱从起点逐渐缩小并移向洞心
 * @param {CanvasRenderingContext2D} ctx
 */
function player_renderSuck(ctx) {
    const s = GAME_blackHoleSuck;
    const p = Math.min(1, s.t / s.duration);
    const ts = GAME_tileSize;
    // 目标实时跟随移动中的黑洞位置
    const trap = TRAP_instances[s.id];
    if (!trap) return;
    const toX = trap.c.x + trap.c.width / 2;
    const toY = trap.c.y + trap.c.height / 2;
    const cx = (s.fromX + (toX - s.fromX) * p) * ts;
    const cy = (s.fromY + (toY - s.fromY) * p) * ts;
    const w = PLAYER_collision.width * ts * (1 - p);
    const h = PLAYER_collision.height * ts * (1 - p);
    if (w < 1 || h < 1) return;
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
}