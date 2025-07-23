const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;
const { logoData } = require('./logo.js');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://totem-costa2.netlify.app',
    'https://localhost:3000',
    'https://localhost',
    'https://127.0.0.1'
  ];

  const isLocalNet = req.connection.remoteAddress?.startsWith('10.') || req.connection.remoteAddress?.startsWith('192.168.');
  const isAllowedOrigin = origin &&
    (allowedOrigins.includes(origin) || origin.startsWith('https://10.'));

  // Si hay origin válido o si viene de red local sin origin
  if (isAllowedOrigin || (!origin && isLocalNet)) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    console.log('[CORS] Sin Origin explícito → PERMITIDO desde IP', req.connection.remoteAddress);
  } else {
    console.log('[CORS] Bloqueado → Origin:', origin, 'IP:', req.connection.remoteAddress);
  }

  if (req.method === 'OPTIONS') return res.sendStatus(204);

  next();
});

app.use(express.json());
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/get_ip', (req, res) => {
  res.json({ ip: '10.5.20.100' });
});

app.post('/print', (req, res) => {
  const { content, boleto } = req.body;
  if (!content && !boleto) {
    return res.status(400).json({ error: 'No hay datos proporcionados' });
  }

  try {
    const base64 = generatePrintCommand(content, boleto);
    res.json({ rawbt: `rawbt:base64,${base64}` });
  } catch (err) {
    console.error('Error generating ESC/POS from text:', err);
    res.status(500).json({ error: 'Failed to convert text to print command' });
  }
});

// Función para generar comandos ESC/POS
function generatePrintCommand(content, boleto) {
  function appendBytes(arr1, arr2) {
    const merged = new Uint8Array(arr1.length + arr2.length);
    merged.set(arr1);
    merged.set(arr2, arr1.length);
    return merged;
  }

  function stringToEscPos(content, boleto) {
    const encoder = new TextEncoder();
    let escPos = new Uint8Array(0);

    function feedAndCut() {
      let seq = new Uint8Array(0);
      seq = appendBytes(seq, encoder.encode('\n\n\n\n'));
      seq = appendBytes(seq, new Uint8Array([0x1D, 0x56, 0x00]));
      return seq;
    }

    escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40]));

    if (content && boleto) {
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
      escPos = appendBytes(escPos, encoder.encode(content));
      escPos = appendBytes(escPos, feedAndCut());

      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
      escPos = appendBytes(escPos, logoData);
      escPos = appendBytes(escPos, encoder.encode('\n\n'));
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
      escPos = appendBytes(escPos, encoder.encode(boleto));
      escPos = appendBytes(escPos, feedAndCut());
    }
    else if (boleto) {
      const firstLine = boleto.split('\n')[0] || '---------';
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40]));
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
      escPos = appendBytes(escPos, encoder.encode(firstLine + '\n'));
      escPos = appendBytes(escPos, feedAndCut());

      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40]));
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
      escPos = appendBytes(escPos, logoData);
      escPos = appendBytes(escPos, new Uint8Array([0x0A, 0x0A]));
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
      escPos = appendBytes(escPos, encoder.encode(boleto));
      escPos = appendBytes(escPos, feedAndCut());
    }
    else if (content) {
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
      escPos = appendBytes(escPos, encoder.encode(content));
      escPos = appendBytes(escPos, feedAndCut());
    }

    return escPos;
  }

  function uint8ToBase64(uint8arr) {
    let binary = '';
    for (let i = 0; i < uint8arr.length; i++) {
      binary += String.fromCharCode(uint8arr[i]);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  }

  const escPosData = stringToEscPos(content, boleto);
  return uint8ToBase64(escPosData);
}

// Opciones SSL
const sslOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

// Iniciar servidor HTTPS
const server = https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(` \~E API escuchando en localhost`); 
});