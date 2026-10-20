# 🎛️ TRILHA WEB - Player Profissional de Multitracks, VS & Worship Pads

Uma solução completa desenvolvida para rodar 100% na Web (Desktop, Tablet e Celular), inspirada na arquitetura do software desktop **Trilha**, mas com um modelo de negócios **SaaS inovador por assinatura de R$ 29,90/mês com Biblioteca de VS na Nuvem inclusa**.

---

## 🔎 Análise do App "Trilha" Encontrado no seu PC

Durante a análise forense do seu computador, encontramos os seguintes detalhes do aplicativo instalado:

- **Local de Instalação:** `C:\Program Files\Trilha\Trilha.exe`
- **Pastas de Dados e Configuração:** `C:\Users\Selvano\AppData\Roaming\Trilha\`
  - `configuracoes.json`: Armazena volumes master, saídas ASIO, parâmetros de click (BPM, compassos, acentos), parâmetros do pad contínuo (tempo de subida, troca de tom com crossfade), portas de controle remoto (`8765`) e cenas/setlists.
  - `logs\trilha.log`: Registrou a versão 0.9.1, login via Google (`https://trilha-multitracks.pages.dev/entrar`).
- **Tecnologias Usadas no Desktop:** Desenvolvido em C++ com o framework de áudio **JUCE 9**, drivers ASIO, biblioteca **Signalsmith Stretch** (para transposição de tom e tempo) e **whisper.cpp / ggml** (reconhecimento de voz para detecção automática de seções da guia).
- **Principal Limitação do Trilha Original:** O Trilha desktop **não fornece multitracks na nuvem**. O usuário precisa garimpar, baixar e organizar suas próprias pastas de áudio no disco rígido.
- **A Grande Oportunidade do seu Negócio (R$ 29,90/mês):** Músicos e igrejas não querem a dor de cabeça de caçar multitracks em drives da internet. O **Trilha Web** une o **Software Player Profissional** com a **Biblioteca de VSs Gospel Pronta na Nuvem** por um valor ultra acessível.

---

## 🚀 Funcionalidades do Trilha Web

1. **Mixer Multitrack Estéreo & Split:**
   - Faders verticais deslizantes com medidores VU Meter em tempo real por canal (Bateria, Baixo, Guitarras, Teclas, Click, Guia, Backing Vocals, Master).
   - Botões de **Mute (M)** e **Solo (S)** iluminados.
   - **Modo Saída Split Inteligente:** Roteia o Click e Guia 100% para a esquerda (Fone do Baterista) e a Banda 100% para a direita (Mesa de Som / P.A. da Igreja), permitindo que qualquer igreja toque com um simples cabo P2 estéreo sem precisar comprar interface de áudio cara!

2. **Seções da Música & Saltos Quantizados no Compasso:**
   - Régua com blocos visuais coloridos para cada parte (Intro, Verso, Pré-Refrão, Refrão, Ponte, Espontâneo, Final).
   - Quando você clica em uma seção no meio da música, o sistema sinaliza e **espera a virada do compasso (tempo 1)** para pular sem perder o andamento!
   - Botão **Loop** para repetir a mesma seção quantas vezes o ministro de louvor quiser.
   - Botão **Fade Out** suave de 3 segundos para encerrar a música com elegância.

