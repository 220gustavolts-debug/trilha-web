const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Estado da sessão (para sincronizar com o controle remoto via celular)
let sessionState = {
  isPlaying: false,
  currentTime: 0,
  currentSong: null,
  activeSection: null,
  bpm: 120,
  key: 'C',
  isLooping: false,
  padActive: false,
  padKey: 'C',
  tracks: {}
};

// Conexões WebSocket ativas (computador principal + celulares na rede)
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  // Envia estado atual para o novo dispositivo conectado
  ws.send(JSON.stringify({ type: 'SYNC_STATE', payload: sessionState }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Se for atualização de estado, propaga para todos os outros clientes
      if (data.type === 'UPDATE_STATE') {
        sessionState = { ...sessionState, ...data.payload };
        broadcast({ type: 'STATE_CHANGED', payload: sessionState }, ws);
      } else if (data.type === 'COMMAND') {
        // Ex: play, pause, jump_section, loop_toggle, pad_toggle
        broadcast(data, ws);
      }
    } catch (err) {
      console.error('Erro ao processar mensagem WS:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

function broadcast(data, sender) {
  const msg = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === 1) { // OPEN
      client.send(msg);
    }
  }
}

// API de Músicas da Biblioteca na Nuvem
app.get('/api/library', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'js', 'library-data.json'));
});

// API de Status da Assinatura (Simulação SaaS R$ 29,90)
app.get('/api/subscription/status', (req, res) => {
  res.json({
    active: true,
    plan: 'Trilha Web PRO',
    price: 'R$ 29,90/mês',
    features: [
      'Player Multitrack Web Ilimitado',
      'Biblioteca Completa de VSs na Nuvem',
      'Pads Worship Contínuos em todos os 12 tons',
      'Controle Remoto via Celular/Tablet sem fio',
      'Exportação e Importação de Multitracks'
    ],
    expiresAt: '2027-10-20'
  });
});

// Fallback para SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 TRILHA WEB - Servidor rodando na porta ${PORT}`);
  console.log(`🌐 Acesse no computador: http://localhost:${PORT}`);
  console.log(`📱 Controle pelo celular na mesma rede: http://<SEU-IP>:${PORT}/remote.html`);
  console.log(`💰 Plano Ativo: R$ 29,90 / mês com Biblioteca de VS`);
  console.log(`====================================================`);
});
