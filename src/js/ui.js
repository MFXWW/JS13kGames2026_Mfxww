// ===================== UI 层：DOM 获取与 class 切换集中于此 =====================
// 所有 id/class 名称字符串都在这一个文件里（构建时 dom_rename.js 统一改短），
// game_core.js 只通过下面的全局引用和 ui 助手访问 DOM。
let GAME_canvas = null, GAME_ctx = null, GAME_worldCanvas = null, GAME_worldContext = null;
let GAME_headerBar = null, GAME_levelDisplay = null, GAME_gameTitle = null;
let GAME_deathOverlay = null, GAME_deathMessage = null, GAME_deathHint = null;
let GAME_transitionOverlay = null, GAME_transitionMessage = null;
let GAME_transitionLabel = null, GAME_transitionSub = null, GAME_transitionCycle = null;
let GAME_deathCounter = null, GAME_crownChoiceOverlay = null, GAME_crownChoiceMessage = null, GAME_crownChoiceHint = null;
let GAME_introOverlay = null, GAME_introMessage = null, GAME_introTitle = null, GAME_introBody = null, GAME_introHint = null;
let GAME_glitchOverlay = null;
let GAME_muteMark = null;

/** 一次性获取所有 UI 元素引用（gameInit 调用） */
function uiInit() {
    GAME_canvas = document.getElementById('gameCanvas');
    GAME_ctx = GAME_canvas.getContext('2d');
    GAME_worldCanvas = document.createElement('canvas');
    GAME_worldContext = GAME_worldCanvas.getContext('2d');
    GAME_headerBar = document.getElementById('headerBar');
    GAME_levelDisplay = document.getElementById('levelDisplay');
    GAME_gameTitle = document.getElementById('gameTitle');
    GAME_deathOverlay = document.getElementById('deathOverlay');
    GAME_deathMessage = document.getElementById('deathMessage');
    GAME_deathHint = document.getElementById('deathHint');
    GAME_transitionOverlay = document.getElementById('transitionOverlay');
    GAME_transitionMessage = document.getElementById('transitionMessage');
    GAME_transitionLabel = document.querySelector('#transitionMessage .level-label');
    GAME_transitionSub = document.querySelector('#transitionMessage .level-sub');
    GAME_transitionCycle = document.querySelector('#transitionMessage .cycle-notice');
    GAME_deathCounter = document.getElementById('deathCounter');
    GAME_crownChoiceOverlay = document.getElementById('crownChoiceOverlay');
    GAME_crownChoiceMessage = document.getElementById('crownChoiceMessage');
    GAME_crownChoiceHint = document.getElementById('crownChoiceHint');
    GAME_introOverlay = document.getElementById('introOverlay');
    GAME_introMessage = document.querySelector('#introMessage');
    GAME_introTitle = document.querySelector('#introMessage .intro-title');
    GAME_introBody = document.querySelector('#introMessage .intro-body');
    GAME_introHint = document.querySelector('#introMessage .intro-hint');
    GAME_glitchOverlay = document.getElementById('glitchOverlay');
    GAME_muteMark = document.getElementById('muteMark');

    // 触屏虚拟按键（仅 pointer:coarse 设备显示）；兼处理 UI 状态，与键盘逻辑一致
    const tc = document.getElementById('touchControls');
    ['left', 'right', 'jump'].forEach((a, i) => {
        const el = tc.children[i];
        const go = (on) => {
            if (!on) return actions[a] = false;
            if (GAME_introPending) return gameIntroDismiss();
            if (GAME_awaitingRespawn) return gameRetry();
            if (GAME_crownChoicePending) return a[0] == 'l' ? gameCrownReturn() : a[0] == 'r' && gameCrownKeep();
            actions[a] = true;
        };
        el.addEventListener('pointerdown', (e) => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} go(true); });
        el.addEventListener('pointerup', () => go(false));
    });
    // 静音按钮（取代 M 键）
    GAME_muteMark.addEventListener('click', gameToggleMute);
}

/** 切换元素 active class：on=true 显示/加，false 隐藏/去 */
function uiOn(el) { el.classList.add('active'); }
function uiOff(el) { el.classList.remove('active'); }
/** 切换元素 visible class（右上角死亡计数/顶栏显隐） */
function uiVis(el, on) { el.classList[on ? 'add' : 'remove']('visible'); }
