// Crea test-mongo.js
require('dotenv').config({ path: '../.env.local' });

async function testMongo() {
  console.log('URI:', process.env.MONGODB_URI ? 'Configurada' : 'NO CONFIGURADA');
  console.log(process.env.MONGODB_URI);
  
  try {
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    
    console.log('Conectando a MongoDB...');
    await client.connect();
    console.log('✅ Conectado!');
    
    const db = client.db('searchdb');
    const collections = await db.listCollections().toArray();
    console.log('Colecciones:', collections.map(c => c.name));
    
    const count = await db.collection('documents').countDocuments();
    console.log('Documentos en collection:', count);
    
    await client.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testMongo();