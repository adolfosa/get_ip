const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const os = require('os');
const path = require('path'); // Añadir esto
const app = express();
const PORT = 3000;

// Middlewares
app.use(cors()); // habilita CORS para cualquier origen
app.use(express.json());
app.use(express.static('public')); // Sirve archivos estáticos desde la carpeta 'public'

// Ruta principal que sirve el index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/get_ip', (req, res) => {
  res.json({ ip: '192.168.88.232' });
});

app.post('/print', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'No content provided' });

  function appendBytes(arr1, arr2) {
    const merged = new Uint8Array(arr1.length + arr2.length);
    merged.set(arr1);
    merged.set(arr2, arr1.length);
    return merged;
  }

  function stringToEscPos(text) {
    const encoder = new TextEncoder();
    let escPos = new Uint8Array(0);

    escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40])); // Initialize printer
    escPos = appendBytes(escPos, encoder.encode(text));
    escPos = appendBytes(escPos, encoder.encode('\n\n\n\n'));
    escPos = appendBytes(escPos, new Uint8Array([0x0A, 0x0A, 0x1D, 0x56, 0x00])); // Feed and cut

    return escPos;
  }

  function uint8ToBase64(uint8arr) {
    let binary = '';
    for (let i = 0; i < uint8arr.length; i++) {
      binary += String.fromCharCode(uint8arr[i]);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  }

  try {
    const escPosData = stringToEscPos(content);
    const base64 = uint8ToBase64(escPosData);
    res.json({ rawbt: `rawbt:base64,${base64}` });
  } catch (err) {
    console.error('Error generating ESC/POS from text:', err);
    res.status(500).json({ error: 'Failed to convert text to print command' });
  }
});

// Opciones SSL
const sslOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

// Iniciar servidor HTTPS
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(` \~E API escuchando en localhost`);
});