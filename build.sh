#!/bin/bash

echo "🚀 Iniciando build para Vercel..."

# Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
npm install

# Ir al directorio frontend e instalar dependencias
echo "📦 Instalando dependencias del frontend..."
cd frontend
npm install

# Construir el frontend
echo "🏗️ Construyendo frontend..."
npm run build

# Mover archivos del build al directorio raíz
echo "📁 Moviendo archivos de build..."
cd ..
cp -r frontend/dist/* .

echo "✅ Build completado!"