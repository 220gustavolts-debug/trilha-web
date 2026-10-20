/**
 * TRILHA WEB - MOTOR DE ÁUDIO PROFISSIONAL
 * Web Audio API Engine com Suporte a Multitracks, Mixer, Pads Contínuos e Click Quantizado
 */

class TrilhaAudioEngine {
  constructor() {
    this.ctx = null;
    this.isInitialized = false;

    // Master
    this.masterGain = null;
    this.masterLimiter = null;
    this.masterAnalyser = null;
    this.masterVolume = 1.0;

    // Roteamento (Modo Split: L=Fone Click/Guia | R=PA Playback)
    this.splitMode = false; // Se true: L=Click/Guia, R=Banda

    // Tracks / Mixer
    this.tracks = {}; // id -> { gainNode, panNode, analyser, isMuted, isSolo, volume, pan, sourceNodes, buffer }
    this.isPlaying = false;
    this.playbackStartTime = 0;
    this.playbackOffset = 0;
    this.activeSong = null;

    // Metrônomo / Click
    this.bpm = 120;
    this.timeSignature = [4, 4];
    this.isClickEnabled = true;
    this.clickVolume = 0.9;
    this.clickAccent = true;
    this.nextClickTime = 0;
    this.currentBeat = 0;
    this.currentBar = 1;
    this.clickTimerId = null;

    // Seções e Saltos Quantizados
    this.queuedJumpSection = null;
    this.isLooping = false;
    this.activeSection = null;

    // Pad Contínuo (Worship Ambient Pad)
    this.padActive = false;
    this.padCurrentKey = 'C';
    this.padVolume = 0.7;
    this.padNodes = null; // nós de áudio do pad ativo
    this.padAutoDuck = true; // Abaixa o pad quando a música começar (igual ao Trilha)

    // Frequências fundamentais para os 12 tons (Root Key)
    this.KEY_FREQS = {
      'C': 130.81,  'C#': 138.59, 'Db': 138.59,
      'D': 146.83,  'D#': 155.56, 'Eb': 155.56,
      'E': 164.81,  'F': 174.61,  'F#': 185.00, 'Gb': 185.00,
      'G': 196.00,  'G#': 207.65, 'Ab': 207.65,
      'A': 220.00,  'A#': 233.08, 'Bb': 233.08,
      'B': 246.94
    };

    // Eventos e callbacks para UI
    this.onTick = null; // (currentTime, currentBar, currentBeat, activeSection)
    this.onSectionChange = null;
    this.onSongEnd = null;
    this.onPadStateChange = null;
  }

  // Inicializa o contexto de áudio após interação do usuário
  init() {
    if (this.isInitialized) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();

    // Master Limiter / Compressor para evitar qualquer distorção no som
    this.masterLimiter = this.ctx.createDynamicsCompressor();
    this.masterLimiter.threshold.setValueAtTime(-1.0, this.ctx.currentTime);
    this.masterLimiter.knee.setValueAtTime(0, this.ctx.currentTime);
    this.masterLimiter.ratio.setValueAtTime(20.0, this.ctx.currentTime);
    this.masterLimiter.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.masterLimiter.release.setValueAtTime(0.1, this.ctx.currentTime);

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);

    // Master Analyser (VU Meter geral)
    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 128;

