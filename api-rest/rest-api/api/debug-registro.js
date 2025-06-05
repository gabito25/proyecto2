// ===================================
// api/debug-registro.js - Debug específico para registro
// ===================================
require('dotenv').config({ path: '.env.local' });

const { corsMiddleware } = require('../middleware/cors.js');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  const debugSteps = [];

  try {
    // Step 1: Verificar que lleguen los datos
    debugSteps.push({ step: 1, description: "Datos recibidos", data: req.body });
    
    const { email, password, nombre } = req.body;

    // Step 2: Validaciones básicas
    debugSteps.push({ step: 2, description: "Validaciones básicas", 
      email: !!email, password: !!password, nombre: !!nombre });

    // Step 3: Importar validaciones
    const { validarEmail, validarContraseña, validarNombre } = require('../lib/validaciones.js');
    debugSteps.push({ step: 3, description: "Módulo validaciones importado" });

    // Step 4: Validar email
    const emailValido = validarEmail(email);
    debugSteps.push({ step: 4, description: "Validación email", valido: emailValido });

    if (!emailValido) {
      return res.status(400).json({ 
        exito: false, 
        error: 'Email inválido',
        debug: debugSteps
      });
    }

    // Step 5: Validar contraseña
    const contraseñaValida = validarContraseña(password);
    debugSteps.push({ step: 5, description: "Validación contraseña", valida: contraseñaValida });

    if (!contraseñaValida) {
      return res.status(400).json({ 
        exito: false, 
        error: 'Contraseña inválida',
        debug: debugSteps
      });
    }

    // Step 6: Validar nombre
    const nombreValido = validarNombre(nombre);
    debugSteps.push({ step: 6, description: "Validación nombre", valido: nombreValido });

    if (!nombreValido) {
      return res.status(400).json({ 
        exito: false, 
        error: 'Nombre inválido',
        debug: debugSteps
      });
    }

    // Step 7: Inicializar Firebase
    const { db } = require('../lib/firebase.js');
    debugSteps.push({ step: 7, description: "Firebase inicializado" });

    // Step 8: Acceder a colección usuarios
    const usuariosRef = db.collection('usuarios');
    debugSteps.push({ step: 8, description: "Referencia a colección usuarios obtenida" });

    // Step 9: Verificar usuario existente
    debugSteps.push({ step: 9, description: "Verificando usuario existente..." });
    const usuarioExistente = await usuariosRef
      .where('email', '==', email.toLowerCase())
      .get();
    
    debugSteps.push({ step: 10, description: "Consulta ejecutada", 
      usuarioExiste: !usuarioExistente.empty,
      cantidadDocumentos: usuarioExistente.size
    });

    if (!usuarioExistente.empty) {
      return res.status(400).json({ 
        exito: false, 
        error: 'El email ya está registrado',
        debug: debugSteps
      });
    }

    // Step 11: Importar función de hash
    const { hashearContraseña } = require('../lib/auth.js');
    debugSteps.push({ step: 11, description: "Función hashearContraseña importada" });

    // Step 12: Hashear contraseña
    debugSteps.push({ step: 12, description: "Hasheando contraseña..." });
    const contraseñaHasheada = await hashearContraseña(password);
    debugSteps.push({ step: 13, description: "Contraseña hasheada", 
      hasLength: contraseñaHasheada?.length || 0 });

    // Step 13: Preparar datos usuario
    const { limpiarEntrada } = require('../lib/validaciones.js');
    const nuevoUsuario = {
      email: email.toLowerCase(),
      contraseña: contraseñaHasheada,
      nombre: limpiarEntrada(nombre),
      fechaRegistro: new Date().toISOString(),
      activo: true
    };
    debugSteps.push({ step: 14, description: "Datos de usuario preparados", 
      emailFinal: nuevoUsuario.email, 
      nombreFinal: nuevoUsuario.nombre 
    });

    // Step 14: Crear usuario en Firestore
    debugSteps.push({ step: 15, description: "Creando usuario en Firestore..." });
    const docRef = await usuariosRef.add(nuevoUsuario);
    debugSteps.push({ step: 16, description: "Usuario creado", 
      userId: docRef.id 
    });

    // Step 15: Generar token
    const { generarToken } = require('../lib/auth.js');
    const token = generarToken({
      id: docRef.id,
      email: nuevoUsuario.email,
      nombre: nuevoUsuario.nombre
    });
    debugSteps.push({ step: 17, description: "Token generado", 
      tokenLength: token?.length || 0 
    });

    // Éxito!
    res.status(201).json({
      exito: true,
      usuario: {
        id: docRef.id,
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre
      },
      token,
      debug: debugSteps
    });

  } catch (error) {
    debugSteps.push({ 
      step: "ERROR", 
      description: "Error capturado",
      message: error.message,
      stack: error.stack 
    });

    console.error('Error en debug registro:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error en debug registro',
      message: error.message,
      debug: debugSteps
    });
  }
};