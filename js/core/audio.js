/**
 * Effets sonores procéduraux — Web Audio API, sans fichiers externes.
 */

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.settings = { sfx: true, sfxVolume: 0.35 };
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.initialized = true;
  }

  playSfx(type) {
    if (!this.ctx || !this.settings.sfx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const vol = this.settings.sfxVolume;
    const now = this.ctx.currentTime;

    const profiles = {
      harvest: [{ freq: 520, dur: 0.12, type: 'sine' }],
      sell: [{ freq: 660, dur: 0.08, type: 'sine' }, { freq: 880, dur: 0.15, type: 'sine', delay: 0.06 }],
      levelup: [{ freq: 523, dur: 0.1, type: 'sine' }, { freq: 659, dur: 0.1, type: 'sine', delay: 0.08 }, { freq: 784, dur: 0.2, type: 'sine', delay: 0.16 }],
      craft: [{ freq: 440, dur: 0.1, type: 'triangle' }, { freq: 554, dur: 0.15, type: 'triangle', delay: 0.07 }],
      prestige: [{ freq: 392, dur: 0.2, type: 'sine' }, { freq: 494, dur: 0.2, type: 'sine', delay: 0.15 }, { freq: 587, dur: 0.3, type: 'sine', delay: 0.3 }],
      click: [{ freq: 400, dur: 0.05, type: 'sine' }],
      ready: [
        { freq: 587, dur: 0.1, type: 'sine' },
        { freq: 740, dur: 0.12, type: 'sine', delay: 0.1 },
        { freq: 880, dur: 0.18, type: 'sine', delay: 0.22 },
      ],
    };

    const notes = profiles[type] || profiles.click;
    for (const note of notes) {
      this.playTone(note.freq, note.dur, note.type, vol * 0.5, now + (note.delay || 0));
    }
  }

  playTone(freq, duration, type, volume, startTime) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
}

export const audio = new AudioManager();
