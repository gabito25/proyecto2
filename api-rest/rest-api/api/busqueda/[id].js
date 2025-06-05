require('dotenv').config({ path: '.env.local' });

const clientPromise = require('../../lib/mongodb.js');
const { corsMiddleware } = require('../../middleware/cors.js');
const { requireAuth } = require('../../middleware/auth.js');
const { ObjectId } = require('mongodb');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    await requireAuth(req);

    const { id } = req.query;

    if (!id || !ObjectId.isValid(id)) {
      return res.status(400).json({ 
        exito: false, 
        error: 'ID de artículo inválido' 
      });
    }

    const client = await clientPromise;
    const db = client.db('searchdb');
    const collection = db.collection('documents');

    const articulo = await collection.findOne({ 
      _id: new ObjectId(id) 
    });

    if (!articulo) {
      return res.status(404).json({ 
        exito: false, 
        error: 'Artículo no encontrado' 
      });
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $inc: { vistas: 1 } }
    );

    res.status(200).json({
      exito: true,
      datos: articulo
    });

  } catch (error) {
    console.error('Error al obtener artículo:', error);
    res.status(error.message.includes('Token') ? 401 : 500).json({ 
      exito: false, 
      error: error.message || 'Error al obtener el artículo' 
    });
  }
};