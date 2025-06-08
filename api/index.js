const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { MongoClient, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

// Crear aplicación Express 
const app = express();

// Variables globales
let cachedDb = null;
let mongoClient = null;

// ===============================
// FUNCIONES DE VALIDACIÓN
// ===============================

function validarEmail(email) {
  return validator.isEmail(email);
}

function validarContraseña(contraseña) {
  return contraseña && contraseña.length >= 6;
}

function validarNombre(nombre) {
  return nombre && nombre.trim().length >= 2;
}

function limpiarEntrada(texto) {
  return validator.escape(texto.trim());
}

// ===============================
// FUNCIONES DE AUTENTICACIÓN
// ===============================

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
    console.error('compararContraseña: parámetros inválidos');
    return false;
  }
  return await bcrypt.compare(contraseña, hash);
}

// ===============================
// RATE LIMITING
// ===============================

const solicitudesPorIP = new Map();

function rateLimitMiddleware(req, limite = 100, ventana = 60000) {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const ahora = Date.now();
  
  if (!solicitudesPorIP.has(ip)) {
    solicitudesPorIP.set(ip, { count: 1, resetTime: ahora + ventana });
    return false;
  }
  
  const datos = solicitudesPorIP.get(ip);
  
  if (ahora > datos.resetTime) {
    datos.count = 1;
    datos.resetTime = ahora + ventana;
    return false;
  }
  
  datos.count++;
  
  if (datos.count > limite) {
    return true;
  }
  
  return false;
}

// ===============================
// CONFIGURACIÓN DE MONGODB
// ===============================

async function connectToMongoDB() {
  try {
    if (cachedDb && mongoClient) {
      return cachedDb;
    }

    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI no está configurado');
    }

    console.log('🍃 Conectando a MongoDB...');

    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4
    };

    if (!mongoClient) {
      mongoClient = new MongoClient(process.env.MONGODB_URI, options);
      await mongoClient.connect();
    }

    cachedDb = mongoClient.db('bioRxivDB');
    console.log('✅ MongoDB conectado exitosamente');
    
    return cachedDb;

  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    throw new Error(`Error de conexión MongoDB: ${error.message}`);
  }
}

// ===============================
// CONFIGURACIÓN DE FIREBASE
// ===============================

console.log('🔥 Inicializando Firebase...');

let db;

try {
  if (!admin.apps.length) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    } else {
      throw new Error('Firebase credentials not configured properly');
    }
  }

  db = admin.firestore();
  console.log('✅ Firebase y Firestore inicializados exitosamente');

} catch (error) {
  console.error('❌ Error inicializando Firebase:', error);
  throw error;
}



// ===============================
// CONFIGURACIÓN DE CORS DEFINITIVA
// ===============================

const allowedOrigins = [
  'https://biorxiv.vercel.app',  // ← TU FRONTEND PRINCIPAL
  'https://biorxiv-git-main-gabriels-projects-137ca855.vercel.app',
  'https://biorxiv-hsggfxfqr-gabriels-projects-137ca855.vercel.app',
  
  // URLs del backend para testing interno
  'https://proyecto2-flame.vercel.app',
  'https://proyecto2-git-main-gabriels-projects-137ca855.vercel.app',
  
  // Desarrollo local
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173'
];

console.log('🌐 CORS Origins permitidos:', allowedOrigins);

// Configurar Helmet con menos restricciones
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // Deshabilitar CSP que puede interferir
}));

// Middleware CORS personalizado MÁS PERMISIVO
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  console.log('🔍 CORS Request:', {
    method: req.method,
    path: req.path,
    origin: origin,
    isPreflight: req.method === 'OPTIONS'
  });

  // Siempre permitir el origin si está en la lista, o si no hay origin
  if (!origin || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  } else {
    console.log('⚠️ Origin no permitido:', origin);
    // En desarrollo/debug, permitir temporalmente
    res.header('Access-Control-Allow-Origin', origin);
  }

  // Headers CORS completos
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', [
    'Content-Type',
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ].join(','));
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');

  // Si es OPTIONS (preflight), responder inmediatamente
  if (req.method === 'OPTIONS') {
    console.log('✅ Respondiendo a OPTIONS preflight');
    return res.status(200).end();
  }

  next();
});

