const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { MongoClient, Db, ObjectId } = require('mongodb');
const admin = require('firebase-admin');

const app = express();

// Verificar variables de entorno críticas
console.log('🔍 Verificando variables de entorno...');
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars);
  throw new Error('Variables de entorno faltantes: ' + missingVars.join(', '));
}

console.log('✅ Variables de entorno cargadas correctamente');

// Configuración de CORS para Vercel
app.use(cors({
  origin: true, // Permite todos los orígenes en Vercel
  credentials: true
}));

// Middleware de seguridad
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting simple
let requestCounts = {};

const simpleRateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutos
  const maxRequests = 100;

  if (!requestCounts[ip] || now > requestCounts[ip].resetTime) {
    requestCounts[ip] = { count: 1, resetTime: now + windowMs };
  } else {
    requestCounts[ip].count++;
  }

  if (requestCounts[ip].count > maxRequests) {
    return res.status(429).json({
      exito: false,
      error: 'Demasiadas solicitudes. Intenta de nuevo más tarde.'
    });
  }

  next();
};

app.use('/api/', simpleRateLimit);

// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Variables globales
let cachedDb = null;
let mongoClient = null;

// ===============================
// CONFIGURACIÓN DE FIREBASE
// ===============================

console.log('🔥 Inicializando Firebase...');

try {
  // Verificar si Firebase ya está inicializado
  if (!admin.apps.length) {
    const firebaseConfig = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    admin.initializeApp({
      credential: admin.credential.cert(firebaseConfig)
    });
  }

  console.log('✅ Firebase inicializado exitosamente');
} catch (error) {
  console.error('❌ Error inicializando Firebase:', error);
  throw error;
}

// ===============================
// SERVICIOS DE FIREBASE
// ===============================

class FirebaseService {
  static async createUser(nombre, email, password) {
    try {
      console.log('🔥 Creando usuario en Firebase:', email);

      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: nombre,
        emailVerified: false
      });

      console.log('✅ Usuario creado en Firebase:', userRecord.uid);

      return {
        success: true,
        uid: userRecord.uid,
        email: userRecord.email,
        nombre: userRecord.displayName
      };

    } catch (error) {
      console.error('❌ Error creando usuario en Firebase:', error);
      
      let errorMessage = 'Error al crear usuario';
      if (error.code === 'auth/email-already-exists') {
        errorMessage = 'El email ya está registrado';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email inválido';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'La contraseña es muy débil';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  static async verifyUser(email) {
    try {
      console.log('🔍 Verificando usuario en Firebase:', email);

      const userRecord = await admin.auth().getUserByEmail(email);

      return {
        success: true,
        uid: userRecord.uid,
        email: userRecord.email,
        nombre: userRecord.displayName || 'Usuario'
      };

    } catch (error) {
      console.error('❌ Error verificando usuario:', error);
      
      return {
        success: false,
        error: 'Usuario no encontrado'
      };
    }
  }

  static async deleteUser(uid) {
    try {
      await admin.auth().deleteUser(uid);
      return { success: true };
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      return { success: false, error: 'Error al eliminar usuario' };
    }
  }
}

// ===============================
// CONEXIÓN A MONGODB
// ===============================

async function connectToMongoDB() {
  if (cachedDb) {
    return cachedDb;
  }

  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI no está definida en las variables de entorno');
    }

    console.log('🔗 Conectando a MongoDB Atlas...');
    
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    
    const db = mongoClient.db('bioRxivDB');
    cachedDb = db;
    
    console.log('✅ Conectado a MongoDB Atlas - bioRxivDB');
    
    // Verificar documentos disponibles
    const collection = db.collection('documents');
    const count = await collection.countDocuments();
    console.log(`📊 Documentos disponibles: ${count}`);
    
    return db;
    
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    throw error;
  }
}

// ===============================
// MIDDLEWARE DE AUTENTICACIÓN
// ===============================

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        exito: false,
        error: 'Token de autorización requerido'
      });
    }

    const token = authHeader.slice(7);

    if (!token) {
      return res.status(401).json({
        exito: false,
        error: 'Token de autorización requerido'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    console.error('❌ Error en authMiddleware:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        exito: false,
        error: 'Token inválido'
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        exito: false,
        error: 'Token expirado'
      });
    }

    return res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
};

// ===============================
// RUTAS DE PRUEBA
// ===============================

