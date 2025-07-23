const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const { logoData } = require('./logo.js');

const app = express();
const PORT = 3000;

// Middleware CORS global
const corsOptions = {
  origin: 'https://totem-costa2.netlify.app',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Soporte preflight
app.use(express.json());
app.use(express.static('public'));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/get_ip', (req, res) => {
  res.json({ ip: '192.168.88.232' });
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

// Iniciar servidor HTTPS
const sslOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`~E API escuchando en https://localhost:${PORT}`);

  setTimeout(() => {
    printTestPage();

    // Limpieza secundaria por si acaso
    setTimeout(() => exec('am force-stop ru.a402d.rawbtprinter'), 5000);
  }, 2000);
});

// --- Funciones auxiliares ---

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
      seq = appendBytes(seq, new Uint8Array([0x1D, 0x56, 0x00])); // cortar
      return seq;
    }

    escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40])); // init

    if (content && boleto) {
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00])); // left
      escPos = appendBytes(escPos, encoder.encode(content));
      escPos = appendBytes(escPos, feedAndCut());

      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01])); // center
      escPos = appendBytes(escPos, logoData);
      escPos = appendBytes(escPos, encoder.encode('\n\n'));

      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00])); // left
      escPos = appendBytes(escPos, encoder.encode(boleto));
      escPos = appendBytes(escPos, feedAndCut());
    } else if (boleto) {
      const firstLine = boleto.split('\n')[0] || '---------';
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
      escPos = appendBytes(escPos, encoder.encode(firstLine + '\n'));
      escPos = appendBytes(escPos, feedAndCut());

      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
      escPos = appendBytes(escPos, logoData);
      escPos = appendBytes(escPos, new Uint8Array([0x0A, 0x0A]));

      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
      escPos = appendBytes(escPos, encoder.encode(boleto));
      escPos = appendBytes(escPos, feedAndCut());
    } else if (content) {
      escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
      escPos = appendBytes(escPos, encoder.encode(content));
      escPos = appendBytes(escPos, feedAndCut());
    }

    return escPos;
  }

  function uint8ToBase64(uint8arr) {
    return Buffer.from(uint8arr).toString('base64');
  }

  const escPosData = stringToEscPos(content, boleto);
  return uint8ToBase64(escPosData);
}

function forceCloseRawBT() {
  console.log('[RAWBT] Ejecutando secuencia de cierre agresivo');

  const commands = [
    'am force-stop ru.a402d.rawbtprinter',
    'input keyevent KEYCODE_HOME',
    'service call activity 79 s16 com.android.systemui',
    'pkill -f ru.a402d.rawbtprinter',
    'am kill ru.a402d.rawbtprinter'
  ];

  commands.forEach((cmd, i) => {
    setTimeout(() => {
      exec(cmd, (err) => {
        if (err) console.log(`[RAWBT] Error en comando ${i}:`, err);
      });
    }, i * 800);
  });
}

function printTestPage() {
  console.log('[RAWBT] Iniciando proceso de preparación');

  forceCloseRawBT();

  setTimeout(() => {
    exec('am start -n ru.a402d.rawbtprinter/.MainActivity', () => {
      console.log('[RAWBT] Aplicación abierta, preparando impresión');

      setTimeout(() => {
        const testContent = "TEST INICIAL\nServidor activo\n\n";
        const base64Data = generatePrintCommand(testContent, null);
        const printUrl = `rawbt:base64,${base64Data}?closeOnFinish=0&dontShowUI=0`;

        exec(`termux-open-url "${printUrl}"`, { timeout: 1000 }, () => {});

        setTimeout(() => {
          forceCloseRawBT();

          setTimeout(() => {
            exec('ps | grep ru.a402d.rawbtprinter', (_, stdout) => {
              if (stdout.includes('ru.a402d.rawbtprinter')) {
                console.log('[RAWBT] Aplicación persistente, usando método nuclear');
                exec('am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:ru.a402d.rawbtprinter');
              }
            });
          }, 5000);
        }, 3000);
      }, 4000);
    });
  }, 2000);
}