// Middleware adicional de CORS usando la librería
app.use(cors({
  origin: function (origin, callback) {
    console.log('📋 CORS Library check - Origin:', origin);
    
    // Permitir sin origin o si está en lista
    if (!origin || allowedOrigins.includes(origin)) {
      console.log('✅ CORS permitido');
      callback(null, true);
    } else {
      console.log('⚠️ CORS no en lista, permitiendo temporalmente');
      callback(null, true); // Temporal para debug
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept', 
    'Origin'
  ],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 200
}));

console.log('✅ CORS configurado con middleware dual');
// ===============================
// MIDDLEWARE DE EXPRESS - CRÍTICO
// ===============================

// PARSEAR JSON BODIES - SIN ESTO req.body ES UNDEFINED
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

console.log('✅ Express JSON middleware configurado');

// Rate limiting
const rateLimitWindowMs = 15 * 60 * 1000;
const maxRequestsPerWindow = 100;

app.use((req, res, next) => {
  if (rateLimitMiddleware(req, maxRequestsPerWindow, rateLimitWindowMs)) {
    return res.status(429).json({
      exito: false,
      error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    });
  }
  next();
});

console.log('✅ Rate limiting configurado');



// ===============================
// MIDDLEWARE DE AUTENTICACIÓN
// ===============================

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        exito: false,
        error: 'Token de autorización requerido'
      });
    }

    const decoded = verificarToken(token);
    if (!decoded) {
      return res.status(401).json({
        exito: false,
        error: 'Token inválido o expirado'
      });
    }

    req.user = decoded;
    next();

  } catch (error) {
    console.error('❌ Error en authMiddleware:', error);
    
    return res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
};

// ===============================
// RUTAS DE SALUD
// ===============================

app.get('/', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      mongodb: cachedDb ? 'connected' : 'disconnected',
      firebase: admin.apps.length > 0 ? 'connected' : 'disconnected'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      mongodb: cachedDb ? 'connected' : 'disconnected',
      firebase: admin.apps.length > 0 ? 'connected' : 'disconnected'
    }
  });
});


// ===============================
// RUTAS DE DEBUG - AGREGAR DESPUÉS DE /health
// ===============================

