require('dotenv').config({ path: '.env.local' });

const { corsMiddleware } = require('../../middleware/cors.js');
const { requireAuth } = require('../../middleware/auth.js');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    const usuario = await requireAuth(req);

    res.status(200).json({
      exito: true,
      mensaje: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(401).json({ 
      exito: false, 
      error: error.message || 'Error al cerrar sesión' 
    });
  }
};