3. **Worship Pads Contínuos Infinitos:**
   - Sintetizador procedural com filtros passa-baixas analógicos e reverb etéreo.
   - Botões para os 12 tons musicais (C, C#, D, D#, E, F, F#, G, G#, A, A#, B).
   - Crossfade harmônico de 2 segundos ao trocar de tom — sem cortes secos ou estalos.
   - Função automática: **abaixa o volume do pad sozinho** quando a música começa a tocar e sobe quando termina.

4. **Biblioteca de VSs na Nuvem (Inclusa no plano de R$ 29,90):**
   - Sucessos pré-carregados (A Casa É Sua, Ruja o Leão, Bondade de Deus, Ousado Amor, Todavia Me Alegrarei, etc.).
   - Filtro de busca instantânea por título, cantor, tom e BPM.

5. **Cifra e Letra Sincronizada:**
   - Painel com acordes e letra transpostos automaticamente de acordo com o tom selecionado.

6. **Controle Remoto sem Fio no Palco (`remote.html`):**
   - Interface touchscreen com botões gigantes pensada para celular ou tablet no púlpito ou na bateria via Wi-Fi.

---

## 🛠️ Como Testar e Rodar no seu Computador Agora

Você pode rodar tanto diretamente no navegador quanto com o servidor Node.js:

### Opção 1: Abrir Direto no Navegador (Modo Estático / PWA)
1. Dê dois cliques no arquivo:
   `C:\Users\Selvano\Desktop\Pads Gustavo\trilha-web\public\index.html`
2. O player abrirá no Google Chrome ou Edge pronto para tocar com áudio em alta definição!

### Opção 2: Rodar com Servidor Node.js (com WebSocket e Controle Remoto)
1. Abra o terminal (PowerShell) na pasta `trilha-web`:
   ```bash
   cd "C:\Users\Selvano\Desktop\Pads Gustavo\trilha-web"
   npm install
   npm start
   ```
2. Acesse: `http://localhost:3000`
3. Para abrir o controle remoto no celular, conecte o celular no mesmo Wi-Fi e acesse `http://<SEU-IP>:3000/remote.html`.

---

## 🌐 Como Subir no GitHub e Hospedar na Hostinger

### Passo 1: Criar o Repositório no GitHub
1. Crie uma conta no [GitHub](https://github.com) se ainda não tiver.
2. Clique em **New Repository** e dê o nome de `trilha-web`.
3. No terminal da sua máquina dentro da pasta `trilha-web`:
   ```bash
   cd "C:\Users\Selvano\Desktop\Pads Gustavo\trilha-web"
   git init
   git add .
   git commit -m "Versao inicial Trilha Web com Player, Mixer e Biblioteca de VS"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/trilha-web.git
   git push -u origin main
   ```

### Passo 2: Hospedar na Hostinger

A Hostinger oferece duas opções principais:

#### Opção A: Hostinger VPS ou Cloud com Node.js (Recomendado para usar WebSockets)
1. No painel da Hostinger (hPanel), vá em **VPS** ou **Aplicações Node.js**.
2. Clique em **Criar Aplicação Node.js** ou acerte via terminal SSH.
3. Conecte com o seu repositório do GitHub (Deploy automático via Git).
4. Configure o arquivo principal como `server.js` e a porta como `3000` (ou variável de ambiente `PORT`).
5. Clique em **Deploy / Iniciar**. O seu site estará no ar no seu domínio (ex: `app.seusite.com.br`)!

#### Opção B: Hospedagem Compartilhada Web da Hostinger (Mais simples e barata)
1. A pasta `public/` do projeto é 100% autossuficiente e funciona em qualquer hospedagem estática ou compartilhada!
2. No painel da Hostinger, vá no **Gerenciador de Arquivos** do seu domínio.
3. Abra a pasta `public_html`.
4. Envie os arquivos da pasta `trilha-web/public/` diretamente para dentro da `public_html`.
5. Pronto! Ao acessar seu domínio, o player carregará instantaneamente.

---

## 💰 Modelo de Negócios: Assinatura de R$ 29,90 / Mês

### Como Integrar o Pagamento Recorrente:
Você pode plugar um gateway brasileiro com checkout transparente ou link de pagamento:
1. **Kiwify ou Hotmart:** Crie um produto do tipo **Assinatura Recorrente** no valor de R$ 29,90/mês. Copie a URL do checkout e cole no botão do modal de assinatura (`btn-checkout-cta` em `index.html`).
2. **Mercado Pago ou Asaas (Pix Recorrente):** Para quem quer aprovação instantânea via Pix e cartão de crédito.
3. Quando o assinante pagar, a plataforma envia um Webhook que libera o login ou envia o link exclusivo de acesso.
