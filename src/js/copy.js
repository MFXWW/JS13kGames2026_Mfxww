// ===================== 游戏文案集中管理（copy.js） =====================
// 所有用户可见文本统一放这里，便于修改与压缩

/** 死亡原因文本映射 */
const DEATH_REASONS = {
    'FALLEN': 'Hit the bottom.',
    'SQUEEZED': 'Squeezed.',
    'SQUASHED': 'Squashed.',
    'SUICIDE': 'Gave up.',
    'SWALLOWED': 'Swallowed.',
};

/** 过渡/切换文案 */
const COPY = {
    // 死亡提示
    deathHint: '[ SPACE to try again ]',
    deathCounter: (n) => `deaths: ${n}`,
    // 王冠抉择（文案统一，不再按轮回区分）
    choiceHint: '[ LEFT ] let go   [ RIGHT ] keep it',
    choice: 'Ah, it is this dazzling crown that brings it all to pass.\nPerhaps it feeds upon what it devours, and so grows ever more magnificent.',
    // 真结局
    endingSub: 'I remember now.\nWhat I forgot was that I forget.\nThe colors are my memories...',
    endingCycle: 'When all colors sink like a dying sunset, only black and white shall endure. And they are where my true belonging lies.',
    // 过渡
    corridorLabel: '...',
    corridorSub: '???',
    // 带冠轮回回到 1-1：得冠的欣喜 → 察觉记忆正在消散
    crownRecall: 'Joy fills my breast. At last I have found it. The crown glows with resplendent radiance — surely this is my long-lost treasure.\n…Yet why do my memories dissolve away?',
    // 带冠重访 13-1（Abandoned Place）
    hiddenReturn: 'Once more I return. For my vanished hues, for my dwindling memories, I stand here again.\nThe more times I die, the more nutrients the crown gains.',
    hiddenLabel: (part) => `THE ABANDONED PLACE — ${part}/3`,
    hiddenSub: 'Something stirs in the dark…',
    displayHidden: (part) => `The Abandoned Place ${part}/3`,
    cycleCrowned: 'the crowned journey begins…',
    cycleKept: (n) => `the colors have a keeper. cycle ${n}.`,
    cyclePlain: 'Another cycle. The end…?',
    // 开场介绍
    introBody: 'I wake.\nMy colors are gone — and my memories with them.\nGo forth, and seek my hues. This is my destiny.',
    introHint: '[ SPACE ]',
    gameTitle: 'Fallen rainbow',
};
