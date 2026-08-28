// 核心游戏逻辑：输入、关卡、函数式重构（替代原Game类）
const actions = {
    left: false,
    right: false,
    jump: false
};

const keyMappings = {
    'a': 'left',
    'ArrowLeft': 'left',
    'd': 'right',
    'ArrowRight': 'right',
    'w': 'jump',
    ' ': 'jump',
    'ArrowUp': 'jump',
};

document.addEventListener('keydown', (e) => {
    // 开场介绍：空格开始
    if (GAME_introPending) {
        e.preventDefault();
        if (e.key === ' ' || e.code === 'Space') gameIntroDismiss();
        return;
    }
    // 真结局：R 重开
    if (GAME_endingShown) {
        e.preventDefault();
        if (e.key === 'r' || e.key === 'R') gameRestartAfterEnding();
        return;
    }
    // 王冠抉择：左=放手，右=保留
    if (GAME_crownChoicePending) {
        e.preventDefault();
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            gameCrownReturn();
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            gameCrownKeep();
        }
        return;
    }
    // R 键自杀
    if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        gameKillPlayer('SUICIDE');
        return;
    }
    if (GAME_awaitingRespawn && (e.key === ' ' || e.code === 'Space')) {
        gameRetry();
        return;
    }
    const action = keyMappings[e.key];
    if (action) {
        actions[action] = true;
        return;
    }
});
document.addEventListener('keyup', (e) => {
    const action = keyMappings[e.key];
    if (action) actions[action] = false;
});

// ==================== 关卡定义（1-7章×3 + 8章×2 + 9章×3 + 10-12章×2 + 走廊 + 隐藏章×3 = 39关） ====================
// 第13章 "The Abandoned Place" 为隐藏区：12-2坠落 → corridor → 触碰Dest → 13-1
const GAME_NORMAL_LAST_INDEX = 31;    // 12-2 在数组中的索引
const GAME_CORRIDOR_INDEX = 32;       // corridor 过渡关
const GAME_HIDDEN_START_INDEX = 33;   // 13-1 在数组中的索引

const levels = (function() {
    const lvls = [];
    // 每章配色
    const themes = [
        { bg: 'rgb(240, 230, 140)', fg: 'rgb(139, 69, 19)' },
        { bg: 'rgb(168, 121, 186)', fg: 'rgb(125, 45, 236)' },
        { bg: 'rgb(61, 175, 207)', fg: 'rgb(26, 44, 237)' },
        { bg: 'rgb(237, 27, 27)', fg: 'rgb(126, 3, 3)' },
        { bg: 'rgb(120, 180, 100)', fg: 'rgb(30, 100, 30)' },
        { bg: 'rgb(230, 170, 80)', fg: 'rgb(180, 80, 20)' },
        { bg: 'rgb(100, 190, 190)', fg: 'rgb(0, 90, 100)' },
        { bg: 'rgb(210, 140, 180)', fg: 'rgb(150, 30, 80)' },
        { bg: 'rgb(130, 200, 220)', fg: 'rgb(10, 80, 120)' },
        { bg: 'rgb(190, 170, 130)', fg: 'rgb(100, 60, 30)' },
        { bg: 'rgb(150, 160, 170)', fg: 'rgb(50, 55, 70)' },
        { bg: 'rgb(180, 80, 80)', fg: 'rgb(90, 10, 10)' },
    ];
    const spawnPoints = [
        // 1-7章 ×3
        [5, 8], [5, 8], [5, 8],
        [7, 7], [2, 5], [16, 1],
        [6, 10], [5, 5], [9, 5],
        [3, 9], [4, 9], [4, 10], 
        [3, 9], [3, 10], [4, 10], 
        [3, 7], [3, 8], [2, 10], 
        [2, 2], [3, 12], [5, 6], 
        // 8章 ×2
        [3, 10], [9, 7],
        // 9章 ×3 (9-3 待做)
        [3, 9], [4, 12], [5, 9],
        // 10章 ×2 (待做)
        [3, 12], [3, 1],
        // 11章 ×2 (待做)
        [3, 3], [4, 3],
        // 12章 ×2
        [23, 11], [1, 10],
    ];
    const chapterLevelCounts = [3, 3, 3, 3, 3, 3, 3, 2, 3, 2, 2, 2];
    let level_fullID = 0;
    for (let ch = 1; ch <= 12; ch++) {
        const t = themes[ch - 1];
        for (let p = 1; p <= chapterLevelCounts[ch - 1]; p++) {
            lvls.push({
                id:  (ch - 1) * 3 + p,
                playerSpawn: {
                    x: spawnPoints[level_fullID][0],
                    y: spawnPoints[level_fullID][1]
                },
                backgroundColor: t.bg,
                foregroundColor: t.fg,
                binaryFile: `lvl/${ch}-${p}.bin`
            });
            level_fullID++;
        }
    }
    // corridor — 从12-2坠落后的过渡关 (统一 id=37)
    lvls.push({
        id: 37,
        playerSpawn: { x: 5, y: 0 },
        backgroundColor: 'rgb(20, 18, 25)',
        foregroundColor: 'rgb(100, 95, 110)',
        binaryFile: 'lvl/corridor.bin'
    });
    // 隐藏章 — The Abandoned Place (统一 id=38~40)
    const hiddenTheme = { bg: 'rgb(40, 35, 45)', fg: 'rgb(160, 155, 165)' };
    const hiddenLevelSpawnpoints = [
        [8, 5], [3, 12], [7, 7]
    ]
    for (let p = 0; p < 3; p++) {
        lvls.push({
            id: 38 + p, // 38, 39, 40
            playerSpawn: { x: hiddenLevelSpawnpoints[p][0], y: hiddenLevelSpawnpoints[p][1] },
            backgroundColor: hiddenTheme.bg,
            foregroundColor: hiddenTheme.fg,
            binaryFile: `lvl/13-${p + 1}.bin`,
            hidden: true
        });
    }
    return lvls;
})();

