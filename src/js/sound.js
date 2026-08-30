// Public audio context
let audioContext = null;
let GAME_muted = false; // 静音开关（左上 ♪ 按钮切换）

/**
 * Play a sound with custom parameters using Web Audio API
 * @param {number} frequency - Frequency of the sound in Hz
 * @param {number} amplitude - Amplitude (volume) of the sound, range 0-1
 * @param {number} duration - Duration of the sound in seconds
 * @param {number} pan - Pan value for stereo panning, range -1 (left) to 1 (right)
 * @param {string} waveType - Waveform type: sine / square / sawtooth / triangle
 * @param {object} [opts] - Optional advanced options
 * @param {number} [opts.endFreq] - End frequency for sweep (linear)
 * @param {number} [opts.attack]  - Attack time in seconds (default 0.005)
 * @param {number} [opts.decay]   - Decay-to-sustain time in seconds (default 0.01)
 * @param {number} [opts.sustain] - Sustain level 0-1, relative to amplitude (default 0.6)
 * @param {number} [opts.release] - Release fade time at the end (default 0.05)
 * @param {number} [opts.detune]  - Detune in cents for slight chorus (default 0)
 */
async function playSound(frequency, amplitude, duration, pan, waveType, opts) {
    if (GAME_muted) return;
    if (!audioContext) {
      const AudioContextConstructor = window.AudioContext;
      audioContext = new AudioContextConstructor();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const o = Object.assign({ attack: 0.005, decay: 0.01, sustain: 0.6, release: 0.05, detune: 0 }, opts);

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const pannerNode = audioContext.createStereoPanner();

    oscillator.type = waveType;
    oscillator.frequency.value = frequency;
    if (o.endFreq !== undefined) {
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(o.endFreq, audioContext.currentTime + duration);
    }
    if (o.detune) oscillator.detune.value = o.detune;

    pannerNode.pan.value = pan;

    oscillator.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(audioContext.destination);

    const t = audioContext.currentTime;
    const releaseStart = Math.max(t + duration - o.release, t + o.attack + o.decay + 0.001);

    // ADSR-like envelope
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(amplitude, t + o.attack);
    gainNode.gain.linearRampToValueAtTime(amplitude * o.sustain, t + o.attack + o.decay);
    gainNode.gain.setValueAtTime(amplitude * o.sustain, releaseStart);
    gainNode.gain.linearRampToValueAtTime(0, t + duration);

    oscillator.start(t);
    oscillator.stop(t + duration);
    return gainNode;
}

/**
 * 紧凑音效：w=0sine/1square/2sawtooth/3triangle，s=sustain、e=endFreq（0 或省略为无），p=pan、d=延时(ms)
 */
function sfx(f, a, u, w, s, e, p, d) {
    const o = {};
    if (s) o.sustain = s;
    if (e) o.endFreq = e;
    const go = () => playSound(f, a, u, p || 0, ['sine', 'square', 'sawtooth', 'triangle'][w], o);
    d ? setTimeout(go, d) : go();
}

// ============ 零散音符环境乐（零外部文件，单一定时器随机间隔） ============
let bgmT = null, bgmG = null, bgmI = 0, bgmN = [], bgmR = 220, bgmW = 0, bgmS = 1600, bgmD = 0;

/** 启动背景乐。seq: 数字=半音度数(0=根音)，'.'忽略；root=基频Hz；gap=间隔基准ms；wave 0-3；d=随机失谐(cent, 0=无)。音符随机间隔(1.5~5.5×gap)逐个轻声播放，一轮播完停顿(4~10×gap)后乱序重播 */
function bgmPlay(s, r, t, w, d) {
    bgmStop();
    bgmN = s.split('.').map(Number);
    bgmR = r; bgmW = w; bgmS = t; bgmD = d; bgmI = 0;
    bgmShuffle();
    bgmTick();
}
function bgmShuffle() {
    for (let i = bgmN.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [bgmN[i], bgmN[j]] = [bgmN[j], bgmN[i]];
    }
}
function bgmTick() {
    if (bgmI >= bgmN.length) {
        bgmI = 0;
        bgmShuffle();
        bgmT = setTimeout(bgmTick, bgmS * (4 + Math.random() * 6)); // 一轮后长停顿
        return;
    }
    const f = bgmR * Math.pow(2, bgmN[bgmI++] / 12);
    playSound(f, 0.05, 2.8, 0, ['sine', 'square', 'sawtooth', 'triangle'][bgmW], { attack: 0.25, release: 1.4, detune: bgmD && (Math.random() * 2 - 1) * bgmD }).then(g => bgmG = g); // 缓入缓出，加长音符；带冠随机失谐；记录增益供死亡淡出
    bgmT = setTimeout(bgmTick, bgmS * (1.5 + Math.random() * 4));
}
function bgmStop(f) {
    if (bgmT) { clearTimeout(bgmT); bgmT = null; }
    if (f && bgmG) { const t = audioContext.currentTime; bgmG.gain.cancelScheduledValues(t); bgmG.gain.linearRampToValueAtTime(0, t + f); }
}