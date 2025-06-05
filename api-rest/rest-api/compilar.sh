#!/bin/bash

echo "===> Instalando dependencias..."
npm install

echo "===> Verificando archivo de variables de entorno (.env.local)..."
if [ ! -f .env.local ]; then
  echo "❌ Falta el archivo .env.local. Cópialo y configura tus variables de entorno."
  exit 1
fi

echo "===> Variables de entorno detectadas:"
grep -v '^#' .env.local | grep -v '^$'

echo "===> Ejecutando pruebas automáticas..."
npm test

echo "===> Iniciando API en modo desarrollo..."
npm run dev

# Si usas otro comando para iniciar (por ejemplo, node api/index.js), reemplaza la última línea por:
# node api/index.js