/**
 * 关卡显示名：正常关卡为 "章-关"（如 3-2）
 * @param {number} levelIndex 关卡数组索引
 * @returns {string}
 */
function gameLevelDisplayName(levelIndex) {
    if (levelIndex === GAME_CORRIDOR_INDEX) return COPY.corridorLabel;
    if (levelIndex >= GAME_HIDDEN_START_INDEX) return COPY.displayHidden(levelIndex - GAME_HIDDEN_START_INDEX + 1);
    const id = levels[levelIndex].id - 1;
    return `${Math.floor(id / 3) + 1}-${id % 3 + 1}`;
}

// -------------------------- 全局变量 --------------------------
// system（画布/世界相关引用已移入 ui.js）
let GAME_tileSize = 16;
let GAME_worldScale = 5;         // 世界内部渲染缩放（瓦片 16→80px）
let GAME_characterScale = 4;     // 角色内部渲染缩放（精灵 24×32→96×128px，4:5≈0.8 比例）

// map
let GAME_mapWidth = 32;
let GAME_mapHeight = 16;

// 合并关卡缓存（lvl.bin + 各关偏移表，指针式加载）
let GAME_lvlBuffer = null;    // lvl.bin 的 ArrayBuffer
let GAME_lvlOffsets = [];     // 各关在 lvl.bin 中的起始字节偏移
let GAME_levelPtr = 0;        // 当前关起始偏移（存档点）

// script
let GAME_waitingForEvent = -1;
let GAME_blockedByMovement = false;
let GAME_observingArea = null;
let GAME_waitTimer = 0;

// game state
let GAME_awaitingRespawn = false;
let GAME_paused = false;
let GAME_currentLevelIndex = 0;

// underground
let GAME_rafId = null; // RAF ID
let GAME_levelTransitioning = false; // 关卡切换标记
let GAME_lastTime = 0; // 上一帧时间
let GAME_lastVW = 0, GAME_lastVH = 0; // 视口尺寸缓存（画布适配）

// theme
let GAME_backgroundColor = '#000000';
let GAME_foregroundColor = '#ffffff';

// game state / UI 元素引用见 ui.js
let GAME_isNewCycle = false; // 通关最后一关回到第一关时标记
let GAME_hasCrown = false;   // 打通隐藏关后获得王冠
let GAME_crownedCycles = 0;  // 已进行的王冠轮回次数（保留=轮回+1）
let GAME_totalDeaths = 0;    // 拿冠后的永久死亡计数（cookie 持久化）
let GAME_crownChoicePending = false; // 13-3 丢冠抉择待响应
let GAME_introPending = false; // 开场介绍待响应
let GAME_endingShown = false;  // 真结局画面已展示
let GAME_crownedKept = false;  // 玩家选择了保留王冠（坏循环）
let GAME_crownMoment = false;  // 13-3 得冠瞬间定格中

