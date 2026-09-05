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
// 黑洞吸入等仍用红色碰撞箱表现
const PLAYER_COLOR = '#ff0000';
// 独角兽矢量精灵（移植 tools/unicorn_canvas）
let PLAYER_face = 1;   // 朝向 1=朝右 -1=朝左
let PLAYER_runPh = 0;  // 奔跑步态相位
const UC_S = 0.35;        // 缩放槽位：1 设计像素=1 原生像素（待微调）
const UC_EYE_MIN = 2;     // 眼睛在屏幕上至少占的真实(物理)像素数（按放大倍率动态换算）
const UC_BW = 26, UC_BH = 20, UC_LL = 22, UC_SW = 0.22, UC_BB = 1.3, UC_RF = 10;
const UC_CB = '#000', UC_CH = '#000', UC_Ho = '#fff';
const UC_CLF = '#000', UC_CLN = '#000', UC_CE = '#fff', UC_OL = 'rgba(0,0,0,0.15)';
// 腿表：[髋x, 近侧?, 后腿=-1/前腿=1, 对角相位组]
const UC_LG = [[-8, 0, -1, 1], [-6.5, 1, -1, 0], [6.5, 0, 1, 0], [8, 1, 1, 1]];
// 离屏精灵画布（矢量→像素最近采样用）
let UC_sp = null;
const UC_SPW = 88, UC_SPH = 100;

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
    // 矢量独角兽：朝向 + 奔跑步态推进（仅地面移动时）
    const ax = (actions.right ? 1 : 0) - (actions.left ? 1 : 0);
    if (ax) PLAYER_face = ax;
    if (ax && player_isOnGround()) PLAYER_runPh += deltaTime * UC_RF;
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
/**
 * 独角兽：在“身体中心为原点、已按朝向/重力镜像、局部 +y 向下”的坐标系里整只画出。
 * 姿态读实时状态：待机呼吸 / 地面移动摆腿 / 滞空收张腿。
 * @param {CanvasRenderingContext2D} ctx - 已变换到身体中心原点的上下文
 */
function UC_draw(ctx) {
    const t = performance.now() / 1e3;
    const ground = player_isOnGround();
    const ax = (actions.right ? 1 : 0) - (actions.left ? 1 : 0);
    if (ax) PLAYER_face = ax;
    // 待机：腿不在离屏画，改由 player_render 在主画布直接画两条 3px 整数腿
    const idle = ground && !ax;
    let lean = 0.02, bob = 0, k = 1;
    const A = [0, 0, 0, 0];
    if (!ground) {
        // 滞空：上升段随减速张开；顶点与整段坠落保持双腿前后分开
        const rising = PLAYER_vy * PLAYER_gravityDir < 0;
        const u = rising ? 1 - Math.min(1, Math.abs(PLAYER_vy) / 9) : 1;
        for (let i = 4; i--;) A[i] = UC_LG[i][2] * u * 0.55;
        k = 1 - 0.35 * u;
        lean = 0.1;
    } else if (ax) {
        // 奔跑：腿近乎竖直小摆（避免斜线栅格化导致前后腿粗细抖动），用明显身体起伏表现奔跑
        const w = PLAYER_runPh;
        bob = Math.abs(Math.sin(w)) * UC_BB;
        lean = 0.1;
        for (let i = 4; i--;) A[i] = Math.sin(w + (UC_LG[i][2] < 0 ? Math.PI : 0)) * UC_SW;
    }
    // 待机：无动作（静止直立，不呼吸起伏/不摆腿）
    const pn = (pts, c) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = c;
        ctx.fill();
        ctx.strokeStyle = UC_OL;
        ctx.lineWidth = 1;
        ctx.stroke();
    };
    const ln = (x1, y1, x2, y2, c, w) => {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    };
    // 全身：起伏上浮 + 绕髋部（身体底）前倾
    ctx.translate(0, -bob);
    ctx.translate(0, UC_BH / 2);
    ctx.rotate(lean);
    ctx.translate(0, -UC_BH / 2);
    // 腿（远/近）——待机由 player_render 主画布直画 3px 整数腿，离屏不画
    if (!idle) {
        // 远侧腿（身后）
        for (let i = 4; i--;) {
            const L = UC_LG[i];
            if (L[1]) continue;
            ln(L[0], UC_BH / 2, L[0] + Math.sin(A[i]) * UC_LL * k, UC_BH / 2 + Math.cos(A[i]) * UC_LL * k, UC_CLF, 6);
        }
    }
    // 脖子（粗壮、从肩明显前倾到头下，避免细直长颈）
    pn([[0, -3], [11, -3], [17, -16], [5, -17]], UC_CB);
    // 头：朝前上斜伸的尖头，口鼻在前（贴近身体上方，不像长颈怪）
    pn([[8, -20], [25, -16], [10, -8]], UC_CH);
    // 角：头顶前部朝右上前
    pn([[14, -18], [18, -18], [16.5, -25]], UC_Ho);
    // 身体（方形块，盖住颈根）
    pn([[-13, -10], [13, -10], [13, 10], [-13, 10]], UC_CB);
    // 近侧腿（身前）
    if (!idle) {
        for (let i = 4; i--;) {
            const L = UC_LG[i];
            if (!L[1]) continue;
            ln(L[0], UC_BH / 2, L[0] + Math.sin(A[i]) * UC_LL * k, UC_BH / 2 + Math.cos(A[i]) * UC_LL * k, UC_CLN, 6);
        }
    }
    // 王冠：位于头部前上方（含脉动光晕）
    if (GAME_hasCrown) {
        const hue = (t / PLAYER_CROWN_CYCLE_SECONDS * 360) % 360;
        const gw = PLAYER_CROWN_PIXELS[0].length;
        const gh = PLAYER_CROWN_PIXELS.length;
        const cs = Math.max(1, Math.round(UC_S * 1.5));
        const px0 = 16 - gw * cs / 2;
        const py0 = -20 - (gh - 1) * cs;
        for (let y = 0; y < gh; y++) {
            for (let x = 0; x < gw; x++) {
                const ch = PLAYER_CROWN_PIXELS[y][x];
                if (ch === '.') continue;
                ctx.fillStyle = ch === 'W' ? '#ffffff' : `hsl(${hue}, 90%, 55%)`;
                ctx.fillRect(px0 + x * cs, py0 + y * cs, cs, cs);
            }
        }
        ctx.globalAlpha = 0.4 + 0.35 * Math.sin(t * 9);
        ctx.strokeStyle = `hsl(${hue}, 100%, 70%)`;
        ctx.lineWidth = cs;
        ctx.strokeRect(px0 - cs, py0 - cs, gw * cs + 2 * cs, gh * cs + 2 * cs);
        ctx.globalAlpha = 1;
    }
}

