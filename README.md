# get_ip
Pequeño backend para exponer ip de totem android

npm install express
npm install cors

openssl genrsa -out key.pem 2048
openssl req -new -x509 -key key.pem -out cert.pem -days 36500

chmod +x ~/get_ip/start-server.sh

En el home de Termux se debe configurar el archivo bashrc:
    nano ~/.bashrc 
        escribir-> get_ip/start-server.sh


