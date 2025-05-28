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

// Opciones SSL
const sslOptions = {
  key: fs.readFileSync('./key.pem'),
  cert: fs.readFileSync('./cert.pem'),
};

// Iniciar servidor HTTPS
https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(` \~E API escuchando en localhost`);
});