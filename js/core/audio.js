/**
 * Audio zen procédural — Web Audio API, sans fichiers externes.
 * Compatible GitHub Pages.
 */

const NOTES = {
  C4: 261.63, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25,
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicNodes = [];
    this.musicInterval = null;
    this.initialized = false;
    this.settings = { music: true, sfx: true, musicVolume: 0.18, sfxVolume: 0.35 };
  }

  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    if (this.initialized) {
      if (this.settings.music) this.startMusic();
      else this.stopMusic();
    }
  }

  init() {
    if (this.initialized) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.initialized = true;
    if (this.settings.music) this.startMusic();
  }

  startMusic() {
    if (!this.ctx || !this.settings.music) return;
    this.stopMusic();

    const freqs = [NOTES.C4, NOTES.E4, NOTES.G4];
    const master = this.ctx.createGain();
    master.gain.value = this.settings.musicVolume * 0.4;
    master.connect(this.ctx.destination);

    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      this.musicNodes.push({ osc, gain });
    }

    let t = 0;
    this.musicInterval = setInterval(() => {
      if (!this.ctx) return;
      t += 0.02;
      this.musicNodes.forEach(({ gain }, i) => {
        const wave = Math.sin(t * (0.3 + i * 0.1)) * 0.5 + 0.5;
        gain.gain.linearRampToValueAtTime(
          wave * 0.12 * this.settings.musicVolume,
          this.ctx.currentTime + 0.1
        );
      });
    }, 200);
  }

  stopMusic() {
    clearInterval(this.musicInterval);
    this.musicInterval = null;
    for (const { osc } of this.musicNodes) {
      try { osc.stop(); } catch { /* already stopped */ }
    }
    this.musicNodes = [];
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
