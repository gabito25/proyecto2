const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
let authToken = '';
let testUserEmail = `test${Date.now()}@example.com`;

// Colores para la consola
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m'
};

console.log(`${colors.cyan}🧪 INICIANDO PRUEBAS DE API BIORXIV${colors.reset}\n`);

// Función para mostrar resultados
function showResult(testName, success, message, error = null) {
  const icon = success ? '✅' : '❌';
  const color = success ? colors.green : colors.red;
  console.log(`${color}${icon} ${testName}${colors.reset}`);
  if (message) {
    console.log(`   ${message}`);
  }
  if (error && !success) {
    console.log(`   Error: ${error.response?.data?.error || error.message}`);
    if (error.response?.status) {
      console.log(`   Status: ${error.response.status}`);
    }
  }
}

// Configurar axios
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// PRUEBAS
async function runTests() {
  console.log(`${colors.yellow}📋 PRUEBAS DE AUTENTICACIÓN${colors.reset}\n`);

  // Test 1: Registro
  try {
    console.log('1.1 Registro de nuevo usuario');
    const registerResponse = await api.post('/api/auth/registro', {
      email: testUserEmail,
      password: 'password123',
      nombre: 'Test User'
    });

    if (registerResponse.data.exito) {
      authToken = registerResponse.data.token;
      showResult('Registro exitoso', true, `Usuario creado: ${registerResponse.data.usuario.email}`);
    }
  } catch (error) {
    showResult('Registro exitoso', false, null, error);
  }

  // Test 2: Registro duplicado
  try {
    console.log('\n1.2 Registro con email duplicado');
    await api.post('/api/auth/registro', {
      email: 'test@test.com',
      password: '123456',
      nombre: 'Test Duplicado'
    });
    showResult('Prevención de duplicados', false, 'Se permitió registro duplicado');
  } catch (error) {
    if (error.response?.status === 400) {
      showResult('Prevención de duplicados', true, 'Email duplicado rechazado correctamente');
    } else {
      showResult('Prevención de duplicados', false, null, error);
    }
  }

  // Test 3: Login
  try {
    console.log('\n1.3 Login con credenciales válidas');
        const loginResponse = await api.post('/api/auth/login', {
        email: testUserEmail,  // Cambiar de test@test.com
        password: 'password123'
        });

    if (loginResponse.data.exito) {
      authToken = loginResponse.data.token;
      showResult('Login exitoso', true, `Token recibido para: ${loginResponse.data.usuario.email}`);
    } else {
      showResult('Login exitoso', false, 'Login falló', loginResponse.data);
    }
  } catch (error) {
    showResult('Login exitoso', false, null, error);
  }

  // Test 4: Login con credenciales incorrectas
  try {
    console.log('\n1.4 Login con credenciales incorrectas');
    await api.post('/api/auth/login', {
      email: 'test@test.com',
      password: 'wrongpassword'
    });
    showResult('Rechazo credenciales incorrectas', false, 'Se aceptaron credenciales incorrectas');
  } catch (error) {
    if (error.response?.status === 401) {
      showResult('Rechazo credenciales incorrectas', true, 'Credenciales incorrectas rechazadas');
    } else {
      showResult('Rechazo credenciales incorrectas', false, null, error);
    }
  }

  console.log(`\n${colors.yellow}📋 PRUEBAS DE BÚSQUEDA${colors.reset}\n`);

  // Test 5: Búsqueda sin autenticación
  try {
    console.log('2.1 Búsqueda sin autenticación');
    await api.get('/api/busqueda/articulos?q=covid');
    showResult('Protección de búsqueda', false, 'Se permitió búsqueda sin auth');
  } catch (error) {
    if (error.response?.status === 401) {
      showResult('Protección de búsqueda', true, 'Búsqueda sin auth rechazada');
    } else {
      showResult('Protección de búsqueda', false, null, error);
    }
  }

  // Test 6: Búsqueda autenticada
  try {
    console.log('\n2.2 Búsqueda autenticada');
    const searchResponse = await api.get('/api/busqueda/articulos?q=covid', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (searchResponse.data.exito) {
      showResult('Búsqueda básica', true, 
        `Total: ${searchResponse.data.datos.total}, Resultados: ${searchResponse.data.datos.resultados.length}`);
    } else {
      showResult('Búsqueda básica', false, 'Búsqueda falló', searchResponse.data);
    }
  } catch (error) {
    showResult('Búsqueda básica', false, null, error);
  }

  // Test 7: Perfil
  console.log(`\n${colors.yellow}📋 PRUEBAS DE PERFIL${colors.reset}\n`);
  
  try {
    console.log('3.1 Obtener perfil de usuario');
    const profileResponse = await api.get('/api/usuario/perfil', {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (profileResponse.data.exito) {
      showResult('Obtener perfil', true, `Email: ${profileResponse.data.datos.email}`);
    } else {
      showResult('Obtener perfil', false, 'No se pudo obtener perfil', profileResponse.data);
    }
  } catch (error) {
    showResult('Obtener perfil', false, null, error);
  }

  // Test 8: Logout
  try {
    console.log('\n3.2 Logout');
    const logoutResponse = await api.post('/api/auth/logout', {}, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (logoutResponse.data.exito) {
      showResult('Logout', true, 'Sesión cerrada correctamente');
    } else {
      showResult('Logout', false, 'Logout falló', logoutResponse.data);
    }
  } catch (error) {
    showResult('Logout', false, null, error);
  }

  // Test 9: Verificar token
  console.log(`\n${colors.yellow}📋 PRUEBA DE TOKEN${colors.reset}\n`);
  console.log(`Token actual: ${authToken ? authToken.substring(0, 50) + '...' : 'NO HAY TOKEN'}`);

  console.log(`\n${colors.cyan}✅ PRUEBAS COMPLETADAS${colors.reset}`);
}

// Ejecutar pruebas
runTests().catch(console.error);