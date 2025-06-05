require('dotenv').config({ path: '.env.local' });

const validator = require('validator');

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

module.exports = {
  validarEmail,
  validarContraseña,
  validarNombre,
  limpiarEntrada
};