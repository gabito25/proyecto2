require('dotenv').config();

const serverless = require("serverless-http");
const app = require("../index.js");
module.exports = serverless(app);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const { MongoClient, Db, ObjectId } = require('mongodb');
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

    // Configuración optimizada para MongoDB Atlas
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
  // Verificar si Firebase ya está inicializado
  if (!admin.apps.length) {
    // Opción 1: Usar JSON completo (RECOMENDADO)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
    // Opción 2: Usar variables separadas (FALLBACK)
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

  // Obtener instancia de Firestore
  db = admin.firestore();
  console.log('✅ Firebase y Firestore inicializados exitosamente');

} catch (error) {
  console.error('❌ Error inicializando Firebase:', error);
  throw error;
}

// ===============================
// MIDDLEWARE DE EXPRESS
// ===============================

// Middleware de parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuración de CORS para Vercel
app.use(cors({
  origin: true, // Permite todos los orígenes en Vercel
  credentials: true
}));

// Middleware de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting usando tu función
const simpleRateLimit = (req, res, next) => {
  if (rateLimitMiddleware(req, 100, 15 * 60 * 1000)) {
    return res.status(429).json({
      exito: false,
      error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    });
  }
  next();
};

app.use(simpleRateLimit);

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
// RUTA DE SALUD
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
// RUTAS DE AUTENTICACIÓN (usando tu estructura Firestore)
// ===============================

