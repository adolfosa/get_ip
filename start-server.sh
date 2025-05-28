#!/data/data/com.termux/files/usr/bin/bash

echo " _~T  Iniciando servidor Node.js..."

# Usa la ruta completa de Termux para node
export PATH="/data/data/com.termux/files/usr/bin:$PATH"

# Navega al directorio
cd /data/data/com.termux/files/home/get_ip || {
    echo "Error: No se pudo acceder al directorio"
    exit 1
}

# Mata cualquier instancia previa (opcional)
pkill -f "node server.js" 2>/dev/null

# Inicia el servidor descartando todos los logs
nohup node server.js >/dev/null 2>&1 &

# Verificación básica
if ps -p $! >/dev/null; then
    echo " \~E Servidor iniciado correctamente (PID: $!)"
else
    echo " ]~L Error al iniciar el servidor"
fi