app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint - CORS test');
  console.log('🔍 Request origin:', req.headers.origin);
  
  res.json({
    status: 'OK',
    message: 'CORS test exitoso',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    corsEnabled: true,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Ruta específica para test CORS desde frontend
app.post('/test-cors', (req, res) => {
  console.log('🧪 POST Test CORS');
  console.log('🔍 Origin:', req.headers.origin);
  console.log('📦 Body:', req.body);
  
  res.json({
    status: 'OK',
    message: 'POST CORS test exitoso',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

app.get('/routes', (req, res) => {
  const routes = [];
  
  // Intentar listar rutas si es posible
  try {
    app._router.stack.forEach(function(r){
      if (r.route && r.route.path){
        routes.push({
          path: r.route.path,
          methods: Object.keys(r.route.methods)
        });
      }
    });
  } catch (error) {
    console.log('No se pudieron listar rutas automáticamente');
  }
  
  // Rutas conocidas manualmente
  const knownRoutes = [
    { path: '/', methods: ['GET'] },
    { path: '/health', methods: ['GET'] },
    { path: '/test', methods: ['GET'] },
    { path: '/routes', methods: ['GET'] },
    { path: '/auth/login', methods: ['POST'] },
    { path: '/auth/registro', methods: ['POST'] },
    { path: '/busqueda/articulos', methods: ['GET'] },
    { path: '/documento/:id', methods: ['GET'] }
  ];
  
  res.json({
    status: 'OK',
    message: 'Rutas disponibles',
    detectedRoutes: routes,
    knownRoutes: knownRoutes,
    timestamp: new Date().toISOString()
  });
});

app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  
  console.log(`\n📡 ${timestamp} - ${req.method} ${req.path}`);
  console.log('🔍 Headers importantes:', {
    origin: req.headers.origin,
    'content-type': req.headers['content-type'],
    authorization: req.headers.authorization ? '***present***' : 'none',
    'user-agent': req.headers['user-agent']?.substring(0, 50) + '...'
  });
  
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body keys:', Object.keys(req.body));
  }
  
  // Interceptar response para ver qué headers se están enviando
  const originalSend = res.send;
  res.send = function(data) {
    console.log('📤 Response headers:', {
      'access-control-allow-origin': res.get('Access-Control-Allow-Origin'),
      'access-control-allow-methods': res.get('Access-Control-Allow-Methods'),
      'access-control-allow-headers': res.get('Access-Control-Allow-Headers'),
      'status': res.statusCode
    });
    return originalSend.call(this, data);
  };
  
  next();
});

// ===============================
// RUTAS DE AUTENTICACIÓN
// ===============================

// Test auth simple sin dependencias
app.post('/auth/test', (req, res) => {
  console.log('🧪 Auth test - Body recibido:', req.body);
  
  try {
    const { email, password, nombre } = req.body;
    
    res.json({
      status: 'SUCCESS',
      message: 'Auth test funcionando',
      receivedData: { email, nombre }, // no password por seguridad
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en auth test:', error);
    res.status(500).json({
      exito: false,
      error: 'Error en auth test',
      detalles: error.message
    });
  }
});


app.post('/auth/registro', async (req, res) => {
  try {
    console.log('📝 Inicio de registro');
    console.log('📦 Body recibido:', req.body);
    
    const { email, password, nombre } = req.body;

    // Validaciones básicas sin funciones externas
    if (!email || !email.includes('@') || email.length < 5) {
      console.log('❌ Email inválido:', email);
      return res.status(400).json({ 
        exito: false, 
        error: 'Email inválido' 
      });
    }

    if (!password || password.length < 6) {
      console.log('❌ Contraseña inválida');
      return res.status(400).json({ 
        exito: false, 
        error: 'La contraseña debe tener al menos 6 caracteres' 
      });
    }

    if (!nombre || nombre.trim().length < 2) {
      console.log('❌ Nombre inválido:', nombre);
      return res.status(400).json({ 
        exito: false, 
        error: 'El nombre debe tener al menos 2 caracteres' 
      });
    }

    console.log('✅ Validaciones básicas pasadas');

    // Verificar Firebase
    if (!db) {
      console.error('❌ Firebase no inicializado');
      return res.status(500).json({
        exito: false,
        error: 'Error de configuración del servidor - Firebase'
      });
    }

    console.log('🔥 Firebase disponible');

    // Verificar usuario existente con try-catch
    let usuarioExistente;
    try {
      const usuariosRef = db.collection('usuarios');
      usuarioExistente = await usuariosRef
        .where('email', '==', email.toLowerCase())
        .get();
    } catch (firebaseError) {
      console.error('❌ Error consultando Firebase:', firebaseError);
      return res.status(500).json({
        exito: false,
        error: 'Error de base de datos'
      });
    }

    if (!usuarioExistente.empty) {
      console.log('⚠️ Usuario ya existe:', email);
      return res.status(400).json({ 
        exito: false, 
        error: 'El email ya está registrado' 
      });
    }

    console.log('✅ Usuario no existe, creando...');

    // Hash password con bcrypt básico
    let passwordHash;
    try {
      const bcrypt = require('bcryptjs');
      passwordHash = await bcrypt.hash(password, 10);
    } catch (hashError) {
      console.error('❌ Error hasheando password:', hashError);
      return res.status(500).json({
        exito: false,
        error: 'Error procesando contraseña'
      });
    }

    // Crear usuario
    const nuevoUsuario = {
      email: email.toLowerCase().trim(),
      contraseña: passwordHash,
      nombre: nombre.trim(),
      fechaRegistro: new Date().toISOString(),
      activo: true
    };

    let usuarioId;
    try {
      const usuariosRef = db.collection('usuarios');
      const docRef = await usuariosRef.add(nuevoUsuario);
      usuarioId = docRef.id;
    } catch (createError) {
      console.error('❌ Error creando usuario:', createError);
      return res.status(500).json({
        exito: false,
        error: 'Error guardando usuario'
      });
    }

    console.log('✅ Usuario guardado con ID:', usuarioId);

    // Generar token
    let token;
    try {
      const jwt = require('jsonwebtoken');
      token = jwt.sign(
        { 
          id: usuarioId,
          email: nuevoUsuario.email,
          nombre: nuevoUsuario.nombre
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    } catch (tokenError) {
      console.error('❌ Error generando token:', tokenError);
      return res.status(500).json({
        exito: false,
        error: 'Error generando token'
      });
    }

    console.log('✅ Usuario registrado exitosamente:', email);

    res.status(201).json({
      exito: true,
      mensaje: 'Usuario registrado exitosamente',
      usuario: {
        id: usuarioId,
        email: nuevoUsuario.email,
        nombre: nuevoUsuario.nombre
      },
      token
    });

  } catch (error) {
    console.error('💥 Error general en registro:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor',
      detalles: error.message
    });
  }
});


app.post('/auth/login', async (req, res) => {
  try {
    console.log('🔐 Inicio de login');
    console.log('📦 Body recibido:', req.body);
    
    const { email, password } = req.body;

    // Validaciones básicas
    if (!email || !password) {
      console.log('❌ Email o password faltante');
      return res.status(400).json({
        exito: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    if (!email.includes('@') || email.length < 5) {
      console.log('❌ Email inválido:', email);
      return res.status(400).json({ 
        exito: false, 
        error: 'Email inválido' 
      });
    }

    console.log('✅ Validaciones básicas pasadas');

    // Verificar Firebase
    if (!db) {
      console.error('❌ Firebase no inicializado');
      return res.status(500).json({
        exito: false,
        error: 'Error de configuración del servidor'
      });
    }

    console.log('🔥 Firebase disponible, buscando usuario...');

    // Buscar usuario en Firebase
    let usuarioDoc;
    try {
      const usuariosRef = db.collection('usuarios');
      const snapshot = await usuariosRef
        .where('email', '==', email.toLowerCase())
        .where('activo', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        console.log('❌ Usuario no encontrado:', email);
        return res.status(401).json({ 
          exito: false, 
          error: 'Credenciales inválidas' 
        });
      }

      usuarioDoc = snapshot.docs[0];
    } catch (firebaseError) {
      console.error('❌ Error consultando Firebase:', firebaseError);
      return res.status(500).json({
        exito: false,
        error: 'Error de base de datos'
      });
    }

    const usuario = { id: usuarioDoc.id, ...usuarioDoc.data() };
    console.log('✅ Usuario encontrado:', email);

    // Verificar contraseña
    let contraseñaValida;
    try {
      const bcrypt = require('bcryptjs');
      contraseñaValida = await bcrypt.compare(password, usuario.contraseña);
    } catch (hashError) {
      console.error('❌ Error verificando contraseña:', hashError);
      return res.status(500).json({
        exito: false,
        error: 'Error verificando credenciales'
      });
    }

    if (!contraseñaValida) {
      console.log('❌ Contraseña incorrecta para:', email);
      return res.status(401).json({ 
        exito: false, 
        error: 'Credenciales inválidas' 
      });
    }

    console.log('✅ Contraseña correcta');

    // Actualizar último login
    try {
      await usuarioDoc.ref.update({
        ultimoLogin: new Date().toISOString()
      });
    } catch (updateError) {
      console.log('⚠️ No se pudo actualizar último login:', updateError);
      // No es crítico, continuar
    }

    // Generar token
    let token;
    try {
      const jwt = require('jsonwebtoken');
      token = jwt.sign(
        {
          id: usuario.id,
          email: usuario.email,
          nombre: usuario.nombre
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
    } catch (tokenError) {
      console.error('❌ Error generando token:', tokenError);
      return res.status(500).json({
        exito: false,
        error: 'Error generando token'
      });
    }

    console.log('✅ Login exitoso para:', email);

    res.json({
      exito: true,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email
      },
      token
    });

  } catch (error) {
    console.error('💥 Error general en login:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor',
      detalles: error.message
    });
  }
});
// ===============================
// RUTAS DE BÚSQUEDA
// ===============================

app.get('/busqueda/articulos', authMiddleware, async (req, res) => {
  try {
    const { 
      q = '', 
      pagina = 1, 
      limite = 20,
      categoria,
      tipo,
      autor,
      fecha,
      entidades
    } = req.query;

    const paginaNum = parseInt(pagina);
    const limiteNum = Math.min(parseInt(limite), 100);
    const skip = (paginaNum - 1) * limiteNum;

    console.log('🔍 Búsqueda Universal Atlas Search:', { q, autor, categoria, pagina: paginaNum });

    const mongoDb = await connectToMongoDB();
    const collection = mongoDb.collection('documents');

    const pipeline = [];

    if (q && q.toString().trim()) {
      const busquedaLimpia = limpiarEntrada(q.toString());
      
      pipeline.push({
        $search: {
          index: "doc_index",
          compound: {
            should: [
              {
                text: {
                  query: busquedaLimpia,
                  path: "rel_title",
                  fuzzy: { 
                    maxEdits: 2,
                    prefixLength: 1
                  },
                  score: { boost: { value: 5.0 } }
                }
              },
              {
                text: {
                  query: busquedaLimpia,
                  path: "rel_abs",
                  fuzzy: { 
                    maxEdits: 2,
                    prefixLength: 1
                  },
                  score: { boost: { value: 3.0 } }
                }
              },
              {
                text: {
                  query: busquedaLimpia,
                  path: "category",
                  score: { boost: { value: 4.0 } }
                }
              },
              {
                text: {
                  query: busquedaLimpia,
                  path: "rel_authors",
                  fuzzy: { maxEdits: 1 },
                  score: { boost: { value: 2.0 } }
                }
              },
              {
                wildcard: {
                  query: `*${busquedaLimpia}*`,
                  path: ["rel_title", "rel_abs", "category"],
                  score: { boost: { value: 1.2 } }
                }
              }
            ],
            minimumShouldMatch: 1
          },
          highlight: {
            path: ["rel_title", "rel_abs", "category", "type", "rel_site", "rel_authors"]
          }
        }
      });

      pipeline.push({
        $addFields: {
          score: { $meta: "searchScore" },
          highlights: { $meta: "searchHighlights" }
        }
      });
    } else {
      pipeline.push({
        $search: {
          index: "doc_index",
          wildcard: {
            query: "*",
            path: "rel_title"
          }
        }
      });
      
      pipeline.push({
        $addFields: {
          score: { $meta: "searchScore" }
        }
      });
    }

    // Filtros
    const filtros = {};
    
    if (categoria) {
      filtros.category = { $regex: categoria, $options: 'i' };
    }
    if (tipo) {
      filtros.type = { $regex: tipo, $options: 'i' };
    }
    if (autor) {
      filtros.rel_authors = { $regex: autor, $options: 'i' };
    }
    if (fecha) {
      filtros.$or = [
        { rel_date: { $regex: fecha } },
        { rel_date: { $regex: `/${fecha}` } },
        { rel_date: { $regex: `${fecha}/` } }
      ];
    }

    if (Object.keys(filtros).length > 0) {
      pipeline.push({ $match: filtros });
    }

    pipeline.push({
      $facet: {
        metadata: [
          { $count: 'total' },
          { $addFields: { 
            pagina: paginaNum,
            limite: limiteNum,
            totalPaginas: { $ceil: { $divide: ['$total', limiteNum] } }
          }}
        ],
        datos: [
          { $sort: q ? { score: -1, rel_date: -1 } : { rel_date: -1 } },
          { $skip: skip },
          { $limit: limiteNum },
          { $project: {
            _id: 1,
            rel_title: 1,
            rel_abs: 1,
            rel_date: 1,
            rel_doi: 1,
            rel_link: 1,
            rel_site: 1,
            rel_num_authors: 1,
            rel_authors: { $slice: ['$rel_authors', 10] },
            version: 1,
            license: 1,
            category: 1,
            type: 1,
            entities: 1,
            jobId: 1,
            content: 1,
            score: 1,
            highlights: 1,
            author_name: { 
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ['$rel_authors', []] } }, 0] },
                then: { $arrayElemAt: ['$rel_authors', 0] },
                else: 'Autor desconocido'
              }
            },
            resumen: { 
              $cond: {
                if: { $ne: ['$rel_abs', ''] },
                then: { $substr: ['$rel_abs', 0, 300] },
                else: 'Sin resumen disponible'
              }
            }
          }}
        ]
      }
    });

    console.log('🔍 Pipeline Universal ejecutándose...');

    const resultados = await collection.aggregate(pipeline).toArray();
    
    if (!resultados || resultados.length === 0) {
      return res.status(200).json({
        exito: true,
        datos: [],
        total: 0,
        pagina: paginaNum,
        limite: limiteNum,
        totalPaginas: 0,
        mensaje: 'No se encontraron resultados'
      });
    }

    const metadata = resultados[0].metadata[0] || { 
      total: 0, 
      pagina: paginaNum, 
      limite: limiteNum,
      totalPaginas: 0 
    };
    
    const datos = resultados[0].datos || [];

    console.log(`✅ Búsqueda Universal Exitosa: ${datos.length}/${metadata.total} documentos`);

    res.status(200).json({
      exito: true,
      datos: datos,
      total: metadata.total,
      pagina: metadata.pagina,
      limite: metadata.limite,
      totalPaginas: metadata.totalPaginas,
      metodo: 'universal_atlas_search',
      indice: 'doc_index',
      query: q || 'todas',
      tiempoRespuesta: Date.now()
    });

  } catch (error) {
    console.error('❌ Error en búsqueda universal:', error);
    res.status(500).json({ 
      exito: false, 
      error: 'Error al realizar la búsqueda',
      detalles: error.message
    });
  }
});

// ===============================
// RUTA PARA OBTENER DOCUMENTO POR ID
// ===============================

// Ruta de test para verificar conectividad
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint accessed');
  console.log('🔍 Origin:', req.headers.origin);
  console.log('🔍 User-Agent:', req.headers['user-agent']);
  
  res.json({
    status: 'OK',
    message: 'Backend funcionando correctamente',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    environment: process.env.NODE_ENV || 'development',
    baseUrl: req.protocol + '://' + req.get('host'),
    allowedOrigins: [
      'https://biorxiv.vercel.app',
      'https://biorxiv-git-main-gabriels-projects-137ca855.vercel.app'
    ]
  });
});

// Ruta para listar todas las rutas disponibles
app.get('/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach(function(r){
    if (r.route && r.route.path){
      routes.push({
        path: r.route.path,
        methods: Object.keys(r.route.methods)
      });
    }
  });
  
  res.json({
    status: 'OK',
    message: 'Rutas disponibles',
    routes: routes,
    timestamp: new Date().toISOString()
  });
});