/**
 * 渲染玩家（替代原render方法）：矢量独角兽替换红色碰撞箱
 * @param {CanvasRenderingContext2D} ctx - 画布上下文
 */
function player_render(ctx) {
    if (GAME_awaitingRespawn) return;

    // 黑洞吸入：红色碰撞箱缩小并被吸向洞心
    if (GAME_blackHoleSuck) {
        player_renderSuck(ctx);
        return;
    }

    // 世界坐标即原生像素（1 tile=16px）；脚锚定在重力方向的着地侧
    const ts = GAME_tileSize, c = PLAYER_collision, dir = PLAYER_gravityDir;
    ctx.save();
    ctx.translate((c.x + c.width / 2) * ts, (dir > 0 ? c.y + c.height : c.y) * ts);
    ctx.scale(UC_S * PLAYER_face, dir > 0 ? UC_S : -UC_S);
    ctx.translate(0, -UC_BH / 2 - UC_LL);
    // 矢量先画进离屏精灵（1 设计像素=1 精灵像素），再最近采样贴回主画布，去掉边缘抗锯齿渐变
    if (!UC_sp) {
        UC_sp = document.createElement('canvas');
        UC_sp.width = UC_SPW;
        UC_sp.height = UC_SPH;
    }
    const sc = UC_sp.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, UC_SPW, UC_SPH);
    sc.translate(UC_SPW / 2, UC_SPH / 2);
    UC_draw(sc);
    // 量化精灵像素为纯黑/纯白/透明：消除矢量抗锯齿留下的半透明过渡像素
    UC_quantize();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(UC_sp, -UC_SPW / 2, -UC_SPH / 2);
    // 待机：直接在主画布画两条 3px 竖直黑腿（整数对齐，无缩放→宽恒定）
    if (player_isOnGround() && !((actions.right ? 1 : 0) - (actions.left ? 1 : 0))) {
        const tf = ctx.getTransform();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const fax = (c.x + c.width / 2) * ts;
        const fa = (dir > 0 ? c.y + c.height : c.y) * ts;
        const yB = Math.round(fa);
        const Lh = Math.round(UC_LL * UC_S) + 2;
        const yT = dir > 0 ? yB - Lh : yB;
        ctx.fillStyle = UC_CLN;
        // 后近腿 / 前近腿
        ctx.fillRect(Math.round(fax - 6.5 * UC_S * PLAYER_face) - 1, yT, 3, Lh);
        ctx.fillRect(Math.round(fax + 8 * UC_S * PLAYER_face) - 1, yT, 3, Lh);
        ctx.setTransform(tf);
    }
    // 眼睛：按真实屏像素动态定最小尺寸（内部 1px = k*dpr 真实像素），保证 ≥UC_EYE_MIN 真实像素且尽量小
    {
        const tf = ctx.getTransform();
        const ex = tf.a * 17 + tf.c * -13.5 + tf.e;
        const ey = tf.b * 17 + tf.d * -13.5 + tf.f;
        const real = GAME_scaleK * (window.devicePixelRatio || 1);
        const es = Math.max(1, Math.ceil(UC_EYE_MIN / real));
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = UC_CE;
        ctx.fillRect(Math.round(ex - es / 2), Math.round(ey - es / 2), es, es);
        ctx.setTransform(tf);
    }
    ctx.restore();
}

// 读回精灵并逐像素量化（硬边像素马）
function UC_quantize() {
    const sc = UC_sp.getContext('2d');
    const img = sc.getImageData(0, 0, UC_SPW, UC_SPH);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (a < 128) { d[i + 3] = 0; continue; }
        d[i + 3] = 255;
        const v = (d[i] + d[i + 1] + d[i + 2]) / 3 > 160 ? 255 : 0;
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
    sc.putImageData(img, 0, 0);
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