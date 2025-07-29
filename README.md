# get_ip
Pequeño backend hecho con Node.js para exponer ip de totem android y habilitar impresión desde frontend en la web

Se debe instalar Termux version 1001 para el android 10

Instalar desde Play Store RawBt (app de impresión)

Instalar node.js

    pkg install nodejs

Generar certificado SSL

    openssl genrsa -out key.pem 2048

    openssl req -new -x509 -key key.pem -out cert.pem -days 36500

Dar permisos 
    chmod +x ~/get_ip/start-server.sh


En el home de Termux se debe configurar el archivo bashrc:

    nano ~/.bashrc 
        escribir-> get_ip/start-server.sh


Una vez corriendo el servidor, en el buscador del totem se debe acceder a la url https://localhost:3000/index.html y se debe marcar como conexión segura

Link para probar impresora: https://test-imp-totem2.netlify.app/

Desactivar Launcher3 con ADB: adb shell pm disable-user --user 0 com.android.launcher3

Para que el frontend consuma la API /print del servidor, debe realizar una petición POST al endpoint https://localhost:3000/print (o a la IP correspondiente), enviando en el cuerpo de la solicitud los campos content y/o boleto.

    Ejemplo:
            fetch('https://localhost:3000/print', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    content: 'Este es el contenido del voucher',
                    boleto: 'Este es el contenido del boleto'
                }
                })
                .then(response => response.json())
                .then(data => {
                console.log('Respuesta del servidor:', data);
                // Si estás usando RawBT en Android, puedes redirigir o usar window.open:
                if (data.rawbt) {                    
                    window.location.href = data.rawbt
                }
                })
                .catch(error => {
                console.error('Error al enviar a imprimir:', error);
                });

Tecnologías y módulos usados:

1. Node.js
Permite construir el servidor web

2. Express
Simplifica el manejo de rutas, peticiones y middleware.

3. HTTPS
Usa el módulo nativo https para crear un servidor con certificado SSL, lo que permite comunicación cifrada.
Se configura con:
    key: fs.readFileSync('./key.pem'),
    cert: fs.readFileSync('./cert.pem')

4. CORS
El middleware cors permite aceptar peticiones desde otros orígenes, como un frontend en otra IP o puerto.

5. File System (fs)
Permite leer los certificados SSL (key.pem, cert.pem) directamente.

6. Path
El módulo path ayuda a construir rutas de archivos de forma segura (compatible con Windows, Linux, etc.).

7. TextEncoder / Uint8Array
Son APIs del entorno JavaScript (Web / Node >= 11). Se usan para convertir texto a bytes (TextEncoder) y manipular los datos binarios (Uint8Array), necesarios para generar comandos ESC/POS.

8. Formato ESC/POS
Este es el estándar de comandos binarios usado por muchas impresoras térmicas. Se generan manualmente secuencias de control como:    
    0x1B 0x40 → Inicializar impresora
    
    0x1D 0x56 0x00 → Cortar papel
    
    0x1B 0x61 0x00 → Alinear texto a la izquierda

9. Base64 + RawBT
El servidor convierte el buffer ESC/POS a base64, lo que permite usarlo con apps como RawBT a través de este esquema de URL: { "rawbt": "rawbt:base64,..." }
En el frontend se puede redirigir a window.location.href = data.rawbt para que se abra directamente la app de impresión.

cmd package install-existing com.android.launcher3
pm enable --user 0 com.android.launcher3
    