app.post('/api/auth/registro', async (req, res) => {
  try {
    // Rate limiting para registro
    if (rateLimitMiddleware(req, 10, 3600000)) {
      return res.status(429).json({ 
        exito: false, 
        error: 'Demasiadas solicitudes. Intenta más tarde.' 
      });
    }

    const { email, password, nombre } = req.body;

    console.log('📝 Solicitud de registro:', { nombre, email });

    // Validaciones usando tus funciones
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

    // Verificar si el usuario ya existe
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

    // Crear nuevo usuario
    const nuevoUsuario = {
      email: email.toLowerCase(),
      contraseña: await hashearContraseña(password),
      nombre: limpiarEntrada(nombre),
      fechaRegistro: new Date().toISOString(),
      activo: true
    };

    const docRef = await usuariosRef.add(nuevoUsuario);
    const usuarioId = docRef.id;

    // Generar token
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

app.post('/api/auth/login', async (req, res) => {
  try {
    // Rate limiting para login
    if (rateLimitMiddleware(req, 20, 900000)) {
      return res.status(429).json({ 
        exito: false, 
        error: 'Demasiados intentos. Intenta más tarde.' 
      });
    }

    const { email, password } = req.body;

    console.log('🔐 Solicitud de login:', { email });

    // Validaciones
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

    // Buscar usuario en Firestore
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

    // Verificar contraseña
    const contraseñaValida = await compararContraseña(password, usuario.contraseña);
    if (!contraseñaValida) {
      return res.status(401).json({ 
        exito: false, 
        error: 'Credenciales inválidas' 
      });
    }

    // Actualizar último login
    await doc.ref.update({
      ultimoLogin: new Date().toISOString()
    });

    // Generar token
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

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    console.log('🚪 Logout para usuario:', req.user.email);

    res.json({
      exito: true,
      mensaje: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error en logout:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

// ===============================
// RUTAS DE USUARIO (usando Firestore)
// ===============================

app.get('/api/usuario/perfil', authMiddleware, async (req, res) => {
  try {
    const usuarioDoc = await db.collection('usuarios')
      .doc(req.user.id)
      .get();

    if (!usuarioDoc.exists) {
      return res.status(404).json({ 
        exito: false, 
        error: 'Usuario no encontrado' 
      });
    }

    const usuario = usuarioDoc.data();

    res.json({
      exito: true,
      datos: {
        id: req.user.id,
        email: usuario.email,
        nombre: usuario.nombre,
        fechaRegistro: usuario.fechaRegistro,
        ultimoLogin: usuario.ultimoLogin
      }
    });

  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

// ===============================
// RUTAS DE BÚSQUEDA (tu código Atlas Search avanzado)
// ===============================

app.get('/api/busqueda/articulos', authMiddleware, async (req, res) => {
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

    // ✅ BÚSQUEDA UNIVERSAL EN TODOS LOS CAMPOS REALES
    if (q && q.toString().trim()) {
      const busquedaLimpia = limpiarEntrada(q.toString());
      
      pipeline.push({
        $search: {
          index: "doc_index",
          compound: {
            should: [
              // 🎯 BÚSQUEDA EN TÍTULO (Prioridad máxima)
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
              // 🎯 BÚSQUEDA EN ABSTRACT (Prioridad alta)
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
              // 🎯 BÚSQUEDA EN CATEGORÍA (Exacta)
              {
                text: {
                  query: busquedaLimpia,
                  path: "category",
                  score: { boost: { value: 4.0 } }
                }
              },
              // 🎯 BÚSQUEDA EN TIPO DE PUBLICACIÓN
              {
                text: {
                  query: busquedaLimpia,
                  path: "type",
                  score: { boost: { value: 2.5 } }
                }
              },
              // 🎯 BÚSQUEDA EN SITIO (medRxiv, bioRxiv, etc.)
              {
                text: {
                  query: busquedaLimpia,
                  path: "rel_site",
                  score: { boost: { value: 2.0 } }
                }
              },
              // 🎯 BÚSQUEDA EN AUTORES (Array)
              {
                text: {
                  query: busquedaLimpia,
                  path: "rel_authors",
                  fuzzy: { maxEdits: 1 },
                  score: { boost: { value: 2.0 } }
                }
              },
              // 🎯 BÚSQUEDA EN DOI
              {
                text: {
                  query: busquedaLimpia,
                  path: "rel_doi",
                  score: { boost: { value: 1.5 } }
                }
              },
              // 🎯 BÚSQUEDA EN JOBID
              {
                text: {
                  query: busquedaLimpia,
                  path: "jobId",
                  score: { boost: { value: 1.0 } }
                }
              },
              // 🎯 BÚSQUEDA WILDCARD AMPLIA
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
          // ✅ HIGHLIGHTING EN CAMPOS REALES
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
      // ✅ SIN BÚSQUEDA - MOSTRAR DOCUMENTOS RECIENTES
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

    // ✅ FILTROS AVANZADOS PARA TUS CAMPOS REALES
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
      // Buscar por año en formato dd/mm/yyyy
      filtros.$or = [
        { rel_date: { $regex: fecha } },
        { rel_date: { $regex: `/${fecha}` } },
        { rel_date: { $regex: `${fecha}/` } }
      ];
    }
    if (entidades) {
      const entidadesList = entidades.split(',').map(e => e.trim());
      filtros.entities = { $in: entidadesList };
    }

    if (Object.keys(filtros).length > 0) {
      pipeline.push({ $match: filtros });
    }

    // ✅ AGGREGATION CON FACETAS COMPLETAS
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
            rel_authors: { $slice: ['$rel_authors', 10] }, // Primeros 10 autores
            version: 1,
            license: 1,
            category: 1,
            type: 1,
            entities: 1,
            jobId: 1,
            content: 1,
            score: 1,
            highlights: 1,
            // ✅ CAMPOS CALCULADOS PARA COMPATIBILIDAD CON FRONTEND
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
        ],
        // ✅ FACETAS COMPLETAS
        facetas: [
          { $sample: { size: 2000 } }, // Muestra para facetas
          { $group: {
            _id: null,
            categorias: { $addToSet: '$category' },
            tipos: { $addToSet: '$type' },
            sitios: { $addToSet: '$rel_site' },
            licencias: { $addToSet: '$license' },
            años: { 
              $addToSet: { 
                $cond: {
                  if: { $ne: ['$rel_date', ''] },
                  then: { $substr: ['$rel_date', 6, 4] }, // Formato dd/mm/yyyy
                  else: null
                }
              }
            },
            autoresFlat: { $push: '$rel_authors' },
            entidadesFlat: { $push: '$entities' },
            totalDocs: { $sum: 1 }
          }},
          { $project: {
            categorias: { 
              $filter: { 
                input: '$categorias', 
                cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] }
              }
            },
            tipos: { 
              $filter: { 
                input: '$tipos', 
                cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] }
              }
            },
            sitios: { 
              $filter: { 
                input: '$sitios', 
                cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] }
              }
            },
            autores: { 
              $slice: [{
                $filter: { 
                  input: {
                    $reduce: {
                      input: '$autoresFlat',
                      initialValue: [],
                      in: { $setUnion: ['$$value', '$$this'] }
                    }
                  },
                  cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] }
                }
              }, 50]
            },
            años: { 
              $filter: { 
                input: '$años', 
                cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] }
              }
            },
            entidades: {
              $slice: [{
                $filter: {
                  input: {
                    $reduce: {
                      input: '$entidadesFlat',
                      initialValue: [],
                      in: { $setUnion: ['$$value', '$$this'] }
                    }
                  },
                  cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] }
                }
              }, 50]
            },
            totalDocs: 1
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
        facetas: {},
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
    const facetasRaw = resultados[0].facetas[0] || {};

    // ✅ PROCESAMIENTO DE FACETAS
    const facetas = {
      categorias: (facetasRaw.categorias || [])
        .filter(c => c && c.trim())
        .sort()
        .slice(0, 25),
      tipos: (facetasRaw.tipos || [])
        .filter(t => t && t.trim())
        .sort()
        .slice(0, 15),
      sitios: (facetasRaw.sitios || [])
        .filter(s => s && s.trim())
        .sort()
        .slice(0, 10),
      autores: (facetasRaw.autores || [])
        .filter(a => a && a.trim())
        .sort()
        .slice(0, 30),
      años: (facetasRaw.años || [])
        .filter(y => y && y.trim() && y.length === 4)
        .sort()
        .reverse(), // Años más recientes primero
      entidades: (facetasRaw.entidades || [])
        .filter(e => e && e.trim())
        .sort()
        .slice(0, 50),
      estadisticas: {
        totalDocumentos: facetasRaw.totalDocs || 0,
        categoriasDisponibles: (facetasRaw.categorias || []).length,
        autoresDisponibles: (facetasRaw.autores || []).length,
        sitiosDisponibles: (facetasRaw.sitios || []).length
      }
    };

    console.log(`✅ Búsqueda Universal Exitosa: ${datos.length}/${metadata.total} documentos`);

    res.status(200).json({
      exito: true,
      datos: datos,
      total: metadata.total,
      pagina: metadata.pagina,
      limite: metadata.limite,
      totalPaginas: metadata.totalPaginas,
      facetas: facetas,
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
// RUTA PARA DOCUMENTO INDIVIDUAL
// ===============================

app.get('/api/documento/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📄 Solicitando documento con ID:', id);

    if (!id) {
      return res.status(400).json({
        exito: false,
        error: 'ID de documento requerido'
      });
    }

    const mongoDb = await connectToMongoDB();
    const collection = mongoDb.collection('documents');
    
    let documento;
    
    // Intentar buscar por ObjectId válido
    if (ObjectId.isValid(id)) {
      documento = await collection.findOne({ _id: new ObjectId(id) });
    }
    
    // Si no se encuentra, buscar por otros campos
    if (!documento) {
      documento = await collection.findOne({
        $or: [
          { jobId: id },
          { _id: id }
        ]
      });
    }
    
    if (!documento) {
      console.log('❌ Documento no encontrado para ID:', id);
      return res.status(404).json({
        exito: false,
        error: 'Documento no encontrado'
      });
    }
    
    console.log('✅ Documento encontrado:', documento.jobId || documento._id);
    
    // Incrementar vistas
    await collection.updateOne(
      { _id: documento._id },
      { $inc: { vistas: 1 } }
    );
    
    // Formatear el documento para el frontend
    const documentoFormateado = {
      _id: documento._id,
      rel_title: documento.rel_title || `Documento ${documento.jobId}` || 'Sin título',
      rel_abs: documento.rel_abs || 'Sin resumen disponible',
      author_name: (documento.rel_authors && documento.rel_authors.length > 0) 
        ? (Array.isArray(documento.rel_authors[0]) ? documento.rel_authors[0].join(', ') : documento.rel_authors[0])
        : 'Autor desconocido',
      author_inst: '',
      category: documento.category || 'general',
      rel_date: documento.rel_date || new Date().toISOString(),
      rel_doi: documento.rel_doi || '',
      rel_link: documento.rel_link || '',
      rel_site: documento.rel_site || '',
      rel_num_authors: documento.rel_num_authors || 0,
      rel_authors: documento.rel_authors || [],
      entities: documento.entities || [],
      content: documento.content || '',
      jobId: documento.jobId || '',
      type: documento.type || '',
      license: documento.license || '',
      version: documento.version || '',
      score: 1.0,
      vistas: documento.vistas || 0
    };
    
    res.json({
      exito: true,
      datos: documentoFormateado
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
// RUTAS DE ESTADÍSTICAS Y FACETAS  
// ===============================

app.get('/api/estadisticas/generales', authMiddleware, async (req, res) => {
  try {
    const mongoDb = await connectToMongoDB();
    const collection = mongoDb.collection('documents');
    
    const stats = {
      totalDocumentos: await collection.countDocuments(),
      categorias: await collection.distinct('category'),
      tipos: await collection.distinct('type'),
      sitios: await collection.distinct('rel_site')
    };
    
    res.json({
      exito: true,
      datos: stats
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

app.get('/api/categorias', authMiddleware, async (req, res) => {
  try {
    const mongoDb = await connectToMongoDB();
    const collection = mongoDb.collection('documents');
    
    const categorias = await collection.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 50
      }
    ]).toArray();
    
    res.json({
      exito: true,
      datos: categorias.map(cat => ({
        nombre: cat._id || 'Sin categoría',
        cantidad: cat.count
      }))
    });
    
  } catch (error) {
    console.error('Error obteniendo categorías:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

app.get('/api/tipos', authMiddleware, async (req, res) => {
  try {
    const mongoDb = await connectToMongoDB();
    const collection = mongoDb.collection('documents');
    
    const tipos = await collection.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
    
    res.json({
      exito: true,
      datos: tipos.map(tipo => ({
        nombre: tipo._id || 'Sin tipo',
        cantidad: tipo.count
      }))
    });
    
  } catch (error) {
    console.error('Error obteniendo tipos:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

// ===============================
// RUTAS DE GESTIÓN DE USUARIOS CON FIRESTORE
// ===============================

// Configuración de usuario
app.post('/api/usuario/config', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const config = req.body;
    
    await db.collection('usuarios').doc(userId).update({
      configuracion: config,
      ultimaActualizacion: new Date().toISOString()
    });
    
    res.json({
      exito: true,
      mensaje: 'Configuración guardada exitosamente'
    });
    
  } catch (error) {
    console.error('Error guardando configuración:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al guardar configuración'
    });
  }
});

app.get('/api/usuario/config', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const usuarioDoc = await db.collection('usuarios').doc(userId).get();
    
    if (!usuarioDoc.exists) {
      return res.status(404).json({
        exito: false,
        error: 'Usuario no encontrado'
      });
    }
    
    const usuario = usuarioDoc.data();
    const config = usuario.configuracion || {
      theme: 'light',
      resultsPerPage: 10,
      notifications: true
    };
    
    res.json({
      exito: true,
      config: config
    });
    
  } catch (error) {
    console.error('Error obteniendo configuración:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener configuración'
    });
  }
});

// Historial de búsquedas
app.post('/api/usuario/search-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { query, resultsCount, filters } = req.body;
    
    const searchData = {
      query,
      resultsCount,
      filters: filters || {},
      timestamp: new Date().toISOString()
    };
    
    await db.collection('usuarios').doc(userId).collection('searchHistory').add(searchData);
    
    res.json({
      exito: true,
      mensaje: 'Búsqueda guardada en historial'
    });
    
  } catch (error) {
    console.error('Error guardando búsqueda:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al guardar búsqueda'
    });
  }
});

app.get('/api/usuario/search-history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    
    const searchHistory = await db.collection('usuarios')
      .doc(userId)
      .collection('searchHistory')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    const searches = searchHistory.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({
      exito: true,
      searches: searches
    });
    
  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener historial'
    });
  }
});

// Artículos favoritos
app.post('/api/usuario/favorites', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, abstract, authors, doi, url, category } = req.body;
    
    const articleData = {
      title,
      abstract,
      authors,
      doi,
      url,
      category,
      timestamp: new Date().toISOString()
    };
    
    await db.collection('usuarios').doc(userId).collection('favorites').add(articleData);
    
    res.json({
      exito: true,
      mensaje: 'Artículo agregado a favoritos'
    });
    
  } catch (error) {
    console.error('Error guardando favorito:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al agregar favorito'
    });
  }
});

app.get('/api/usuario/favorites', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const favorites = await db.collection('usuarios')
      .doc(userId)
      .collection('favorites')
      .orderBy('timestamp', 'desc')
      .get();
    
    const favoritesData = favorites.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({
      exito: true,
      favorites: favoritesData
    });
    
  } catch (error) {
    console.error('Error obteniendo favoritos:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener favoritos'
    });
  }
});

app.delete('/api/usuario/favorites/:favoriteId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { favoriteId } = req.params;
    
    await db.collection('usuarios')
      .doc(userId)
      .collection('favorites')
      .doc(favoriteId)
      .delete();
    
    res.json({
      exito: true,
      mensaje: 'Artículo eliminado de favoritos'
    });
    
  } catch (error) {
    console.error('Error eliminando favorito:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al eliminar favorito'
    });
  }
});