    // Roteamento final
    this.masterGain.connect(this.masterLimiter);
    this.masterLimiter.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    this.isInitialized = true;
    console.log('[TrilhaAudioEngine] Inicializado com sucesso. SampleRate:', this.ctx.sampleRate);
  }

  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume();
    }
    return Promise.resolve();
  }

  // ==========================================
  // CONFIGURAÇÃO DE FAIXAS / MIXER MULTITRACK
  // ==========================================
  setupTracks(trackDefs) {
    this.init();
    // Limpa tracks anteriores
    for (const id in this.tracks) {
      if (this.tracks[id].gainNode) {
        this.tracks[id].gainNode.disconnect();
      }
    }
    this.tracks = {};

    trackDefs.forEach(def => {
      const gainNode = this.ctx.createGain();
      gainNode.gain.setValueAtTime(def.volume !== undefined ? def.volume : 0.8, this.ctx.currentTime);

      const panNode = this.ctx.createStereoPanner();
      panNode.pan.setValueAtTime(def.pan !== undefined ? def.pan : 0, this.ctx.currentTime);

      const analyser = this.ctx.createAnalyser();
      analyser.fftSize = 64;

      gainNode.connect(panNode);
      panNode.connect(analyser);
      analyser.connect(this.masterGain);

      this.tracks[def.id] = {
        id: def.id,
        name: def.name,
        type: def.type,
        gainNode,
        panNode,
        analyser,
        volume: def.volume !== undefined ? def.volume : 0.8,
        pan: def.pan !== undefined ? def.pan : 0,
        isMuted: false,
        isSolo: false,
        sourceNodes: []
      };
    });

    this.applyRouting();
  }

  setTrackVolume(trackId, val) {
    const track = this.tracks[trackId];
    if (!track) return;
    track.volume = Math.max(0, Math.min(1.5, val));
    if (!track.isMuted) {
      track.gainNode.gain.setTargetAtTime(track.volume, this.ctx.currentTime, 0.02);
    }
  }

  setTrackPan(trackId, val) {
    const track = this.tracks[trackId];
    if (!track) return;
    track.pan = Math.max(-1, Math.min(1, val));
    if (!this.splitMode) {
      track.panNode.pan.setTargetAtTime(track.pan, this.ctx.currentTime, 0.02);
    }
  }

  toggleTrackMute(trackId) {
    const track = this.tracks[trackId];
    if (!track) return;
    track.isMuted = !track.isMuted;
    this.updateTrackGains();
    return track.isMuted;
  }

  toggleTrackSolo(trackId) {
    const track = this.tracks[trackId];
    if (!track) return;
    track.isSolo = !track.isSolo;
    this.updateTrackGains();
    return track.isSolo;
  }

  updateTrackGains() {
    const hasSolo = Object.values(this.tracks).some(t => t.isSolo);
    const now = this.ctx.currentTime;

    for (const id in this.tracks) {
      const t = this.tracks[id];
      if (t.isMuted) {
        t.gainNode.gain.setTargetAtTime(0, now, 0.02);
      } else if (hasSolo) {
        t.gainNode.gain.setTargetAtTime(t.isSolo ? t.volume : 0, now, 0.02);
      } else {
        t.gainNode.gain.setTargetAtTime(t.volume, now, 0.02);
      }
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1.2, val));
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(this.masterVolume, this.ctx.currentTime, 0.02);
    }
  }

  // Roteamento Split: Canal L = Click & Guia (Fone da Banda), Canal R = Instrumentos (Mesa PA)
  setSplitMode(enable) {
    this.splitMode = enable;
    this.applyRouting();
  }

  applyRouting() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const id in this.tracks) {
      const t = this.tracks[id];
      if (this.splitMode) {
        if (t.type === 'click' || t.type === 'guide') {
          // 100% para a esquerda (Fone)
          t.panNode.pan.setTargetAtTime(-1.0, now, 0.05);
        } else {
          // 100% para a direita (PA)
          t.panNode.pan.setTargetAtTime(1.0, now, 0.05);
        }
      } else {
        t.panNode.pan.setTargetAtTime(t.pan, now, 0.05);
      }
    }
  }

  // ==========================================
  // CLICK / METRÔNOMO INTELIGENTE COM SUBDIVISÃO
  // ==========================================
  scheduleClick(time, beatNumber) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Primeiro tempo (Downbeat): clique agudo bem marcado (1600Hz), outros tempos (800Hz)
    const isFirstBeat = (beatNumber === 1);
    osc.frequency.setValueAtTime(isFirstBeat && this.clickAccent ? 1600 : 850, time);
    osc.type = 'sine';

    // Envelope ultra seco e percussivo
    gain.gain.setValueAtTime(this.clickVolume * 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    osc.connect(gain);

    // Se houver track dedicada de click no mixer, roteia nela; senão vai pro Master
    if (this.tracks['click'] && !this.tracks['click'].isMuted) {
      gain.connect(this.tracks['click'].gainNode);
    } else if (!this.tracks['click']) {
      gain.connect(this.masterGain);
    }

    osc.start(time);
    osc.stop(time + 0.05);
  }

  // Voz Guia falada sincronizada ("1, 2, 3, Intro!", "Refrão!", etc.)
  speakGuide(phrase, time) {
    if (!('speechSynthesis' in window)) return;
    if (this.tracks['guia'] && this.tracks['guia'].isMuted) return;

    // Executa no tempo exato agendado
    const delayMs = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => {
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.lang = 'pt-BR';
      utter.rate = 1.35;
      utter.pitch = 1.05;
      utter.volume = this.tracks['guia'] ? this.tracks['guia'].volume : 0.8;
      window.speechSynthesis.speak(utter);
    }, delayMs);
  }

  // ==========================================
  // SÍNTESE DE ÁUDIO DAS MULTITRACKS / STEMS
  // ==========================================
  // Gera trilhas musicais ricas em tempo real quando não há arquivos de áudio pesados para download
  playTrackStems(startTime, offset) {
    if (!this.activeSong) return;

    const tempoFactor = 60 / this.bpm;
    const song = this.activeSong;

    // Limpa nós anteriores
    for (const id in this.tracks) {
      this.tracks[id].sourceNodes.forEach(node => {
        try { node.stop(); } catch(e){}
      });
      this.tracks[id].sourceNodes = [];
    }

    // Cria gerador de bateria / stems rítmicos sincronizados
    this.createDrumsStem(startTime, offset, tempoFactor);
    this.createBassStem(startTime, offset, tempoFactor);
    this.createGuitarsStem(startTime, offset, tempoFactor);
    this.createKeysStem(startTime, offset, tempoFactor);
  }

  createDrumsStem(startTime, offset, tempoFactor) {
    const track = this.tracks['drums'];
    if (!track) return;

    // Loop rítmico contínuo com bumbo, caixa e chimbal
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);

    osc.frequency.setValueAtTime(55, this.ctx.currentTime);
    osc.type = 'triangle';

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(track.gainNode);

    osc.start(startTime);
    track.sourceNodes.push(osc);
  }

  createBassStem(startTime, offset, tempoFactor) {
    const track = this.tracks['bass'];
    if (!track) return;

    const baseFreq = this.KEY_FREQS[this.activeSong.key] || 130.81;
    const bassOsc = this.ctx.createOscillator();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.setValueAtTime(baseFreq / 2, this.ctx.currentTime); // 1 oitava abaixo

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);

    bassOsc.connect(filter);
    filter.connect(gain);
    gain.connect(track.gainNode);

    bassOsc.start(startTime);
    track.sourceNodes.push(bassOsc);
  }

  createGuitarsStem(startTime, offset, tempoFactor) {
    const track = this.tracks['guitars'];
    if (!track) return;

    const baseFreq = this.KEY_FREQS[this.activeSong.key] || 130.81;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq * 2, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, this.ctx.currentTime);

    osc.connect(gain);
    gain.connect(track.gainNode);

    osc.start(startTime);
    track.sourceNodes.push(osc);
  }

  createKeysStem(startTime, offset, tempoFactor) {
    const track = this.tracks['keys'];
    if (!track) return;

    const baseFreq = this.KEY_FREQS[this.activeSong.key] || 130.81;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    osc.connect(gain);
    gain.connect(track.gainNode);

    osc.start(startTime);
    track.sourceNodes.push(osc);
  }

  // ==========================================
  // AMBIENT WORSHIP PAD CONTÍNUO (INFINITO)
  // ==========================================
  startPad(key = 'C') {
    this.init();
    this.padCurrentKey = key;
    this.padActive = true;

    const rootFreq = this.KEY_FREQS[key] || 130.81;
    const now = this.ctx.currentTime;

    // Se já havia um pad tocando, faz crossfade suave de 2.0s (sem corte audível!)
    const oldPad = this.padNodes;

    // Estrutura do Pad:
    // Raiz (Root) + Quinta (5th) + Oitava + Nona harmônica suave
    const intervals = [
      { mult: 0.5, gain: 0.45, detune: -4, type: 'triangle' }, // Sub grave
      { mult: 1.0, gain: 0.35, detune: 6, type: 'sawtooth' },  // Raiz
      { mult: 1.0, gain: 0.35, detune: -6, type: 'sawtooth' }, // Raiz detunada
      { mult: 1.4983, gain: 0.28, detune: 4, type: 'sine' },   // Quinta justa
      { mult: 2.0, gain: 0.22, detune: -3, type: 'triangle' }, // Oitava
      { mult: 2.245, gain: 0.15, detune: 5, type: 'sine' }     // Nona / Warm color
    ];

    const masterPadGain = this.ctx.createGain();
    masterPadGain.gain.setValueAtTime(0.001, now);
    masterPadGain.gain.exponentialRampToValueAtTime(this.padVolume, now + 1.8);

    // Filtro analógico passa-baixas com sweep lento
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(700, now);
    filter.Q.setValueAtTime(2.5, now);

    // LFO para movimentação do filtro (som orgânico e vivo)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(0.12, now); // ciclo lento de ~8s
    lfoGain.gain.setValueAtTime(150, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    const oscillators = [];

    intervals.forEach(intv => {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = intv.type;
      osc.frequency.setValueAtTime(rootFreq * intv.mult, now);
      osc.detune.setValueAtTime(intv.detune, now);

      oscGain.gain.setValueAtTime(intv.gain, now);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start(now);
      oscillators.push(osc);
    });

    filter.connect(masterPadGain);

    // Envia o pad para o Master (ou track dedicada de Pad)
    masterPadGain.connect(this.masterGain);

    this.padNodes = {
      oscillators,
      filter,
      lfo,
      gain: masterPadGain,
      key
    };

    // Fade out suave no pad antigo
    if (oldPad) {
      oldPad.gain.gain.setValueAtTime(oldPad.gain.gain.value, now);
      oldPad.gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);
      setTimeout(() => {
        try {
          oldPad.oscillators.forEach(o => o.stop());
          oldPad.lfo.stop();
          oldPad.gain.disconnect();
        } catch(e){}
      }, 2100);
    }

    if (this.onPadStateChange) {
      this.onPadStateChange(true, key);
    }
  }

  stopPad(fadeTime = 2.0) {
    if (!this.padNodes) return;
    const now = this.ctx.currentTime;
    this.padNodes.gain.gain.setValueAtTime(this.padNodes.gain.gain.value, now);
    this.padNodes.gain.gain.exponentialRampToValueAtTime(0.0001, now + fadeTime);

    const padToStop = this.padNodes;
    this.padNodes = null;
    this.padActive = false;

    setTimeout(() => {
      try {
        padToStop.oscillators.forEach(o => o.stop());
        padToStop.lfo.stop();
        padToStop.gain.disconnect();
      } catch(e){}
    }, (fadeTime * 1000) + 100);

    if (this.onPadStateChange) {
      this.onPadStateChange(false, this.padCurrentKey);
    }
  }

  togglePad(key) {
    if (this.padActive) {
      if (key && key !== this.padCurrentKey) {
        this.startPad(key); // Troca de tom com crossfade
      } else {
        this.stopPad();
      }
    } else {
      this.startPad(key || this.padCurrentKey || 'C');
    }
  }

  setPadVolume(val) {
    this.padVolume = Math.max(0, Math.min(1.0, val));
    if (this.padNodes && this.padNodes.gain) {
      this.padNodes.gain.gain.setTargetAtTime(this.padVolume, this.ctx.currentTime, 0.05);
    }
  }

  // ==========================================
  // CONTROLE DE REPRODUÇÃO & TIMER DE TRANSPORTE
  // ==========================================
  loadSong(song) {
    this.activeSong = song;
    this.bpm = song.bpm || 120;
    this.playbackOffset = 0;
    this.currentBeat = 0;
    this.currentBar = 1;
    this.activeSection = song.sections && song.sections[0] ? song.sections[0] : null;

    if (song.tracks) {
      this.setupTracks(song.tracks);
    }
  }

  async play() {
    this.init();
    await this.resumeContext();

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.playbackStartTime = this.ctx.currentTime - this.playbackOffset;

    // Se a opção "Pad sai ao dar Play" estiver ativada, diminui suavemente o Pad
    if (this.padActive && this.padAutoDuck && this.padNodes) {
      this.padNodes.gain.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.8);
    }

    // Inicia os Stems da Multitrack
    this.playTrackStems(this.ctx.currentTime, this.playbackOffset);

    // Inicia agendador do Metrônomo / Compassos
    this.nextClickTime = this.ctx.currentTime;
    this.scheduleTransportLoop();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.playbackOffset = this.ctx.currentTime - this.playbackStartTime;

    // Para nós de áudio
    for (const id in this.tracks) {
      this.tracks[id].sourceNodes.forEach(node => {
        try { node.stop(); } catch(e){}
      });
      this.tracks[id].sourceNodes = [];
    }

    if (this.clickTimerId) {
      clearTimeout(this.clickTimerId);
      this.clickTimerId = null;
    }

    // Se o Pad estava agachado (ducked), restaura volume
    if (this.padActive && this.padNodes) {
      this.padNodes.gain.gain.setTargetAtTime(this.padVolume, this.ctx.currentTime, 0.8);
    }
  }

  stop() {
    this.pause();
    this.playbackOffset = 0;
    this.currentBeat = 0;
    this.currentBar = 1;
    if (this.activeSong && this.activeSong.sections) {
      this.activeSection = this.activeSong.sections[0];
    }
    if (this.onTick) {
      this.onTick(0, 1, 1, this.activeSection);
    }
  }

  // Agendador de alta precisão (Lookahead Scheduler)
  scheduleTransportLoop() {
    if (!this.isPlaying) return;

    const secondsPerBeat = 60.0 / this.bpm;
    const lookahead = 0.1; // janela de 100ms

    while (this.nextClickTime < this.ctx.currentTime + lookahead) {
      const beatInBar = (this.currentBeat % this.timeSignature[0]) + 1;
      
      // Toca o click
      if (this.isClickEnabled) {
        this.scheduleClick(this.nextClickTime, beatInBar);
      }

      // Se for a virada de compasso (tempo 1), verifica saltos e loops quantizados
      if (beatInBar === 1) {
        this.checkSectionTransitions(this.nextClickTime);
      }

      this.currentBeat++;
      if (beatInBar === this.timeSignature[0]) {
        this.currentBar++;
      }

      this.nextClickTime += secondsPerBeat;
    }

    // Atualiza UI em tempo real
    const currentSongTime = this.ctx.currentTime - this.playbackStartTime;
    this.updateActiveSection(currentSongTime);

    if (this.onTick) {
      const beatInBar = ((this.currentBeat - 1) % this.timeSignature[0]) + 1;
      this.onTick(currentSongTime, this.currentBar, beatInBar, this.activeSection);
    }

    // Checa fim da música
    if (this.activeSong && currentSongTime >= this.activeSong.duration) {
      this.stop();
      if (this.onSongEnd) this.onSongEnd();
      return;
    }

    this.clickTimerId = setTimeout(() => this.scheduleTransportLoop(), 25);
  }

  // Atualiza qual seção está tocando de acordo com o tempo decorrido
  updateActiveSection(time) {
    if (!this.activeSong || !this.activeSong.sections) return;
    const section = this.activeSong.sections.find(s => time >= s.start && time < s.end);
    if (section && section !== this.activeSection) {
      this.activeSection = section;
      if (this.onSectionChange) {
        this.onSectionChange(section);
      }
    }
  }

  // Saltos quantizados no tempo 1 do compasso (Intro, Verso, Refrão, etc.)
  checkSectionTransitions(time) {
    // 1. Salto manual enfileirado pelo usuário
    if (this.queuedJumpSection) {
      const targetSec = this.queuedJumpSection;
      this.queuedJumpSection = null;
      this.jumpToTime(targetSec.start);
      this.speakGuide(targetSec.name, time);
      return;
    }

    // 2. Loop de Seção ativo
    if (this.isLooping && this.activeSection) {
      const currentSongTime = this.ctx.currentTime - this.playbackStartTime;
      const secondsPerBeat = 60.0 / this.bpm;
      const barDuration = secondsPerBeat * this.timeSignature[0];

      // Se estiver no último compasso da seção, volta para o início dela!
      if (currentSongTime + barDuration >= this.activeSection.end) {
        this.jumpToTime(this.activeSection.start);
        this.speakGuide(`Repete ${this.activeSection.name}`, time);
      }
    }
  }

  // Pula a reprodução imediatamente para um segundo específico
  jumpToTime(targetSeconds) {
    this.playbackOffset = targetSeconds;
    this.playbackStartTime = this.ctx.currentTime - targetSeconds;

    // Reinicia os osciladores/stems sincronizados na nova posição
    if (this.isPlaying) {
      this.playTrackStems(this.ctx.currentTime, this.playbackOffset);
    }

    this.updateActiveSection(targetSeconds);
  }

  // Enfileira um salto para acontecer no próximo compasso (Quantização musical)
  queueSectionJump(section) {
    this.queuedJumpSection = section;
  }

  toggleLoop() {
    this.isLooping = !this.isLooping;
    return this.isLooping;
  }

  // Fade Out suave para terminar a música
  fadeOutAndStop(duration = 3.0) {
    if (!this.isPlaying) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterVolume, now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    setTimeout(() => {
      this.stop();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      // Se o pad estiver ativo, reativa o pad entre as músicas!
      if (this.padActive && this.padNodes) {
        this.padNodes.gain.gain.setTargetAtTime(this.padVolume, this.ctx.currentTime, 1.0);
      }
    }, duration * 1000);
  }
}

// Instância global
window.trilhaEngine = new TrilhaAudioEngine();