/** 读取 cookie 值（带 mfxww_game 标识的持久化数据） */
function gameCookieGet(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
}

/** 写入 cookie（默认长期保留，永不清零） */
function gameCookieSet(name, value, days = 3650) {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/`;
}

/** 读取拿冠后的累计死亡数（cookie），无记录则为 0 */
function gameReadTotalDeaths() {
    const v = gameCookieGet('mfxww_game_deaths');
    return v === null ? 0 : parseInt(v, 10) || 0;
}

/** 拿冠后死亡 +1，写回 cookie 并刷新右上角显示 */
function gameIncrementDeaths() {
    GAME_totalDeaths = gameReadTotalDeaths() + 1;
    gameCookieSet('mfxww_game_deaths', GAME_totalDeaths);
    gameRefreshDeathCounter();
}

/** 刷新右上角死亡计数显示（仅带冠时可见） */
function gameRefreshDeathCounter() {
    if (!GAME_deathCounter) return;
    GAME_deathCounter.textContent = COPY.deathCounter(GAME_totalDeaths);
    uiVis(GAME_deathCounter, GAME_hasCrown);
}

/** 将 rgb(r,g,b) 字符串按 t(0..1) 向灰阶 128 插值（王冠循环逐章褪色） */
function desaturateColor(rgbStr, t) {
    const m = rgbStr.match(/\d+/g);
    if (!m || m.length < 3 || t <= 0) return rgbStr;
    const c = m.slice(0, 3).map((v) => {
        const n = parseInt(v, 10);
        return Math.round(n + (128 - n) * t);
    });
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/** 拿冠后 1-1 开场播放 RGB 故障动画（"不对劲"强信号） */
function gamePlayGlitch() {
    if (!GAME_glitchOverlay) return;
    uiOff(GAME_glitchOverlay);
    // 触发重排以重启动画
    void GAME_glitchOverlay.offsetWidth;
    uiOn(GAME_glitchOverlay);
    sfx(70, 0.9, 0.5, 2, 0.7, 30);
    window.setTimeout(() => {
        uiOff(GAME_glitchOverlay);
    }, 950);
}

// -------------------------- 原Game类方法重构为全局函数 --------------------------

/**
 * 画布自适应（替代原 _resizeCanvas 方法）
 */
function gameResizeCanvas() {
    // 设置画布内部分辨率（绘制分辨率）
    GAME_canvas.width = GAME_mapWidth * GAME_tileSize * GAME_worldScale;
    GAME_canvas.height = GAME_mapHeight * GAME_tileSize * GAME_worldScale;
    if (GAME_worldCanvas) {
        GAME_worldCanvas.width = GAME_canvas.width;
        GAME_worldCanvas.height = GAME_canvas.height;
    }

    // 通过 CSS 缩放画布以适配窗口
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.8;
    let scale = Math.min(maxWidth / GAME_canvas.width, maxHeight / GAME_canvas.height);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    // 应用 CSS 大小（取整以避免子像素模糊）
    GAME_canvas.style.width = Math.max(1, Math.floor(GAME_canvas.width * scale)) + 'px';
    GAME_canvas.style.height = Math.max(1, Math.floor(GAME_canvas.height * scale)) + 'px';
    // 像素画面（避免全屏放大时变糊）
    GAME_canvas.style.imageRendering = 'pixelated';
}

/**
 * 确保合并关卡 lvl.bin 已加载（单文件：从页尾切片），并构建各关偏移表
 * @returns {Promise<ArrayBuffer>}
 */
function gameEnsureLvlLoaded() {
    if (GAME_lvlBuffer) return Promise.resolve(GAME_lvlBuffer);
    return gameAssetsLoaded()
        .then(() => {
            GAME_lvlBuffer = GAME_assetsLvl;
            // 扫描 [u8 长度][数据] 构建偏移表（指针定位用）
            GAME_lvlOffsets = [];
            const view = new DataView(GAME_lvlBuffer);
            let ptr = 0;
            while (ptr + 1 <= GAME_lvlBuffer.byteLength) {
                GAME_lvlOffsets.push(ptr);
                ptr += 1 + view.getUint8(ptr);
            }
            return GAME_lvlBuffer;
        });
}

/**
 * 加载关卡核心数据（指针式：从合并 lvl.bin 按偏移切片 → 解析）
 * 被 gameLoadLevel 和 gameRetry 共用
 * @param {number} levelIndex 关卡索引
 * @returns {Promise} 完成时 resolve，失败时 reject
 */
function gameLoadLevelData(levelIndex) {
    const levelData = levels[levelIndex];
    // 双 12-2：无王冠首次到 12-2 用强制坠落版（必进隐藏关），有王冠用正常版
    const isFirst12_2 = levelIndex === GAME_NORMAL_LAST_INDEX && !GAME_hasCrown;
    // 王冠循环：普通关按进度褪色（假设 13-3 为最后一关，缩小褪色峰值；隐藏关保持黑白）
    const isNormal = levelIndex >= 0 && levelIndex <= GAME_NORMAL_LAST_INDEX;
    const fade = GAME_hasCrown && isNormal ? levelIndex / (GAME_HIDDEN_START_INDEX + 2) : 0;
    const bg = fade > 0 ? desaturateColor(levelData.backgroundColor, fade) : (levelData.backgroundColor || '#000000');
    const fg = fade > 0 ? desaturateColor(levelData.foregroundColor, fade) : (levelData.foregroundColor || '#ffffff');

    return Promise.all([
        gameEnsureLvlLoaded(),
        initializeSpriteFramesFromBinFile('img.bin', fg, bg, GAME_SpriteRects)
    ])
    .then(([lvlBuf, spriteCache]) => {
        GAME_SpriteFrameCache = spriteCache;
        PLAYER_horseCanvases = spriteCache;

        // 指针定位：void 版 12-2 在合并文件最后一块（偏移表末项），其余按索引
        const voidOffset = GAME_lvlOffsets.length - 1;
        const ptr = isFirst12_2 ? GAME_lvlOffsets[voidOffset] : GAME_lvlOffsets[levelIndex];
        GAME_levelPtr = ptr; // 存档点
        const view = new DataView(lvlBuf);
        const len = view.getUint8(ptr);
        const slice = lvlBuf.slice(ptr + 1, ptr + 1 + len);

        GAME_backgroundColor = bg;
        GAME_foregroundColor = fg;

        parseLevelBinaryStream(slice);

        GAME_observingArea = null;
        GAME_blockedByMovement = false;
        GAME_currentLevelIndex = levelIndex;
        // 13-3（隐藏章第3关）重力倒置
        PLAYER_gravityDir = levelIndex === GAME_HIDDEN_START_INDEX + 2 ? -1 : 1;
        GAME_waitingForEvent = -1;
        GAME_awaitingRespawn = false;
        GAME_blackHoleSuck = null;

        const spawn = levelData.playerSpawn || { x: 0, y: 0 };
        player_setPosition(spawn.x, spawn.y);

        GAME_levelTransitioning = false;
        // BGM：单曲循环
        bgmPlay('0.3.7.5.3.0.7.9', 220, 160, 3);
        gameStart();
    });
}

/**
 * 加载关卡（替代原 loadLevel 方法）
 * @param {number} levelIndex 关卡在关卡列表中的索引，并非关卡id
 */
function gameLoadLevel(levelIndex) {
    // 0. 基础准备
    GAME_awaitingRespawn = false;
    uiOff(GAME_deathOverlay);
    GAME_lastTime = performance.now();
    Object.keys(actions).forEach(key => actions[key] = false);

    // 1. 验证关卡索引
    const levelData = levels[levelIndex];
    // 标记关卡切换中
    GAME_levelTransitioning = true;

    // 启动过渡动画
    gameBeginTransition(levelIndex);

    // 3. 加载数据（合并 lvl.bin 指针式）
    gameLoadLevelData(levelIndex)
        .then(() => {
            // 更新关卡信息
            GAME_levelDisplay.textContent = gameLevelDisplayName(levelIndex);

            // 清除过渡动画
            uiOff(GAME_transitionMessage);
            window.setTimeout(() => {
                uiOff(GAME_transitionOverlay);
                uiVis(GAME_headerBar, true);
            }, 400);
        });
}

/**
 * 读取并执行一条脚本指令（替代原 evalInstruction + nextScriptInstruction）
 * @returns {boolean} 是否还有后续指令
 */
function gameStepScript() {
    if (LP_currentScriptIndex >= LP_scriptInstructionCount) return false;
    LP_currentScriptIndex++;

    if (BinaryReader_readBit() === '1') { // move
        trapManagerRegisterMovement([
            BinaryReader_readBits(6),
            BinaryReader_readBits2SingleFloatNumber(6),
            BinaryReader_readBits2SingleFloatNumber(5),
            BinaryReader_readBits2QuarterFloatNumber(6),
            BinaryReader_readBit() === '1'
        ]);
    } else { // wait
        const eventType = BinaryReader_readBits(2);
        GAME_waitingForEvent = eventType;
        switch (eventType) {
            case 0: // player-in-area
                GAME_observingArea = {
                    x: BinaryReader_readBits(5),
                    y: BinaryReader_readBits(4),
                    width: BinaryReader_readBits(3),
                    height: BinaryReader_readBits(3)
                };
                break;
            case 1: // button-press
                buttonOnGameRegister(BinaryReader_readBits(6));
                break;
            case 2: // for-seconds
                GAME_waitTimer = BinaryReader_readBits2SingleFloatNumber(6) * 1000 + Date.now();
                break;
        }
    }
    return true;
}

/**
 * 检查事件触发状态（替代原 checkEvent 方法）
 */
function gameCheckEvent() {
    switch (GAME_waitingForEvent) {
        case 0: // player-in-area
            if (!GAME_observingArea || collideRect(PLAYER_collision, GAME_observingArea)) {
                GAME_waitingForEvent = -1;
                GAME_observingArea = null;
            }
            break;
        case 1: // Button-press
            // 注册的按钮会回调
            break;
        case 2: // for-seconds
            if (GAME_waitTimer <= Date.now()) {
                GAME_waitingForEvent = -1;
                GAME_waitTimer = 0;
            }
            break;
        case -1: // 无等待
            break;
    }
}

/**
 * 启动游戏循环（替代原 start 方法）
 */
function gameStart() {
    // 取消已有RAF避免重复循环
    if (GAME_rafId) cancelAnimationFrame(GAME_rafId);
    GAME_lastTime = performance.now();
    gameLoop();
}

/**
 * 游戏主循环（替代原 gameLoop 方法）
 */
function gameLoop() {
    if (GAME_levelTransitioning) return;
    // 视口变化即重算画布（覆盖嵌入/小窗不触发 resize 的情况）
    if (innerWidth !== GAME_lastVW || innerHeight !== GAME_lastVH) {
        GAME_lastVW = innerWidth;
        GAME_lastVH = innerHeight;
        gameResizeCanvas();
    }
    
    if (!GAME_paused) {
        const now = performance.now();
        // 钳制 deltaTime：避免掉帧时物理/动画一帧大幅跳动
        const deltaTime = Math.min((now - GAME_lastTime) / 1000, 0.05);
        GAME_lastTime = now;
        gameTick(deltaTime);
        gameRender();
    }
    
    // 保存RAF ID以便后续取消
    GAME_rafId = requestAnimationFrame(gameLoop);
}

/**
 * 帧更新逻辑（替代原 tick 方法）
 * @param {number} deltaTime 帧间隔（秒）
 */
function gameTick(deltaTime) {
    if (GAME_crownMoment) return; // 得冠瞬间定格（仅渲染，逻辑暂停）
    player_tick(deltaTime);
    
    // 陷阱更新
    trapManagerTick(deltaTime);
    
    // 黑洞尾迹粒子更新
    blackHoleTrailTick(deltaTime);
    
    // 指令执行
    if (GAME_awaitingRespawn) return; // 死亡期间脚本暂停，只保留已注册的陷阱移动
    if (GAME_blackHoleSuck) return;   // 黑洞吸入动画期间暂停脚本
    if (GAME_waitingForEvent === -2) return;
    if (GAME_blockedByMovement) return;
    
    if (GAME_waitingForEvent === -1) {
        // 执行下一条指令
        if (!gameStepScript()) {
            GAME_waitingForEvent = -2;
        }
    } else {
        // 检查事件
        gameCheckEvent();
    }
}

/**
 * 渲染帧（替代原 render 方法）
 * 世界（背景+陷阱+地形）以 GAME_worldScale 渲染到离屏画布，角色以原生像素尺寸叠加
 */
function gameRender() {
    const wctx = GAME_worldContext;
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.imageSmoothingEnabled = false;
    wctx.fillStyle = GAME_backgroundColor;
    wctx.fillRect(0, 0, GAME_worldCanvas.width, GAME_worldCanvas.height);
    wctx.setTransform(GAME_worldScale, 0, 0, GAME_worldScale, 0, 0);
    trapManagerRender(wctx);
    gamemap_render(wctx);
    blackHoleTrailRender(wctx);
    renderRingExplosion(wctx);
    // 迁移像素化世界图到可见画布（1:1，保持锐利）
    GAME_ctx.setTransform(1, 0, 0, 1, 0, 0);
    GAME_ctx.imageSmoothingEnabled = false;
    GAME_ctx.drawImage(GAME_worldCanvas, 0, 0);
    // 角色按原生像素尺寸绘制在可见画布上
    player_render(GAME_ctx);
}

/**
 * 到达目标点回调（替代原 onDestinationReached 方法）
 */
function gameOnDestinationReached() {
    sfx(660, 0.45, 0.18, 0, 0.5);
    sfx(880, 0.5, 0.25, 0, 0.5, 0, 0, 120);
    sfx(1100, 0.35, 0.35, 3, 0.3, 0, 0, 260);

    // 避免重复切换关卡
    if (GAME_levelTransitioning || GAME_crownMoment) {
        return;
    }

    // 切换关卡
    if (GAME_currentLevelIndex === GAME_NORMAL_LAST_INDEX) {
        // 12-2 通关 → 轮回到 1-1（王冠循环不因通关而断，王冠保留）
        GAME_currentLevelIndex = 0;
        GAME_isNewCycle = true;
        // 轮回音效
        sfx(440, 0.25, 0.25, 3, 0.4);
        sfx(349, 0.25, 0.35, 0, 0.3, 0, 0, 180);
        sfx(262, 0.2, 0.5, 0, 0.2, 0, 0, 380);
    } else if (GAME_currentLevelIndex === GAME_CORRIDOR_INDEX) {
        // corridor 触碰Dest → 进入 13-1
        GAME_currentLevelIndex = GAME_HIDDEN_START_INDEX;
    } else if (GAME_currentLevelIndex >= GAME_HIDDEN_START_INDEX) {
        if (GAME_currentLevelIndex < levels.length - 1) {
            GAME_currentLevelIndex++;
        } else if (GAME_hasCrown) {
            // 带冠回到13-3 → 丢冠抉择（不再重复得冠）
            gameCrownChoice();
        } else {
            // 13-3 通关 → 获得王冠，短暂定格展示戴冠瞬间，再轮回
            const sp = levels[GAME_currentLevelIndex].playerSpawn;
            GAME_currentLevelIndex = 0;
            GAME_isNewCycle = true;
            GAME_hasCrown = true;
            GAME_crownedKept = false;
            GAME_crownedCycles = 0;
            GAME_totalDeaths = gameReadTotalDeaths();
            gameRefreshDeathCounter(); // 显示右上角计数
            // 王冠音效 — C-E-G-C 上行琶音
            sfx(523, 0.35, 0.18, 0, 0.5, 0, -0.2);
            sfx(659, 0.35, 0.18, 0, 0.5, 0, 0, 130);
            sfx(784, 0.4, 0.25, 0, 0.5, 0, 0.2, 260);
            sfx(1047, 0.3, 0.5, 3, 0.3, 0, 0, 400);
            // 王冠瞬间：回到出生点定格戴冠（王冠色相循环闪动 + 琶音），随后轮回
            GAME_crownMoment = true;
            player_setPosition(sp.x, sp.y);
            setTimeout(() => { GAME_crownMoment = false; gameLoadLevel(0); }, 800);
            return; // 跳过底部立即转场
        }
    } else {
        GAME_currentLevelIndex++;
    }
    gameLoadLevel(GAME_currentLevelIndex);
}

/**
 * 按钮按下回调（替代原 onButtonPressed 方法）
 */
function gameOnButtonPressed() {
    if (GAME_waitingForEvent !== -1) GAME_waitingForEvent = -1;
}

/**
 * 进入隐藏关卡 — 从12-2虚空坠入 The Abandoned Place
 */
function gameEnterHiddenRealm() {
    GAME_awaitingRespawn = false;
    uiOff(GAME_deathOverlay);
    GAME_currentLevelIndex = GAME_CORRIDOR_INDEX;
    gameLoadLevel(GAME_currentLevelIndex);
}

/**
 * 带冠坠入 12-2 虚空 → 弹出丢冠抉择
 */
function gameCrownChoice() {
    if (GAME_crownChoicePending) return;
    GAME_crownChoicePending = true;
    GAME_paused = true;
    bgmStop();
    // 轮回次数越多，抉择文案越接近真相
    if (GAME_crownedCycles > 0) {
        GAME_crownChoiceMessage.textContent = COPY.choiceAgain(GAME_crownedCycles + 1);
    } else {
        GAME_crownChoiceMessage.textContent = COPY.choiceFirst;
    }
    uiOn(GAME_crownChoiceOverlay);
    sfx(180, 0.6, 0.3, 0, 0.5, 55);
}

/** 放手：丢王冠入虚空 → 真结局（揭示因果闭环真相） */
function gameCrownReturn() {
    if (!GAME_crownChoicePending) return;
    GAME_crownChoicePending = false;
    bgmStop();
    GAME_hasCrown = false;
    GAME_crownedKept = false;
    uiOff(GAME_crownChoiceOverlay);
    uiOn(GAME_transitionOverlay);
    uiOn(GAME_transitionMessage);
    GAME_transitionLabel.textContent = '';
    GAME_transitionSub.textContent = COPY.endingSub;
    GAME_transitionCycle.textContent = COPY.endingCycle;
    gameRefreshDeathCounter();
    sfx(392, 0.4, 0.2, 0, 0.4);
    sfx(262, 0.5, 0.3, 0, 0.5, 130, 0, 250);
    GAME_endingShown = true;
}

/** 保留：不丢王冠 → 坏循环继续（轮回计数+1） */
function gameCrownKeep() {
    if (!GAME_crownChoicePending) return;
    GAME_crownChoicePending = false;
    GAME_crownedKept = true;
    GAME_crownedCycles++;
    uiOff(GAME_crownChoiceOverlay);
    GAME_paused = false;
    GAME_currentLevelIndex = 0;
    GAME_isNewCycle = true;
    sfx(440, 0.25, 0.25, 3, 0.4);
    gameLoadLevel(GAME_currentLevelIndex);
}

/** 真结局后按 R 重开游戏 */
function gameRestartAfterEnding() {
    GAME_endingShown = false;
    GAME_hasCrown = false;
    GAME_crownedKept = false;
    GAME_crownedCycles = 0;
    GAME_isNewCycle = false;
    GAME_paused = false;
    uiOff(GAME_transitionOverlay);
    uiOff(GAME_transitionMessage);
    GAME_currentLevelIndex = 0;
    gameLoadLevel(GAME_currentLevelIndex);
}

/** 首次开场介绍：按空格关闭并标记已看过 */
function gameIntroDismiss() {
    GAME_introPending = false;
    GAME_paused = false;
    gameCookieSet('mfxww_game_intro', '1');
    uiOff(GAME_introOverlay);
    GAME_lastTime = performance.now();
}

/**
 * 玩家死亡处理
 * @param {string} reason 死亡原因
 */
function gameKillPlayer(reason) {
    if (GAME_awaitingRespawn) return; // 防止死亡后重复触发
    GAME_awaitingRespawn = true;
    bgmStop();
    GAME_blackHoleSuck = null; // 吸入动画已结束，清理状态

    // 按死亡原因播放不同音效
    switch (reason) {
        case 'FALLEN':
            sfx(220, 0.5, 0.45, 0, 0.4, 55);
            break;
        case 'SQUEEZED':
        case 'SQUASHED':
            sfx(150, 0.45, 0.12, 2, 0.3, 40);
            sfx(90, 0.3, 0.18, 1, 0, 35, 0, 60);
            break;
        case 'SUICIDE':
            sfx(350, 0.3, 0.2, 0, 0.3, 180);
            break;
        case 'SWALLOWED':
            break;
        default:
            sfx(180, 0.4, 0.3, 0, 0.3, 60);
            break;
    }

    // 死亡文案：无冠显示原句，带冠（第二轮回）复用并追加 again.
    const line = (DEATH_REASONS[reason] || 'Dead.') + (GAME_hasCrown ? ' again.' : '');
    GAME_deathMessage.textContent = line;
    uiOn(GAME_deathOverlay);

    // 拿冠后的死亡才计入永久计数
    if (GAME_hasCrown) gameIncrementDeaths();
}

/**
 * 淡入关卡过渡 — 显示关卡号 + 简短提示
 * @param {number} levelIndex 即将加载的关卡索引
 */
function gameBeginTransition(levelIndex) {
    uiOn(GAME_transitionOverlay);
    sfx(330, 0.15, 0.25, 0, 0.4);
    sfx(247, 0.12, 0.35, 3, 0.3);

    GAME_transitionCycle.textContent = '';

    if (levelIndex === GAME_CORRIDOR_INDEX) {
        GAME_transitionLabel.textContent = COPY.corridorLabel;
        GAME_transitionSub.textContent = COPY.corridorSub;
        sfx(110, 0.2, 0.5, 0, 0.4, 55);
        sfx(82, 0.15, 0.7, 3, 0.3);
    } else if (levelIndex >= GAME_HIDDEN_START_INDEX) {
        const hiddenPart = levelIndex - GAME_HIDDEN_START_INDEX + 1;
        GAME_transitionLabel.textContent = COPY.hiddenLabel(hiddenPart);
        // 带冠进入 13-1 展示褪色终局文案
        GAME_transitionSub.textContent = (GAME_hasCrown && levelIndex === GAME_HIDDEN_START_INDEX)
            ? COPY.hiddenCrownedSub
            : COPY.hiddenSub;
        sfx(130, 0.2, 0.45, 0, 0.35, 65);
        sfx(98, 0.12, 0.6, 3, 0.25);
    } else {
        GAME_transitionLabel.textContent = gameLevelDisplayName(levelIndex);
        GAME_transitionSub.textContent = '';
    }

    // 轮回提示
    if (GAME_isNewCycle) {
        if (GAME_hasCrown) {
            // 拿冠后第一次回 1-1 播放 RGB 故障（"不对劲"强信号）
            if (!GAME_crownedKept && GAME_crownedCycles === 0 && levelIndex === 0) {
                window.setTimeout(gamePlayGlitch, 400);
            }
            GAME_transitionCycle.textContent = GAME_crownedKept
                ? COPY.cycleKept(GAME_crownedCycles + 1)
                : COPY.cycleCrowned;
        } else {
            GAME_transitionCycle.textContent = COPY.cyclePlain;
        }
        GAME_isNewCycle = false;
    }

    window.setTimeout(() => {
        uiOn(GAME_transitionMessage);
    }, 200);

    uiVis(GAME_headerBar, false);
}

/**
 * 重新开始当前关卡（替代原 retry 方法）
 * 重试时跳过过渡动画（死亡后直接重生）
 */
function gameRetry() {
    GAME_awaitingRespawn = false;
    uiOff(GAME_deathOverlay);
    GAME_levelTransitioning = true;

    gameLoadLevelData(GAME_currentLevelIndex);
}

/**
 * 暂停游戏（替代原 pause 方法）
 */
function gamePause() {
    GAME_paused = true;
}

/**
 * 恢复游戏（替代原 resume 方法）
 */
function gameResume() {
    GAME_paused = false;
    GAME_lastTime = performance.now();
}

/**
 * 页面可见性变化处理（替代原 handleVisibilityChange 方法）
 */
function gameHandleVisibilityChange() {
    if (document.hidden) gamePause();
    else if (!GAME_introPending && !GAME_endingShown && !GAME_crownChoicePending) gameResume();
}

/**
 * 游戏初始化（替代原 Game 类构造函数）
 */
function gameInit() {
    uiInit();

    // 用集中文案填充静态 UI 元素
    GAME_gameTitle.textContent = COPY.gameTitle;
    GAME_deathHint.textContent = COPY.deathHint;
    GAME_crownChoiceHint.textContent = COPY.choiceHint;
    GAME_deathCounter.textContent = COPY.deathCounter(0);
    if (GAME_introTitle) GAME_introTitle.textContent = COPY.introTitle;
    if (GAME_introBody) GAME_introBody.innerHTML = COPY.introBody.split('\n').join('<br>');
    if (GAME_introHint) GAME_introHint.textContent = COPY.introHint;

    // 确保死亡覆盖层初始隐藏
    uiOff(GAME_deathOverlay);

    // 窗口事件监听
    window.addEventListener('resize', gameResizeCanvas);
    window.addEventListener('visibilitychange', gameHandleVisibilityChange);

    // 初始化画布尺寸
    gameResizeCanvas();

    // 首次启动显示开场介绍（cookie 标记，仅一次）
    if (gameCookieGet('mfxww_game_intro') !== '1') {
        GAME_introPending = true;
        GAME_paused = true;
        uiOn(GAME_introOverlay);
    }

    // 加载初始关卡（玩家帧随 img.bin 一并载入）
    gameLoadLevel(0);
}

// 页面加载完成后初始化游戏
window.addEventListener('load', () => {
    gameInit();
});