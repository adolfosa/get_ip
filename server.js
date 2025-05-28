const https = require('https');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const os = require('os');
const app = express();
const PORT = 3000;

// Middlewares básicos
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Endpoint para verificar conexión
app.get('/ping', (req, res) => {
    res.json({ status: 'active', service: 'rawbt-printer' });
});

// Endpoint principal de impresión
app.post('/print', (req, res) => {
    try {
        const { content, options } = req.body;

        // Validación mínima
        if (!content) {
            return res.status(400).json({ error: "El contenido a imprimir es requerido" });
        }

        // Generar comando ESC/POS basado en el contenido
        const escPosData = generateEscPos(content, options || {});

        // Convertir a formato RawBT
        const rawbtUrl = `rawbt:base64,${escPosData.toString('base64')}`;

        res.json({
            success: true,
            rawbt_url: rawbtUrl,
            content_length: content.length
        });

    } catch (error) {
        console.error("Error en /print:", error);
        res.status(500).json({ error: "Error al procesar la solicitud de impresión" });
    }
});

// Función genérica para generar ESC/POS
function generateEscPos(content, options) {
    // Configuración por defecto
    const config = {
        encoding: 'utf8',
        cut: true,
        linesAfter: 3,
        ...options
    };

    let escPos = Buffer.from([]);

    // Comandos iniciales (reset, alineación izquierda)
    escPos = Buffer.concat([escPos, Buffer.from([0x1B, 0x40])]); // Reset
    escPos = Buffer.concat([escPos, Buffer.from([0x1B, 0x61, 0x00])]); // Alineación izquierda

    // Agregar contenido principal
    escPos = Buffer.concat([escPos, Buffer.from(content, config.encoding)]);

    // Agregar líneas finales y corte
    if (config.linesAfter > 0) {
        escPos = Buffer.concat([escPos, Buffer.from('\n'.repeat(config.linesAfter))]);
    }
    if (config.cut) {
        escPos = Buffer.concat([escPos, Buffer.from([0x1D, 0x56, 0x00])]); // Corte completo
    }

    return escPos;
}

// Obtener información del servidor
app.get('/server/info', (req, res) => {
    const interfaces = os.networkInterfaces();
    const addresses = [];

    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push(iface.address);
            }
        }
    }

    res.json({
        service: 'rawbt-print-server',
        version: '1.0',
        available_ips: addresses,
        port: PORT,
        endpoints: {
            print: 'POST /print',
            info: 'GET /server/info',
            health: 'GET /ping'
        }
    });
});

// Configuración HTTPS
const sslOptions = {
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem'),
};

// Iniciar servidor
https.createServer(sslOptions, app).listen(PORT, () => {
    console.log(`RAWBT Print Server running on port ${PORT}`);
    console.log('Available network interfaces:');
    
    const interfaces = os.networkInterfaces();
    for (const interfaceName in interfaces) {
        for (const iface of interfaces[interfaceName]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`- https://${iface.address}:${PORT}`);
            }
        }
    }
});