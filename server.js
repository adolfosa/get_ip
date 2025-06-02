const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
const PORT = 3000;
const { logoData } = require('./logo.js');

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

function printTestPage() {
  const testContent = "Impresora lista\nServidor activo\n\n";
  const base64Data = generatePrintCommand(testContent, null);
  
  // URL con parámetros para ocultar/cerrar RawBT automáticamente
  const printUrl = `rawbt:base64,${base64Data}?closeOnFinish=1&dontShowUI=1`;
  
  console.log("Enviando impresión de prueba a RawBT...");
  console.log("URL generada:", printUrl); // Para depuración

  const { exec } = require('child_process');
  
  // Comando para Termux con timeout de 10 segundos
  const termuxCommand = `am start --user 0 -a android.intent.action.VIEW -d "${printUrl}"`;
  
  exec(termuxCommand, { timeout: 10000 }, (error, stdout, stderr) => {
    if (error) {
      console.error("❌ Error al enviar a RawBT:", error.message);
      
    } else {
      console.log("✅ Comando enviado.");      
    }
  });
}

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

// Opciones SSL
const sslOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

// Iniciar servidor HTTPS
const server = https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(` \~E API escuchando en localhost`);
  // Ejecutar impresión de prueba después de iniciar el servidor
  setTimeout(printTestPage, 2000); // Esperar 2 segundos para asegurar que el servidor esté listo
});