require('dotenv').config({ path: '.env.local' });

const { db } = require('../../lib/firebase.js');
const { hashearContraseña, generarToken } = require('../../lib/auth.js');
const { validarEmail, validarContraseña, validarNombre, limpiarEntrada } = require('../../lib/validaciones.js');
const { corsMiddleware } = require('../../middleware/cors.js');
const { rateLimitMiddleware } = require('../../middleware/rateLimit.js');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (rateLimitMiddleware(req, 10, 3600000)) {
    return res.status(429).json({ 
      exito: false, 
      error: 'Demasiadas solicitudes. Intenta más tarde.' 
    });
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    const { email, password, nombre } = req.body;

    if (!validarEmail(email)) {
      return res.status(400).json({ 
        exito: false, 
        error: 'Email inválido' 
      });
    }

    if (!validarContraseña(password)) {
      return res.status(400).json({ 
        exito: false, 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    if (!validarNombre(nombre)) {
      return res.status(400).json({ 
        exito: false, 
        error: 'El nombre debe tener al menos 2 caracteres' 
      });
    }

    const usuariosRef = db.collection('usuarios');
    const usuarioExistente = await usuariosRef
      .where('email', '==', email.toLowerCase())
      .get();

    if (!usuarioExistente.empty) {
      return res.status(400).json({ 
        exito: false, 
        error: 'El email ya está registrado' 
      });
    }

    const nuevoUsuario = {
      email: email.toLowerCase(),
      contraseña: await hashearContraseña(password),
      nombre: limpiarEntrada(nombre),
      fechaRegistro: new Date().toISOString(),
      activo: true
    };

    const docRef = await usuariosRef.add(nuevoUsuario);
    const usuarioId = docRef.id;

    const token = generarToken({
      id: usuarioId,
      email: nuevoUsuario.email,
      nombre: nuevoUsuario.nombre
    });

    res.status(201).json({
      exito: true,
      usuario: {
        id: usuarioId,
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre
      },
      token
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al registrar usuario' 
    });
  }
};