// ===============================
// VERIFICAR QUE LA RUTA GET /documento/:id EXISTA
// ===============================

// Agregar esta ruta si no existe
app.get('/documento/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📄 Obteniendo documento por ID:', id);

    if (!id) {
      return res.status(400).json({
        exito: false,
        error: 'ID de documento requerido'
      });
    }

    const mongoDb = await connectToMongoDB();
    const collection = mongoDb.collection('documents');

    // Buscar por ObjectId o por string
    let documento;
    
    try {
      // Intentar buscar por ObjectId
      if (ObjectId.isValid(id)) {
        documento = await collection.findOne({ _id: new ObjectId(id) });
      }
      
      // Si no se encuentra, buscar por string ID
      if (!documento) {
        documento = await collection.findOne({ _id: id });
      }
      
      // Si aún no se encuentra, buscar por jobId
      if (!documento) {
        documento = await collection.findOne({ jobId: id });
      }

    } catch (error) {
      console.error('Error buscando documento:', error);
    }

    if (!documento) {
      return res.status(404).json({
        exito: false,
        error: 'Documento no encontrado',
        mensaje: `No se encontró un documento con ID: ${id}`
      });
    }

    // Formatear el documento para que coincida con la interfaz Article
    const documentoFormateado = {
      _id: documento._id.toString(),
      rel_title: documento.rel_title || 'Sin título',
      rel_abs: documento.rel_abs || 'Sin resumen',
      rel_authors: documento.rel_authors || [],
      rel_date: documento.rel_date || '',
      rel_link: documento.rel_link || '',
      rel_doi: documento.rel_doi || '',
      category: documento.category || 'General',
      type: documento.type || 'Article',
      author_name: documento.rel_authors && documento.rel_authors.length > 0 
        ? documento.rel_authors[0] 
        : 'Autor desconocido',
      resumen: documento.rel_abs || 'Sin resumen disponible',
      entities: documento.entities || [],
      content: documento.content || '',
      jobId: documento.jobId,
      score: documento.score,
      highlights: documento.highlights
    };

    console.log('✅ Documento encontrado:', documentoFormateado.rel_title);

    res.status(200).json({
      exito: true,
      datos: documentoFormateado,
      mensaje: 'Documento obtenido exitosamente'
    });

  } catch (error) {
    console.error('❌ Error obteniendo documento:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor',
      detalles: error.message
    });
  }
});

// ===============================
// MANEJO DE ERRORES GLOBALES
// ===============================

app.use((err, req, res, next) => {
  console.error('❌ Error no manejado:', err);
  res.status(500).json({
    exito: false,
    error: 'Error interno del servidor'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    exito: false,
    error: 'Ruta no encontrada',
    ruta: req.originalUrl,
    mensaje: 'La ruta solicitada no existe en esta API'
  });
});

// ===============================
// INICIAR SERVIDOR PARA RENDER
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor BioRxiv API corriendo en puerto ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`📱 Estado: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Render URL: https://proyecto2-8dcb.onrender.com`);
});

module.exports = app;