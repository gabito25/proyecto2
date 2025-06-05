require('dotenv').config({ path: '.env.local' });

module.exports = (req, res) => {
  const hasProjectId = !!process.env.FIREBASE_PROJECT_ID;
  const hasClientEmail = !!process.env.FIREBASE_CLIENT_EMAIL;
  const hasPrivateKey = !!process.env.FIREBASE_PRIVATE_KEY;
  const hasMongoDB = !!process.env.MONGODB_URI;
  const hasJWT = !!process.env.JWT_SECRET;
  
  res.status(200).json({
    mensaje: "Test de configuración",
    timestamp: new Date().toISOString(),
    configuracion: {
      firebase: {
        projectId: hasProjectId ? "✓ Configurado" : "✗ Falta",
        clientEmail: hasClientEmail ? "✓ Configurado" : "✗ Falta",
        privateKey: hasPrivateKey ? "✓ Configurado" : "✗ Falta",
        projectIdValue: process.env.FIREBASE_PROJECT_ID || "NO DEFINIDO"
      },
      mongodb: {
        uri: hasMongoDB ? "✓ Configurado" : "✗ Falta"
      },
      jwt: {
        secret: hasJWT ? "✓ Configurado" : "✗ Falta"
      }
    }
  });
};