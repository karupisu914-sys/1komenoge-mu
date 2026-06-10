class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private bgmIntervalId: any = null;
  private bgmStep: number = 0;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopBGM();
    } else {
      this.startBGM();
    }
    return this.isMuted;
  }

  public getMutedState() {
    return this.isMuted;
  }

  public startBGM() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    if (this.bgmIntervalId) return; // already playing

    const playStep = () => {
      if (this.isMuted || !this.ctx) return;
      if (this.ctx.state === 'suspended') return;
      
      const currentTime = this.ctx.currentTime;
      const step = this.bgmStep % 8;
      
      // Cyberpunk 8-step techno bassline (around Dm / D minor vibe)
      // Notes (in Hz): D2 (73.4), F2 (87.3), G2 (98.0), D2, C3 (130.8), A2 (110.0), C3, D2
      const baseNotes = [73.42, 73.42, 87.31, 73.42, 98.00, 110.00, 130.81, 73.42];
      const freq = baseNotes[step];

      // Deep rolling bass synth
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, currentTime);
      
      // Filter for lo-fi warehouse rave feel
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, currentTime);

      gain.gain.setValueAtTime(0.12, currentTime); // boosted low end background hum (loudness upgrade)
      gain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.22);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(currentTime);
      osc.stop(currentTime + 0.25);

      // CYBER ARP LEAD LAYER - Added for richer, more complex background music
      if (step % 2 === 1) {
        const leadNotes = [146.83, 174.61, 196.00, 220.00, 293.66, 261.63, 196.00, 146.83];
        const leadFreq = leadNotes[step] * 2; // high octave
        
        const leadOsc = this.ctx.createOscillator();
        const leadGain = this.ctx.createGain();
        const leadFilter = this.ctx.createBiquadFilter();

        leadOsc.type = 'triangle';
        leadOsc.frequency.setValueAtTime(leadFreq, currentTime);

        leadFilter.type = 'bandpass';
        leadFilter.frequency.setValueAtTime(1200, currentTime);

        leadGain.gain.setValueAtTime(0.04, currentTime); // moderate lead volume
        leadGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.18);

        leadOsc.connect(leadFilter);
        leadFilter.connect(leadGain);
        leadGain.connect(this.ctx.destination);

        leadOsc.start(currentTime);
        leadOsc.stop(currentTime + 0.18);
      }

      // Cyber hi-hat / tick on odd quarters
      if (step % 2 === 0) {
        const bufferSize = this.ctx.sampleRate * 0.015;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(7000, currentTime);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.025, currentTime);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, currentTime + 0.015);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noise.start(currentTime);
        noise.stop(currentTime + 0.02);
      }

      this.bgmStep++;
    };

    this.bgmStep = 0;
    this.bgmIntervalId = setInterval(playStep, 220); // ~136 BPM
  }

  public stopBGM() {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
  }

  public playLaser() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  public playPistol() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    // Red noise or white noise filter shootout
    const bufferSize = this.ctx.sampleRate * 0.1; // 0.1 second
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.1);
  }

  public playShotgun() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.25;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.25);
  }

  public playExplosion() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * 0.5;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(50, this.ctx.currentTime + 0.4);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    // Deep sub bass boom
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(80, this.ctx.currentTime);
    subOsc.frequency.exponentialRampToValueAtTime(10, this.ctx.currentTime + 0.4);

    subGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    subGain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.45);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);

    noise.start();
    noise.stop(this.ctx.currentTime + 0.5);

    subOsc.start();
    subOsc.stop(this.ctx.currentTime + 0.45);
  }

  public playJump() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.12);
  }

  public playReload() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    // Double mechanical click
    const playClick = (timeOffset: number, pitch: number) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, this.ctx!.currentTime + timeOffset);
      osc.frequency.setValueAtTime(pitch / 2, this.ctx!.currentTime + timeOffset + 0.03);

      gain.gain.setValueAtTime(0.08, this.ctx!.currentTime + timeOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + timeOffset + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(this.ctx!.currentTime + timeOffset);
      osc.stop(this.ctx!.currentTime + timeOffset + 0.05);
    };

    playClick(0, 700);
    playClick(0.12, 1200);
    playClick(0.24, 900);
  }

  public playPlayerHit() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(60, this.ctx.currentTime + 0.2);

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }

  public playUpgrade() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * 0.08);

      gain.gain.setValueAtTime(0.12, this.ctx!.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + i * 0.08 + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(this.ctx!.currentTime + i * 0.08);
      osc.stop(this.ctx!.currentTime + i * 0.08 + 0.2);
    });
  }

  public playWeaponBuy() {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [311.13, 392.00, 466.16, 622.25]; // Eb4, G4, Bb4, Eb5
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, this.ctx!.currentTime + i * 0.07);

      gain.gain.setValueAtTime(0.1, this.ctx!.currentTime + i * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + i * 0.07 + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(this.ctx!.currentTime + i * 0.07);
      osc.stop(this.ctx!.currentTime + i * 0.07 + 0.15);
    });
  }
}

export const gameAudio = new AudioEngine();
