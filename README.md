# get_ip
Pequeño backend para exponer ip de totem android y habilitar impresión desde frontend en la web

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

    
