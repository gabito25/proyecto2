require('dotenv').config({ path: '.env.local' });

const { db } = require('../../lib/firebase.js');
const { compararContraseña, generarToken } = require('../../lib/auth.js');
const { validarEmail } = require('../../lib/validaciones.js');
const { corsMiddleware } = require('../../middleware/cors.js');
const { rateLimitMiddleware } = require('../../middleware/rateLimit.js');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (rateLimitMiddleware(req, 20, 900000)) {
    return res.status(429).json({ 
      exito: false, 
      error: 'Demasiados intentos. Intenta más tarde.' 
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        exito: false, 
        error: 'Email y contraseña son requeridos' 
      });
    }

    if (!validarEmail(email)) {
      return res.status(400).json({ 
        exito: false, 
        error: 'Email inválido' 
      });
    }

    const usuariosRef = db.collection('usuarios');
    const snapshot = await usuariosRef
      .where('email', '==', email.toLowerCase())
      .where('activo', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ 
        exito: false, 
        error: 'Credenciales inválidas' 
      });
    }

    const doc = snapshot.docs[0];
    const usuario = { id: doc.id, ...doc.data() };

    const contraseñaValida = await compararContraseña(password, usuario.contraseña);
    if (!contraseñaValida) {
      return res.status(401).json({ 
        exito: false, 
        error: 'Credenciales inválidas' 
      });
    }

    await doc.ref.update({
      ultimoLogin: new Date().toISOString()
    });

    const token = generarToken({
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre
    });

    res.status(200).json({
      exito: true,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre
      },
      token
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al iniciar sesión' 
    });
  }
};
