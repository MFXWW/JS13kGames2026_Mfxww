// ===================== 游戏文案集中管理（copy.js） =====================
// 所有用户可见文本统一放这里，便于修改与压缩

/** 死亡原因文本映射 */
const DEATH_REASONS = {
    'FALLEN': 'Found the bottom.',
    'SQUEEZED': 'Squeezed to death.',
    'SQUASHED': 'Squashed flat.',
    'SUICIDE': 'Gave up.',
    'SWALLOWED': 'Swallowed by the void.',
};

/** 过渡/切换文案 */
const COPY = {
    // 死亡提示
    deathHint: '[ SPACE to try again ]',
    deathCounter: (n) => `deaths: ${n}`,
    // 王冠抉择
    choiceHint: '[ LEFT ] let go   [ RIGHT ] keep it',
    choiceFirst: 'It\'s heavy.\n。。。\nMy colors are fading. My memories are fading.\nPlace it back... Place it back...',
    choiceAgain: (n) => `Too heavy.\nIt eats my colors. It eats my memories.\nPlace it back... Place it back...`,
    // 真结局
    endingSub: 'I remember now.\nWhat I forgot was that I forget.\nThe colors are my memories...',
    endingCycle: 'The rainbow has been fallen.',
    // 过渡
    corridorLabel: '...',
    corridorSub: '???',
    hiddenLabel: (part) => `THE ABANDONED PLACE — ${part}/3`,
    hiddenSub: 'Something stirs in the dark…',
    hiddenCrownedSub: 'When all the colors fade away, then black and white stay forever.',
    displayHidden: (part) => `The Abandoned Place ${part}/3`,
    cycleCrowned: 'the crowned journey begins…',
    cycleKept: (n) => `the colors have a keeper. cycle ${n}.`,
    cyclePlain: 'Another cycle. That\'s the end…?',
    // 开场介绍
    introTitle: 'Fallen rainbow',
    introBody: 'I\'ve forgotten...\n\tNope. The truth is, my colors are lost.\nIt\'s time to find them...',
    introHint: '[ SPACE ]',
    gameTitle: 'Fallen rainbow',
};
