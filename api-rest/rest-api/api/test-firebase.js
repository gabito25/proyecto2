require('dotenv').config({ path: '.env.local' });

const { corsMiddleware } = require('../middleware/cors.js');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    // Test 1: Verificar variables de entorno
    const firebaseConfig = {
      projectId: !!process.env.FIREBASE_PROJECT_ID,
      clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length || 0
    };

    // Test 2: Intentar inicializar Firebase
    let firebaseTest = { initialized: false, error: null };
    try {
      const { initializeApp, getApps, cert } = require('firebase-admin/app');
      const { getFirestore } = require('firebase-admin/firestore');

      if (!getApps().length) {
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
          })
        });
      }

      const db = getFirestore();
      firebaseTest.initialized = true;

      // Test 3: Intentar conectar a Firestore
      const testCollection = db.collection('test');
      await testCollection.limit(1).get();
      firebaseTest.firestoreConnected = true;

    } catch (error) {
      firebaseTest.error = error.message;
      firebaseTest.stack = error.stack;
    }

    res.status(200).json({
      exito: true,
      timestamp: new Date().toISOString(),
      tests: {
        environmentVariables: firebaseConfig,
        firebase: firebaseTest
      }
    });

  } catch (error) {
    console.error('Error en test Firebase:', error);
    res.status(500).json({ 
      exito: false, 
      error: error.message,
      stack: error.stack
    });
  }
};