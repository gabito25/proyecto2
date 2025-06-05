require('dotenv').config({ path: '.env.local' });

const { db } = require('../../lib/firebase.js');
const { corsMiddleware } = require('../../middleware/cors.js');
const { requireAuth } = require('../../middleware/auth.js');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    const usuarioAuth = await requireAuth(req);

    const usuarioDoc = await db.collection('usuarios')
      .doc(usuarioAuth.id)
      .get();

    if (!usuarioDoc.exists) {
      return res.status(404).json({ 
        exito: false, 
        error: 'Usuario no encontrado' 
      });
    }

    const usuario = usuarioDoc.data();

    res.status(200).json({
      exito: true,
      datos: {
        id: usuarioAuth.id,
        email: usuario.email,
        nombre: usuario.nombre,
        fechaRegistro: usuario.fechaRegistro,
        ultimoLogin: usuario.ultimoLogin
      }
    });

  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(error.message.includes('Token') ? 401 : 500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener perfil de usuario' 
    });
  }
};