/**
 * TRILHA WEB - INTERFACE PRINCIPAL & CONTROLADOR
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = window.trilhaEngine;
  let currentSong = LIBRARY_SONGS[0];
  let currentKey = currentSong.key;
  let currentBpm = currentSong.bpm;
  let webSocket = null;

  // Elementos do DOM
  const btnPlayMaster = document.getElementById('btnPlayMaster');
  const btnStopMaster = document.getElementById('btnStopMaster');
  const btnLoopSection = document.getElementById('btnLoopSection');
  const btnFadeOut = document.getElementById('btnFadeOut');

  const songTitleEl = document.getElementById('songTitle');
  const songArtistEl = document.getElementById('songArtist');
  const songCoverEl = document.getElementById('songCover');

  const barCounterEl = document.getElementById('barCounter');
  const clockTimerEl = document.getElementById('clockTimer');

  const currentKeyEl = document.getElementById('currentKey');
  const btnKeyMinus = document.getElementById('btnKeyMinus');
  const btnKeyPlus = document.getElementById('btnKeyPlus');

  const currentBpmEl = document.getElementById('currentBpm');
  const btnBpmMinus = document.getElementById('btnBpmMinus');
  const btnBpmPlus = document.getElementById('btnBpmPlus');

  const btnSplitMode = document.getElementById('btnSplitMode');
  const sectionsRow = document.getElementById('sectionsRow');
  const mixerStage = document.getElementById('mixerStage');

  // Pads
  const btnPadToggle = document.getElementById('btnPadToggle');
  const padStatusText = document.getElementById('padStatusText');
  const padKeyBtns = document.querySelectorAll('.pad-key-btn');
  const padAutoDuckCheck = document.getElementById('padAutoDuckCheck');

  // Modais
  const modalLibrary = document.getElementById('modalLibrary');
  const modalSubscription = document.getElementById('modalSubscription');
  const modalChords = document.getElementById('modalChords');
  const modalRemote = document.getElementById('modalRemote');

  // Botões de Topo
  const btnOpenLibrary = document.getElementById('btnOpenLibrary');
  const btnOpenSubscription = document.getElementById('btnOpenSubscription');
  const btnOpenChords = document.getElementById('btnOpenChords');
  const btnOpenRemote = document.getElementById('btnOpenRemote');
  const btnFullScreen = document.getElementById('btnFullScreen');

  // ==========================================
  // INICIALIZAÇÃO
  // ==========================================
  loadSongIntoUI(currentSong);
  connectWebSocket();

  // ==========================================
  // CARREGAR MÚSICA & RENDERIZAR INTERFACE
  // ==========================================
  function loadSongIntoUI(song) {
    currentSong = song;
    currentKey = song.key;
    currentBpm = song.bpm;

    songTitleEl.textContent = song.title;
    songArtistEl.textContent = song.artist;
    songCoverEl.textContent = song.cover || '🎵';
    currentKeyEl.textContent = currentKey;
    currentBpmEl.textContent = currentBpm;

    engine.loadSong(song);

    renderSections(song.sections);
    renderMixer(song.tracks);
    updateChordsModal();
  }

  // Renderiza a régua de partes / seções da música
  function renderSections(sections) {
    sectionsRow.innerHTML = '';
    if (!sections || !sections.length) return;

    sections.forEach((sec, idx) => {
      const btn = document.createElement('button');
      btn.className = `section-block-btn ${idx === 0 ? 'active' : ''}`;
      btn.dataset.sectionId = sec.id;

      btn.innerHTML = `
        <div class="sec-color-strip" style="background: ${sec.color || '#00f2fe'};"></div>
        <div class="sec-title">${sec.name}</div>
        <div class="sec-meta">
          <span>${sec.bars} comp</span>
          <span>${formatTime(sec.start)}</span>
        </div>
      `;

      btn.addEventListener('click', () => {
        // Se a música estiver tocando, agenda salto quantizado no próximo compasso!
        if (engine.isPlaying) {
          engine.queueSectionJump(sec);
          document.querySelectorAll('.section-block-btn').forEach(b => b.classList.remove('queued'));
          btn.classList.add('queued');
        } else {
          // Se estiver parada, pula imediatamente
          engine.jumpToTime(sec.start);
          highlightActiveSection(sec);
        }
      });

      sectionsRow.appendChild(btn);
    });
  }

  function highlightActiveSection(section) {
    if (!section) return;
    document.querySelectorAll('.section-block-btn').forEach(btn => {
      btn.classList.remove('active', 'queued');
      if (btn.dataset.sectionId === section.id) {
        btn.classList.add('active');
        btn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
  }

  // Renderiza os canais do Mixer com Faders Verticais e VU Meters
  function renderMixer(tracks) {
    mixerStage.innerHTML = '';
    if (!tracks) return;

    // Canais Individuais
    tracks.forEach(track => {
      const chan = document.createElement('div');
      chan.className = 'mixer-channel';
      chan.id = `chan-${track.id}`;

      chan.innerHTML = `
        <div class="chan-header">
          <div class="chan-name" title="${track.name}">${track.name}</div>
          <div class="chan-type-tag">${track.type}</div>
        </div>

        <div class="chan-pan-wrap">
          <span class="pan-label">PAN</span>
          <input type="range" class="pan-slider" min="-1" max="1" step="0.1" value="${track.pan !== undefined ? track.pan : 0}">
        </div>

        <div class="chan-btns">
          <button class="btn-mute ${track.mute ? 'active' : ''}">M</button>
          <button class="btn-solo ${track.solo ? 'active' : ''}">S</button>
        </div>

        <div class="fader-vu-assembly">
          <div class="vu-meter-bar">
            <div class="vu-fill" id="vu-${track.id}"></div>
          </div>
          <div class="fader-wrap">
            <input type="range" class="fader-vertical" min="0" max="1.5" step="0.02" value="${track.volume !== undefined ? track.volume : 0.8}">
          </div>
        </div>

        <div class="chan-db-readout" id="db-${track.id}">0.0 dB</div>
      `;

      // Eventos Fader Volume
      const fader = chan.querySelector('.fader-vertical');
      const dbReadout = chan.querySelector(`#db-${track.id}`);
      fader.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        engine.setTrackVolume(track.id, val);
        const db = val === 0 ? '-inf' : (20 * Math.log10(val)).toFixed(1);
        dbReadout.textContent = `${db} dB`;
      });

      // Eventos Pan
      const panSlider = chan.querySelector('.pan-slider');
      panSlider.addEventListener('input', (e) => {
        engine.setTrackPan(track.id, parseFloat(e.target.value));
      });

      // Eventos Mute & Solo
      const muteBtn = chan.querySelector('.btn-mute');
      muteBtn.addEventListener('click', () => {
        const isMuted = engine.toggleTrackMute(track.id);
        muteBtn.classList.toggle('active', isMuted);
      });

      const soloBtn = chan.querySelector('.btn-solo');
      soloBtn.addEventListener('click', () => {
        const isSolo = engine.toggleTrackSolo(track.id);
        soloBtn.classList.toggle('active', isSolo);
      });

      mixerStage.appendChild(chan);
    });

    // Canal Master
    const masterChan = document.createElement('div');
    masterChan.className = 'mixer-channel master-channel';
    masterChan.innerHTML = `
      <div class="chan-header">
        <div class="chan-name">MASTER</div>
        <div class="chan-type-tag">Saída Geral</div>
      </div>
      <div class="chan-pan-wrap" style="visibility: hidden;">
        <span class="pan-label">PAN</span>
        <input type="range" class="pan-slider" disabled>
      </div>
      <div class="chan-btns" style="visibility: hidden;">
        <button class="btn-mute">M</button>
        <button class="btn-solo">S</button>
      </div>
      <div class="fader-vu-assembly">
        <div class="vu-meter-bar">
          <div class="vu-fill" id="vu-master"></div>
        </div>
        <div class="fader-wrap">
          <input type="range" class="fader-vertical" min="0" max="1.2" step="0.02" value="1.0" id="masterFader">
        </div>
      </div>
      <div class="chan-db-readout" id="db-master">0.0 dB</div>
    `;

    const masterFader = masterChan.querySelector('#masterFader');
    const masterDb = masterChan.querySelector('#db-master');
    masterFader.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      engine.setMasterVolume(val);
      const db = val === 0 ? '-inf' : (20 * Math.log10(val)).toFixed(1);
      masterDb.textContent = `${db} dB`;
    });

    mixerStage.appendChild(masterChan);

    // Inicia animação fluida dos VU Meters em tempo real
    startVuMeterAnimation();
  }

  // ==========================================
  // VU METERS EM TEMPO REAL (CANVAS / LEDS)
  // ==========================================
  function startVuMeterAnimation() {
    function updateMeters() {
      if (engine.isInitialized) {
        // Atualiza VU de cada canal
        for (const id in engine.tracks) {
          const track = engine.tracks[id];
          const vuEl = document.getElementById(`vu-${id}`);
          if (vuEl && track.analyser) {
            let level = 0;
            if (engine.isPlaying && !track.isMuted) {
              const dataArray = new Uint8Array(track.analyser.frequencyBinCount);
              track.analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
              level = Math.min(100, (sum / dataArray.length) * 1.4);
            }
            vuEl.style.height = `${level}%`;
          }
        }

        // VU Master
        const masterVuEl = document.getElementById('vu-master');
        if (masterVuEl && engine.masterAnalyser) {
          let level = 0;
          if (engine.isPlaying || engine.padActive) {
            const dataArray = new Uint8Array(engine.masterAnalyser.frequencyBinCount);
            engine.masterAnalyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
            level = Math.min(100, (sum / dataArray.length) * 1.5);
          }
          masterVuEl.style.height = `${level}%`;
        }
      }

      requestAnimationFrame(updateMeters);
    }
    requestAnimationFrame(updateMeters);
  }

  // ==========================================
  // EVENTOS DE TRANSPORTE
  // ==========================================
  btnPlayMaster.addEventListener('click', () => {
    if (engine.isPlaying) {
      engine.pause();
      btnPlayMaster.innerHTML = '▶';
      btnPlayMaster.classList.remove('playing');
    } else {
      engine.play();
      btnPlayMaster.innerHTML = '⏸';
      btnPlayMaster.classList.add('playing');
    }
  });

  btnStopMaster.addEventListener('click', () => {
    engine.stop();
    btnPlayMaster.innerHTML = '▶';
    btnPlayMaster.classList.remove('playing');
    barCounterEl.textContent = '001 : 1';
    clockTimerEl.textContent = '00:00 / ' + formatTime(currentSong.duration);
  });

  btnLoopSection.addEventListener('click', () => {
    const isLooping = engine.toggleLoop();
    btnLoopSection.classList.toggle('active', isLooping);
  });

  btnFadeOut.addEventListener('click', () => {
    engine.fadeOutAndStop(3.5);
  });

  // Split Mode (Fone L / PA R)
  btnSplitMode.addEventListener('click', () => {
    const isSplit = !btnSplitMode.classList.contains('active');
    btnSplitMode.classList.toggle('active', isSplit);
    engine.setSplitMode(isSplit);
  });

  // Callbacks de áudio para UI
  engine.onTick = (currentTime, bar, beat, activeSection) => {
    barCounterEl.textContent = `${String(bar).padStart(3, '0')} : ${beat}`;
    clockTimerEl.textContent = `${formatTime(currentTime)} / ${formatTime(currentSong.duration)}`;
    highlightActiveSection(activeSection);
  };

  engine.onSongEnd = () => {
    btnPlayMaster.innerHTML = '▶';
    btnPlayMaster.classList.remove('playing');
  };

  // ==========================================
  // CONTROLE DE PADS CONTÍNUOS WORSHIP
  // ==========================================
  btnPadToggle.addEventListener('click', () => {
    engine.togglePad(currentKey);
  });

  padKeyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      padKeyBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentKey = key;
      currentKeyEl.textContent = key;
      engine.startPad(key);
    });
  });

  padAutoDuckCheck.addEventListener('change', (e) => {
    engine.padAutoDuck = e.target.checked;
  });

  engine.onPadStateChange = (isActive, key) => {
    btnPadToggle.classList.toggle('active', isActive);
    if (isActive) {
      padStatusText.querySelector('strong').textContent = `PAD ATIVO (${key})`;
      padStatusText.querySelector('small').textContent = 'Som contínuo infinito';
      padKeyBtns.forEach(b => {
        b.classList.toggle('active', b.dataset.key === key);
      });
    } else {
      padStatusText.querySelector('strong').textContent = 'LIGAR PAD CONTÍNUO';
      padStatusText.querySelector('small').textContent = 'Worship Pad Ambiente';
      padKeyBtns.forEach(b => b.classList.remove('active'));
    }
  };

  // ==========================================
  // TRANSPOSIÇÃO DE TOM & VELOCIDADE (BPM)
  // ==========================================
  const ALL_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  btnKeyMinus.addEventListener('click', () => {
    let idx = ALL_KEYS.indexOf(currentKey);
    idx = (idx - 1 + ALL_KEYS.length) % ALL_KEYS.length;
    currentKey = ALL_KEYS[idx];
    currentKeyEl.textContent = currentKey;
    if (engine.padActive) engine.startPad(currentKey);
    updateChordsModal();
  });

  btnKeyPlus.addEventListener('click', () => {
    let idx = ALL_KEYS.indexOf(currentKey);
    idx = (idx + 1) % ALL_KEYS.length;
    currentKey = ALL_KEYS[idx];
    currentKeyEl.textContent = currentKey;
    if (engine.padActive) engine.startPad(currentKey);
    updateChordsModal();
  });

  btnBpmMinus.addEventListener('click', () => {
    currentBpm = Math.max(40, currentBpm - 2);
    currentBpmEl.textContent = currentBpm;
    engine.bpm = currentBpm;
  });

  btnBpmPlus.addEventListener('click', () => {
    currentBpm = Math.min(220, currentBpm + 2);
    currentBpmEl.textContent = currentBpm;
    engine.bpm = currentBpm;
  });

  // ==========================================
  // MODAL DA BIBLIOTECA DE VS NA NUVEM
  // ==========================================
  const librarySongsList = document.getElementById('librarySongsList');
  const searchInput = document.getElementById('searchLibraryInput');

  function renderLibraryModal(songs) {
    librarySongsList.innerHTML = '';
    songs.forEach(song => {
      const row = document.createElement('div');
      row.className = 'song-item-row';
      row.innerHTML = `
        <div class="song-item-left">
          <div class="song-icon">${song.cover || '🎵'}</div>
          <div>
            <div class="song-name">${song.title}</div>
            <div style="font-size: 0.8rem; color: #94a3b8;">${song.artist}</div>
            <div class="song-meta-tags">
              <span class="meta-pill">Tom: ${song.key}</span>
              <span class="meta-pill">${song.bpm} BPM</span>
              <span class="meta-pill">${song.timeSignature}</span>
              <span class="meta-pill">${formatTime(song.duration)}</span>
            </div>
          </div>
        </div>
        <button class="btn-load-song">Carregar</button>
      `;

      row.querySelector('.btn-load-song').addEventListener('click', () => {
        loadSongIntoUI(song);
        closeAllModals();
      });

      librarySongsList.appendChild(row);
    });
  }

  renderLibraryModal(LIBRARY_SONGS);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = LIBRARY_SONGS.filter(s => 
        s.title.toLowerCase().includes(query) || 
        s.artist.toLowerCase().includes(query) ||
        s.key.toLowerCase().includes(query)
      );
      renderLibraryModal(filtered);
    });
  }

  // ==========================================
  // CIFRA & LETRA SINCRONIZADA
  // ==========================================
  function updateChordsModal() {
    const chordBox = document.getElementById('chordBox');
    if (!chordBox) return;

    if (currentSong && currentSong.chords) {
      let content = `=== ${currentSong.title.toUpperCase()} (${currentSong.artist}) ===\n`;
      content += `Tom: ${currentKey} | BPM: ${currentBpm}\n\n`;

      for (const [secKey, txt] of Object.entries(currentSong.chords)) {
        content += `[${secKey.toUpperCase()}]\n${txt}\n\n`;
      }
      chordBox.textContent = content;
    } else {
      chordBox.textContent = 'Sem cifra cadastrada para esta música.';
    }
  }

  // ==========================================
  // GERENCIAMENTO DE MODAIS
  // ==========================================
  function openModal(modal) {
    closeAllModals();
    if (modal) modal.classList.add('open');
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', closeAllModals);
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeAllModals();
    }
  });

  btnOpenLibrary.addEventListener('click', () => openModal(modalLibrary));
  btnOpenSubscription.addEventListener('click', () => openModal(modalSubscription));
  btnOpenChords.addEventListener('click', () => openModal(modalChords));
  btnOpenRemote.addEventListener('click', () => openModal(modalRemote));

  // Tela Cheia / Modo Palco
  btnFullScreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });

  // ==========================================
  // ATALHOS DE TECLADO PARA O MÚSICO NO PALCO
  // ==========================================
  window.addEventListener('keydown', (e) => {
    // Ignora se estiver digitando em campos de input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space') {
      e.preventDefault();
      btnPlayMaster.click();
    } else if (e.key === 'p' || e.key === 'P') {
      btnPadToggle.click();
    } else if (e.key === 'l' || e.key === 'L') {
      btnLoopSection.click();
    } else if (e.key === 'f' || e.key === 'F') {
      btnFadeOut.click();
    } else if (e.key >= '1' && e.key <= '9') {
      const idx = parseInt(e.key) - 1;
      const secBtns = document.querySelectorAll('.section-block-btn');
      if (secBtns[idx]) secBtns[idx].click();
    }
  });

  // ==========================================
  // SINCRONIZAÇÃO WEBSOCKET COM CONTROLE REMOTO
  // ==========================================
  function connectWebSocket() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      webSocket = new WebSocket(wsUrl);

      webSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'COMMAND') {
            if (data.action === 'play') engine.play();
            if (data.action === 'pause') engine.pause();
            if (data.action === 'stop') engine.stop();
            if (data.action === 'jump_section' && data.sectionId) {
              const sec = currentSong.sections.find(s => s.id === data.sectionId);
              if (sec) engine.queueSectionJump(sec);
            }
          }
        } catch(e){}
      };
    } catch(e) {
      // Modo offline estático
    }
  }

  // Utilitário formata segundos em MM:SS
  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
});
