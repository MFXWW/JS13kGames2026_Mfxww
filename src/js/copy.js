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

/** 王冠循环逐章被同化副标题（拿冠即第二轮回，意象式线索，不点破因果；索引=章-1） */
const CROWNED_SUBTITLES_2 = [
    'gold remembers the bright morning.',
    'violet hums a song almost known.',
    'blue recalls the shape of falling.',
    'red keeps a wound that never heals.',
    'green forgives what you did not.',
    'orange glows like a held breath.',
    'cyan tide keeps its promise.',
    'pink tastes of a forgotten name.',
    'sky where the ceiling was.',
    'dust already holds your steps.',
    'grey is patient with your steps.',
    'crimson ends where it begins.',
];

/** 过渡/切换文案 */
const COPY = {
    // 死亡提示
    deathHint: '[ SPACE to try again ]',
    deathCounter: (n) => `deaths: ${n}`,
    // 王冠抉择
    choiceHint: '[ LEFT ] let go   [ RIGHT ] keep it',
    choiceFirst: 'The void opens beneath you.\nThe crown is heavy — heavier than the world it guards.\n\nLet it fall?',
    choiceAgain: (n) => `The void opens again.\nThe crown is lighter than it should be — you have worn it for ${n} cycles.\nIt was waiting for you. It always was.\n\nLet it fall?`,
    // 真结局
    endingSub: 'A unicorn loses the color and turned black.\n\nblack is not emptiness.\nblack is where you rest.\n\nyou were never trapped in the loop.\nyou were the loop.\n\nthe crown you found was the one you let fall.\nand you let it fall, because you found it.\n\nthat was always the whole point.',
    endingCycle: 'The rainbow has been fallen.',
    // 过渡
    corridorLabel: '...',
    corridorSub: '???',
    hiddenLabel: (part) => `THE ABANDONED PLACE — ${part}/3`,
    hiddenSub: 'Something stirs in the dark…',
    displayHidden: (part) => `The Abandoned Place ${part}/3`,
    cycleCrowned: 'the crowned journey begins…',
    cycleKept: (n) => `the colors have a keeper. cycle ${n}.`,
    cyclePlain: 'Another cycle. That\'s the end…?',
    // 开场介绍
    introTitle: 'Fallen rainbow',
    introBody: 'I seem to forget something...\nNo matter what, I\'ve lost my colors.\nI need to find them.',
    introHint: '[ SPACE ]',
    gameTitle: 'Fallen rainbow',
};
