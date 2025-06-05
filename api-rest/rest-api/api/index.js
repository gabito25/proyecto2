require('dotenv').config({ path: '.env.local' });

module.exports = (req, res) => {
  res.status(200).json({
    mensaje: "API bioRxiv Search V2",
    version: "1.0.0",
    estado: "Operativo",
    endpoints: {
      auth: {
        registro: "POST /api/auth/registro",
        login: "POST /api/auth/login",
        logout: "POST /api/auth/logout"
      },
      busqueda: {
        articulos: "GET /api/busqueda/articulos",
        articulo: "GET /api/busqueda/articulos/:id"
      },
      usuario: {
        perfil: "GET /api/usuario/perfil"
      }
    },
    //documentacion: "https://github.com/tu-usuario/biorxiv-api"
  });
};