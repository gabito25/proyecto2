import axios from 'axios';

// ✅ Configuración mejorada para Vercel
const getBaseURL = () => {
  // En producción (Vercel), usar el dominio correcto
  if (import.meta.env.PROD) {
    return 'https://biorxiv.vercel.app';
  }
  
  // En desarrollo, usar el servidor local con prefijo /api
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

// ✅ Configuración de axios con manejo de errores mejorado
export const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true // Para manejar cookies si es necesario
});

// Interceptor para manejar errores globalmente
apiClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Manejo específico para errores de autenticación
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    
    if (error.response?.status === 404) {
      console.error('Endpoint no encontrado:', error.config.url);
      // Redirigir a página de error o mostrar notificación
    }
    
    return Promise.reject(error);
  }
);