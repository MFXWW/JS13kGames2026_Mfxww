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
    // 王冠抉择
    choiceHint: '[ LEFT ] let go   [ RIGHT ] keep it',
    choiceFirst: 'Wow, It\'s heavy...\nBut I can feel it sucking my colors,\nMaybe that\'s why it becomes heavier.',
    choiceAgain: 'Too heavy.\nIt eats my colors and memories.\nPut it back...',
    // 真结局
    endingSub: 'I remember now.\nWhat I forgot was that I forget.\nThe colors are my memories...',
    endingCycle: 'The rainbow has fallen.',
    // 过渡
    corridorLabel: '...',
    corridorSub: '???',
    hiddenLabel: (part) => `THE ABANDONED PLACE — ${part}/3`,
    hiddenSub: 'Something stirs in the dark…',
    hiddenCrownedSub: 'When colors fade, black and white remain.',
    displayHidden: (part) => `The Abandoned Place ${part}/3`,
    cycleCrowned: 'the crowned journey begins…',
    cycleKept: (n) => `the colors have a keeper. cycle ${n}.`,
    cyclePlain: 'Another cycle. The end…?',
    // 开场介绍
    introTitle: 'Fallen rainbow',
    introBody: 'I\'ve forgotten...\n\tNope. The truth is, my colors are lost.\nIt\'s time to find them...',
    introHint: '[ SPACE ]',
    gameTitle: 'Fallen rainbow',
};
