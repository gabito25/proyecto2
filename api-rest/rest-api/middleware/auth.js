require('dotenv').config({ path: '.env.local' });

const { verificarToken } = require('../lib/auth.js');

async function requireAuth(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Token no proporcionado');
  }
  
  const decoded = verificarToken(token);
  if (!decoded) {
    throw new Error('Token inválido o expirado');
  }
  
  return decoded;
}

module.exports = { requireAuth };