// Estadísticas de usuario
app.get('/api/usuario/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Obtener estadísticas básicas
    const [searchHistory, favorites] = await Promise.all([
      db.collection('usuarios').doc(userId).collection('searchHistory').get(),
      db.collection('usuarios').doc(userId).collection('favorites').get()
    ]);
    
    const stats = {
      totalSearches: searchHistory.size,
      totalFavorites: favorites.size,
      lastActivity: null
    };
    
    // Última actividad
    if (searchHistory.size > 0) {
      const recentSearch = searchHistory.docs[0].data();
      stats.lastActivity = recentSearch.timestamp;
    }
    
    res.json({
      exito: true,
      stats
    });
    
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      exito: false,
      error: 'Error al obtener estadísticas'
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

// Ruta catch-all para rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    exito: false,
    error: 'Ruta no encontrada',
    ruta: req.originalUrl,
    mensaje: 'La ruta solicitada no existe en esta API'
  });
});

// ===============================
// INICIALIZACIÓN DEL SERVIDOR
// ===============================

const PORT = process.env.PORT || 3000;

// Solo iniciar servidor si no estamos en Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`📡 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔍 Búsqueda: http://localhost:${PORT}/api/busqueda/articulos`);
    console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  });
}

// Para Vercel, exportar la app directamente
module.exports = app;