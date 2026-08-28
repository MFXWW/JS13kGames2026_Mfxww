// Public audio context
let audioContext = null;

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

// ============ 极简循环 BGM（零外部文件，setInterval 音序器） ============
let bgmT = null, bgmI = 0, bgmN = [], bgmR = 220, bgmW = 0, bgmS = 160;

/** 启动循环背景音乐。seq: 数字=半音度数(0=根音)，'.'=休止；root=基频Hz；step=每步ms；wave 0-3 */
function bgmPlay(s, r, t, w) {
    bgmStop();
    bgmN = [...s].map(c => c === '.' ? 0 : +c);
    bgmR = r; bgmW = w; bgmS = t; bgmI = 0;
    bgmTick();
    bgmT = setInterval(bgmTick, t);
}
function bgmTick() {
    const d = bgmN[bgmI++ % bgmN.length];
    if (d) sfx(bgmR * Math.pow(2, d / 12), 0.07, bgmS * 8.5e-4, bgmW);
}
function bgmStop() { if (bgmT) { clearInterval(bgmT); bgmT = null; } }