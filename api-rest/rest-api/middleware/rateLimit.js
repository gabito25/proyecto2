require('dotenv').config({ path: '.env.local' });

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

module.exports = { rateLimitMiddleware };