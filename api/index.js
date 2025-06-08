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
// MIDDLEWARE DE EXPRESS
// ===============================

// Configuración de CORS corregida para Vercel
const allowedOrigins = [
  'https://biorxiv.vercel.app',
  'https://biorxiv-git-main-gabriels-projects-137ca855.vercel.app',
  'https://biorxiv-hsggfxfqr-gabriels-projects-137ca855.vercel.app',
  
  // URLs del backend para testing
  'https://proyecto2-flame.vercel.app',
  'https://proyecto2-git-main-gabriels-projects-137ca855.vercel.app',
  
  // Desarrollo local
  'http://localhost:5173',
  'http://localhost:3000'
];

console.log('🌐 CORS Origins permitidos:', allowedOrigins);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: function (origin, callback) {
    console.log('🔍 CORS check - Origin:', origin);
    
    if (!origin) {
      console.log('✅ CORS permitido - Sin origin');
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || 
        process.env.NODE_ENV !== 'production') {
      console.log('✅ CORS permitido para:', origin);
      callback(null, true);
    } else {
      console.log('⚠️ CORS bloqueado para:', origin);
      callback(null, true); // Temporal - permitir todo para debug
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
  maxAge: 86400
}));

// Manejar OPTIONS explícitamente
app.options('*', (req, res) => {
  console.log('📋 OPTIONS para:', req.path, 'desde:', req.headers.origin);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS,PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept,Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Middleware de logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'N/A'}`);
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
// RUTAS DE AUTENTICACIÓN
// ===============================

app.post('/auth/registro', async (req, res) => {
  try {
    if (rateLimitMiddleware(req, 10, 3600000)) {
      return res.status(429).json({ 
        exito: false, 
        error: 'Demasiadas solicitudes. Intenta más tarde.' 
      });
    }

    const { email, password, nombre } = req.body;

    console.log('📝 Solicitud de registro:', { nombre, email });

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
    console.error('❌ Error en registro:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    if (rateLimitMiddleware(req, 20, 900000)) {
      return res.status(429).json({ 
        exito: false, 
        error: 'Demasiados intentos. Intenta más tarde.' 
      });
    }

    const { email, password } = req.body;

    console.log('🔐 Solicitud de login:', { email });

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
    console.error('❌ Error en login:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
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