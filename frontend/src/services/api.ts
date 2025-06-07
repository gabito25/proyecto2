import axios from 'axios';

// ✅ DETERMINAR URL BASE SEGÚN ENTORNO
const getBaseURL = () => {
  // En producción (Vercel), usar rutas relativas
  if (import.meta.env.PROD) {
    return '';
  }
  
  // En desarrollo, usar el servidor local (CORREGIDO: puerto 3000)
  return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

// ✅ URLs ESPECÍFICAS
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/registro', 
  LOGOUT: '/api/auth/logout',
  PROFILE: '/api/usuario/perfil',
  
  // Búsqueda
  SEARCH_ARTICLES: '/api/busqueda/articulos',
  GET_DOCUMENT: (id: string) => `/api/documento/${id}`,
  
  // Estadísticas
  STATS: '/api/estadisticas/generales',
  CATEGORIES: '/api/categorias',
  TYPES: '/api/tipos',
};

// ✅ UTILIDAD PARA CONSTRUIR URLs
export const buildApiUrl = (endpoint: string): string => {
  const baseUrl = getBaseURL();
  return `${baseUrl}${endpoint}`;
};

// Crear instancia de axios con configuración base
export const apiClient = axios.create({
  baseURL: getBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar el token automáticamente
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas y errores
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Si el token es inválido, limpiar localStorage
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('usuario');
      
      // Opcional: redirigir al login
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

// ✅ FUNCIONES DE API ESPECÍFICAS (Mejoradas)
export const authAPI = {
  login: (email: string, password: string) =>
    apiClient.post(API_ENDPOINTS.LOGIN, { email, password }),
  
  register: (email: string, password: string, nombre: string) =>
    apiClient.post(API_ENDPOINTS.REGISTER, { email, password, nombre }),
  
  logout: () =>
    apiClient.post(API_ENDPOINTS.LOGOUT),
  
  perfil: () =>
    apiClient.get(API_ENDPOINTS.PROFILE),
};

export const busquedaAPI = {
  articulos: (params: any) =>
    apiClient.get(API_ENDPOINTS.SEARCH_ARTICLES, { params }),
  
  articuloPorId: (id: string) =>
    apiClient.get(API_ENDPOINTS.GET_DOCUMENT(id)),
};

// ✅ PARA COMPATIBILIDAD CON CÓDIGO EXISTENTE
export const authService = {
  register: async (data: { nombre: string; email: string; password: string }) => {
    const response = await authAPI.register(data.email, data.password, data.nombre);
    return response.data;
  }
};

// Tipos TypeScript (mantener los existentes)
export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  fechaRegistro?: string;
  ultimoLogin?: string;
}

export interface RespuestaAPI<T = any> {
  exito: boolean;
  datos?: T;
  usuario?: Usuario;
  token?: string;
  error?: string;
  mensaje?: string;
}

export interface Articulo {
  _id: string;
  rel_title: string;
  rel_doi?: string;
  rel_link?: string;
  rel_abs: string;
  author_name: string;
  author_inst?: string;
  category: string;
  type: string;
  rel_date: string;
  entities?: string[];
  score?: number;
  highlights?: any;
}

export interface ResultadosBusqueda {
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  resultados: Articulo[];
  facetas: any;
}