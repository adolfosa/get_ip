#!/data/data/com.termux/files/usr/bin/bash

echo " _~T  Iniciando servidor Node.js..."

su <<'EOF'
export PATH=/data/data/com.termux/files/usr/bin:$PATH
cd /data/data/com.termux/files/home/get_ip
nohup node server.js > node.log 2>&1 &

echo "PID: $!"
echo "Logs: ~/get_ip/node.log"
exit
EOF

if grep -q "Error" ~/get_ip/node.log 2>/dev/null; then
    echo " ]~L Error al iniciar:"
    tail -n 5 ~/get_ip/node.log
else
    echo " \~E Servidor iniciado correctamente"
fi