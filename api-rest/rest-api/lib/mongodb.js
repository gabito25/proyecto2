require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const opciones = {
  useUnifiedTopology: true,
  useNewUrlParser: true,
};

let cliente;
let promesaCliente;

if (!process.env.MONGODB_URI) {
  throw new Error('Por favor añade tu URI de MongoDB a .env.local');
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    cliente = new MongoClient(uri, opciones);
    global._mongoClientPromise = cliente.connect();
  }
  promesaCliente = global._mongoClientPromise;
} else {
  cliente = new MongoClient(uri, opciones);
  promesaCliente = cliente.connect();
}

module.exports = promesaCliente;