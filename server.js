const https = require('https');
const http = require('http');
const fs = require('fs');
const express = require('express');
const path = require('path');
const app = express();
const { constants } = require('crypto');
const { logoData } = require('./logo.js');

// Configuración de puertos
const HTTPS_PORT = 3000;
const HTTP_PORT = 3001;

// ========================
// 1. Configuración de CORS Mejorada
// ========================
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const userAgent = req.headers['user-agent'] || '';
    const remoteAddress = req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Lista ampliada de orígenes permitidos
    const allowedOrigins = [
        'https://totem-costa2.netlify.app',
        'https://localhost:3000',
        'http://localhost:3000',
        'https://localhost',
        'http://localhost',
        'https://127.0.0.1',
        'http://127.0.0.1',
        'file://',
        'http://10.5.20.94:3000',
        'https://10.5.20.94:3000',
        'http://10.5.20.94:3001'
    ];

    // Detección mejorada de FullyKiosk
    const isFullyKiosk = /FullyKiosk|Android|Kiosk/i.test(userAgent);
    
    // Política de CORS flexible
    if (isFullyKiosk || !origin || allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        console.log(`[CORS] Permitiendo acceso desde: ${origin || 'FullyKiosk'}`);
    } else {
        console.log(`[CORS] Bloqueado - Origen: ${origin}, User-Agent: ${userAgent}`);
        return res.status(403).json({ error: 'Acceso no autorizado' });
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }

    next();
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ========================
// 2. Endpoints
// ========================
app.get('/get_ip', (req, res) => {
    console.log('Solicitud GET /get_ip recibida desde:', req.ip, 'User-Agent:', req.headers['user-agent']);
    res.json({ 
        ip: '10.5.20.100',
        status: 'success',
        timestamp: new Date().toISOString(),
        message: 'IP del servidor AMOS para procesamiento de pagos'
    });
});

app.post('/print', (req, res) => {
    const { content, boleto } = req.body;
    console.log('Solicitud POST /print recibida');

    if (!content && !boleto) {
        return res.status(400).json({ 
            error: 'Datos insuficientes',
            details: 'Se requiere content o boleto en el cuerpo de la solicitud'
        });
    }

    try {
        const base64 = generatePrintCommand(content, boleto);
        res.json({ 
            success: true,
            rawbt: `rawbt:base64,${base64}`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Error al generar comando de impresión:', err);
        res.status(500).json({ 
            error: 'Error de impresión',
            details: err.message 
        });
    }
});

// ========================
// 3. Configuración SSL Mejorada
// ========================
let sslOptions;
try {
    sslOptions = {
        key: fs.readFileSync('./key.pem'),
        cert: fs.readFileSync('./cert.pem'),
        // Configuración de seguridad mejorada pero compatible
        minVersion: 'TLSv1.2',
        secureOptions: constants.SSL_OP_NO_SSLv3 | 
                      constants.SSL_OP_NO_TLSv1 | 
                      constants.SSL_OP_NO_TLSv1_1,
        ciphers: [
            'ECDHE-ECDSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-ECDSA-CHACHA20-POLY1305',
            'ECDHE-RSA-CHACHA20-POLY1305',
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'DHE-RSA-AES256-GCM-SHA384'
        ].join(':'),
        honorCipherOrder: true
    };
} catch (err) {
    console.error('⚠️ No se encontraron certificados SSL:', err.message);
    sslOptions = null;
}

// ========================
// 4. Inicialización de Servidores
// ========================
function startServers() {
    // Función para obtener IP local
    const getLocalIpAddress = () => {
        const interfaces = require('os').networkInterfaces();
        for (const devName in interfaces) {
            const iface = interfaces[devName];
            for (const alias of iface) {
                if (alias.family === 'IPv4' && !alias.internal) {
                    return alias.address;
                }
            }
        }
        return '0.0.0.0';
    };

    const localIp = getLocalIpAddress();

    // Iniciar servidor HTTPS si hay certificados
    if (sslOptions) {
        const httpsServer = https.createServer(sslOptions, app)
            .listen(HTTPS_PORT, '0.0.0.0', () => {
                console.log(`🚀 Servidor HTTPS funcionando en:`);
                console.log(`- https://localhost:${HTTPS_PORT}`);
                console.log(`- https://${localIp}:${HTTPS_PORT}`);
            })
            .on('error', (err) => {
                console.error('❌ Error en servidor HTTPS:', err.message);
                if (err.code === 'EACCES' || err.code === 'EPERM') {
                    console.log('⚠️ No se pudo iniciar HTTPS. Verifica permisos o certificados.');
                }
            })
            .on('tlsClientError', (err) => {
                console.error('⚠️ Error TLS en cliente:', err.message);
            });
    }

    // Iniciar servidor HTTP (siempre disponible)
    const httpServer = http.createServer(app)
        .listen(HTTP_PORT, '0.0.0.0', () => {
            console.log(`🌐 Servidor HTTP funcionando en:`);
            console.log(`- http://localhost:${HTTP_PORT}`);
            console.log(`- http://${localIp}:${HTTP_PORT}`);
        })
        .on('error', (err) => {
            console.error('❌ Error en servidor HTTP:', err.message);
        });

    // Manejar cierre adecuado
    const gracefulShutdown = () => {
        console.log('\n🔻 Recibida señal de apagado. Cerrando servidores...');
        
        if (sslOptions) {
            httpsServer.close(() => {
                console.log('✅ Servidor HTTPS cerrado');
                httpServer.close(() => {
                    console.log('✅ Servidor HTTP cerrado');
                    process.exit(0);
                });
            });
        } else {
            httpServer.close(() => {
                console.log('✅ Servidor HTTP cerrado');
                process.exit(0);
            });
        }

        // Forzar cierre después de 5 segundos si es necesario
        setTimeout(() => {
            console.warn('⚠️ Cerrando forzadamente por timeout');
            process.exit(1);
        }, 5000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
}

// Iniciar todo
startServers();

// ========================
// 5. Función de Impresión (ESC/POS)
// ========================
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

        // Inicializar impresora
        escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40]));

        if (content && boleto) {
            // Contenido (alineación izquierda)
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
            escPos = appendBytes(escPos, encoder.encode(content));
            escPos = appendBytes(escPos, feedAndCut());

            // Logo (centrado)
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
            escPos = appendBytes(escPos, logoData);
            escPos = appendBytes(escPos, encoder.encode('\n\n'));

            // Boleto (izquierda)
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
            escPos = appendBytes(escPos, encoder.encode(boleto));
            escPos = appendBytes(escPos, feedAndCut());
        } else if (boleto) {
            const firstLine = boleto.split('\n')[0] || '---------';
            
            // Primera línea (centrada)
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40]));
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
            escPos = appendBytes(escPos, encoder.encode(firstLine + '\n'));
            escPos = appendBytes(escPos, feedAndCut());

            // Logo (centrado)
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x40]));
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x01]));
            escPos = appendBytes(escPos, logoData);
            escPos = appendBytes(escPos, new Uint8Array([0x0A, 0x0A]));

            // Boleto (izquierda)
            escPos = appendBytes(escPos, new Uint8Array([0x1B, 0x61, 0x00]));
            escPos = appendBytes(escPos, encoder.encode(boleto));
            escPos = appendBytes(escPos, feedAndCut());
        } else if (content) {
            // Solo contenido (izquierda)
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

// Manejo de errores global
process.on('uncaughtException', (err) => {
    console.error('⚠️ Error no capturado:', err);
    // No salir del proceso para mantener el servidor activo
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Rechazo no manejado en:', promise, 'razón:', reason);
});