app.get('/api/test/server', (req, res) => {
  res.json({
    exito: true,
    mensaje: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test/atlas-search', async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('documents');
    
    // Test básico de Atlas Search
    const pipeline = [
      {
        $search: {
          index: "doc_index",
          wildcard: {
            query: "*",
            path: "rel_title"
          }
        }
      },
      { $limit: 1 }
    ];

    const resultado = await collection.aggregate(pipeline).toArray();
    
    res.json({
      exito: true,
      mensaje: '✅ Atlas Search funcionando correctamente',
      tests: {
        wildcard_search: {
          funciona: true,
          resultados: resultado.length,
          muestra: resultado[0] || null
        }
      },
      configuracion: {
        indice: "doc_index",
        base_datos: "bioRxivDB",
        coleccion: "documents"
      }
    });

  } catch (error) {
    console.error('❌ Error en test de Atlas Search:', error);
    res.status(500).json({
      exito: false,
      error: 'Error en Atlas Search',
      detalles: error.message
    });
  }
});

// ===============================
// RUTAS DE AUTENTICACIÓN
// ===============================

app.post('/api/auth/registro', async (req, res) => {
  try {
    const { nombre, email, password } = req.body;

    console.log('📝 Solicitud de registro:', { nombre, email });

    // Validaciones
    if (!nombre || !email || !password) {
      return res.status(400).json({
        exito: false,
        error: 'Todos los campos son requeridos'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        exito: false,
        error: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Crear usuario en Firebase
    const result = await FirebaseService.createUser(nombre, email, password);

    if (!result.success) {
      return res.status(400).json({
        exito: false,
        error: result.error
      });
    }

    console.log('✅ Usuario registrado exitosamente:', email);

    res.status(201).json({
      exito: true,
      mensaje: 'Usuario registrado exitosamente',
      usuario: {
        id: result.uid,
        nombre: result.nombre,
        email: result.email
      }
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
    const { email, password } = req.body;

    console.log('🔐 Solicitud de login:', { email });

    // Validaciones
    if (!email || !password) {
      return res.status(400).json({
        exito: false,
        error: 'Email y contraseña son requeridos'
      });
    }

    // Verificar usuario en Firebase
    const result = await FirebaseService.verifyUser(email);

    if (!result.success) {
      return res.status(401).json({
        exito: false,
        error: 'Credenciales inválidas'
      });
    }

    // Generar JWT
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET no está configurado');
    }

    const payload = {
      uid: result.uid,
      email: result.email,
      nombre: result.nombre
    };

    const options = {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    };

    const token = jwt.sign(payload, jwtSecret, options);

    console.log('✅ Login exitoso para:', email);

    res.json({
      exito: true,
      usuario: {
        id: result.uid,
        nombre: result.nombre,
        email: result.email
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
    console.log(`🚪 Logout exitoso para usuario: ${req.user.uid}`);
    
    res.json({
      exito: true,
      mensaje: 'Sesión cerrada exitosamente'
    });

  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

// ===============================
// RUTAS DE USUARIO
// ===============================

app.get('/api/usuario/perfil', authMiddleware, async (req, res) => {
  try {
    const result = await FirebaseService.verifyUser(req.user.email);

    if (!result.success) {
      return res.status(404).json({
        exito: false,
        error: 'Usuario no encontrado'
      });
    }

    res.json({
      exito: true,
      datos: {
        id: result.uid,
        nombre: result.nombre,
        email: result.email
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

app.get('/api/usuario/historial', authMiddleware, async (req, res) => {
  try {
    // Implementar historial de búsquedas si es necesario
    res.json({
      exito: true,
      datos: [],
      mensaje: 'Historial no implementado aún'
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

// ===============================
// RUTAS DE BÚSQUEDA
// ===============================

app.get('/api/busqueda/articulos', authMiddleware, async (req, res) => {
  try {
    const { q, autor, desde, hasta, pagina = 1, limite = 10 } = req.query;
    
    console.log('🔍 Búsqueda Atlas Search:', { q, autor, desde, hasta, pagina, limite });

    const db = await connectToMongoDB();
    const collection = db.collection('documents');

    // PIPELINE DE ATLAS SEARCH
    const pipeline = [];

    const searchStage = {
      index: "doc_index",
      compound: {
        should: []
      },
      highlight: {
        path: ["rel_title", "rel_abs", "category", "type", "rel_site"]
      }
    };

    if (q && q.toString().trim()) {
      const searchTerm = q.toString().trim();
      
      // Búsqueda por separado en cada campo (OR lógico)
      searchStage.compound.should.push(
        // Búsqueda en título (prioridad máxima)
        {
          text: {
            query: searchTerm,
            path: "rel_title",
            fuzzy: { maxEdits: 2 },
            score: { boost: { value: 3.0 } }
          }
        },
        // Búsqueda en abstract (prioridad alta)
        {
          text: {
            query: searchTerm,
            path: "rel_abs",
            fuzzy: { maxEdits: 2 },
            score: { boost: { value: 2.5 } }
          }
        },
        // Búsqueda en categoría
        {
          text: {
            query: searchTerm,
            path: "category",
            fuzzy: { maxEdits: 1 },
            score: { boost: { value: 2.0 } }
          }
        },
        // Búsqueda en tipo de publicación
        {
          text: {
            query: searchTerm,
            path: "type",
            score: { boost: { value: 1.8 } }
          }
        },
        // Búsqueda en sitio
        {
          text: {
            query: searchTerm,
            path: "rel_site",
            score: { boost: { value: 1.5 } }
          }
        },
        // Búsqueda en autores
        {
          text: {
            query: searchTerm,
            path: "rel_authors",
            fuzzy: { maxEdits: 1 },
            score: { boost: { value: 1.7 } }
          }
        },
        // Búsqueda en DOI
        {
          text: {
            query: searchTerm,
            path: "rel_doi",
            score: { boost: { value: 1.0 } }
          }
        }
      );
      
      searchStage.compound.minimumShouldMatch = 1;
      
    } else {
      // Si no hay término de búsqueda, mostrar documentos que tengan título
      searchStage.compound.should.push({
        exists: {
          path: "rel_title"
        }
      });
      searchStage.compound.minimumShouldMatch = 1;
    }

    // Filtro por autor
    if (autor && autor.toString().trim()) {
      if (!searchStage.compound.must) {
        searchStage.compound.must = [];
      }
      searchStage.compound.must.push({
        text: {
          query: autor.toString().trim(),
          path: "rel_authors"
        }
      });
    }

    pipeline.push({ $search: searchStage });

    // Agregar metadatos de score
    pipeline.push({
      $addFields: {
        score: { $meta: "searchScore" },
        highlights: { $meta: "searchHighlights" }
      }
    });

    // Paginación
    const skip = (parseInt(pagina) - 1) * parseInt(limite);
    const limitValue = Math.min(parseInt(limite), 50);

    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitValue });

    console.log('🔍 Pipeline Atlas Search:', JSON.stringify(pipeline, null, 2));

    // Ejecutar búsqueda
    const resultados = await collection.aggregate(pipeline).toArray();

    // Contar total de resultados
    const countPipeline = [{ $search: searchStage }, { $count: "total" }];
    const conteoResultados = await collection.aggregate(countPipeline).toArray();
    const total = conteoResultados.length > 0 ? conteoResultados[0].total : 0;

    console.log(`📊 Atlas Search: ${total} documentos encontrados, mostrando ${resultados.length}`);

    // Formatear resultados
    const resultadosFormateados = resultados.map((doc) => ({
      _id: doc._id,
      rel_title: doc.rel_title || `Documento ${doc.jobId}` || 'Sin título',
      rel_abs: doc.rel_abs || 'Sin resumen disponible',
      author_name: (doc.rel_authors && doc.rel_authors.length > 0) 
        ? (Array.isArray(doc.rel_authors[0]) ? doc.rel_authors[0].join(', ') : doc.rel_authors[0])
        : 'Autor desconocido',
      author_inst: '',
      category: doc.category || 'general',
      type: doc.type || 'research',
      rel_date: doc.rel_date || new Date().toISOString(),
      rel_doi: doc.rel_doi || '',
      rel_link: doc.rel_link || '',
      rel_site: doc.rel_site || '',
      rel_num_authors: doc.rel_num_authors || 0,
      entities: doc.entities || [],
      jobId: doc.jobId || '',
      score: doc.score || 0,
      highlights: doc.highlights || []
    }));

    res.json({
      exito: true,
      datos: resultadosFormateados,
      total,
      pagina: parseInt(pagina),
      limite: limitValue,
      totalPaginas: Math.ceil(total / limitValue),
      tiempoRespuesta: Date.now(),
      metodo: 'atlas_search',
      indice: 'doc_index'
    });

  } catch (error) {
    console.error('❌ Error en Atlas Search:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor',
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

    const db = await connectToMongoDB();
    const collection = db.collection('documents');
    
    // Buscar documento por _id (ObjectId)
    let documento;
    try {
      documento = await collection.findOne({ _id: new ObjectId(id) });
    } catch (objectIdError) {
      // Si no es un ObjectId válido, buscar por otros campos
      console.log('🔍 ID no es ObjectId válido, buscando por otros campos...');
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
      score: 1.0
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
// RUTAS DE ESTADÍSTICAS
// ===============================

app.get('/api/estadisticas/generales', authMiddleware, async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('documents');
    
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

// ===============================
// RUTAS ADICIONALES DE BÚSQUEDA
// ===============================

// Búsqueda por ID específico
app.get('/api/busqueda/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const db = await connectToMongoDB();
    const collection = db.collection('documents');
    
    let documento;
    try {
      documento = await collection.findOne({ _id: new ObjectId(id) });
    } catch (objectIdError) {
      documento = await collection.findOne({ jobId: id });
    }
    
    if (!documento) {
      return res.status(404).json({
        exito: false,
        error: 'Documento no encontrado'
      });
    }
    
    res.json({
      exito: true,
      datos: documento
    });
    
  } catch (error) {
    console.error('Error en búsqueda por ID:', error);
    res.status(500).json({
      exito: false,
      error: 'Error interno del servidor'
    });
  }
});

// ===============================
// RUTAS DE CATEGORÍAS Y FILTROS
// ===============================

app.get('/api/categorias', authMiddleware, async (req, res) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('documents');
    
    const categorias = await collection.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
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
    const db = await connectToMongoDB();
    const collection = db.collection('documents');
    
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
// RUTAS DE SALUD Y MONITOREO
// ===============================

app.get('/api/health', (req, res) => {
  res.json({
    exito: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: 'production'
  });
});

app.get('/api/version', (req, res) => {
  res.json({
    exito: true,
    version: '1.0.0',
    api: 'BioRxiv API',
    timestamp: new Date().toISOString()
  });
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
    ruta: req.originalUrl
  });
});

// Para Vercel, exportar la app directamente
module.exports = app;