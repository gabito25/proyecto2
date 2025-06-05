require('dotenv').config({ path: '.env.local' });

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

function generarToken(usuario) {
  return jwt.sign(
    { 
      id: usuario.id, 
      email: usuario.email,
      nombre: usuario.nombre
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function verificarToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

async function hashearContraseña(contraseña) {
  return await bcrypt.hash(contraseña, 10);
}

async function compararContraseña(contraseña, hash) {
  if (!contraseña || !hash) {
    console.error('compararContraseña: parámetros inválidos', { 
      contraseña: !!contraseña, 
      hash: !!hash 
    });
    return false;
  }
  return await bcrypt.compare(contraseña, hash);
}

module.exports = {
  generarToken,
  verificarToken,
  hashearContraseña,
  compararContraseña
};