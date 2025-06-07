/// <reference types="vite/client" />

// frontend/src/api.ts
export interface Article {
  _id: string;
  rel_title: string;
  rel_abs: string;
  rel_authors: string[];
  rel_date: string;
  rel_link: string;
  rel_doi: string;
  category: string;
  type: string;
  author_name: string;
  resumen: string;
  score?: number;
}

export interface SearchResponse {
  exito: boolean;
  datos: Article[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
  metodo?: string;
  indice?: string;
  query?: string;
  mensaje?: string;
}

export interface User {
  id: string;
  email: string;
  nombre: string;
}

export interface AuthResponse {
  exito: boolean;
  usuario: User;
  token: string;
  mensaje?: string;
}

// Configuración de la API
const API_BASE_URL = import.meta.env.PROD 
  ? 'https://tu-proyecto.vercel.app/api'  // Cambia esto por tu URL de Vercel
  : 'http://localhost:3000/api';

// Cliente HTTP básico
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Métodos de autenticación
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.exito && response.token) {
      this.token = response.token;
      localStorage.setItem('auth_token', response.token);
    }
    
    return response;
  }

  async register(email: string, password: string, nombre: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/registro', {
      method: 'POST',
      body: JSON.stringify({ email, password, nombre }),
    });

    if (response.exito && response.token) {
      this.token = response.token;
      localStorage.setItem('auth_token', response.token);
    }

    return response;
  }

  async logout(): Promise<void> {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  // Métodos de búsqueda
  async searchArticles(
    query: string,
    pagina: number = 1,
    limite: number = 10,
    categoria?: string,
    autor?: string
  ): Promise<SearchResponse> {
    const params = new URLSearchParams({
      q: query,
      pagina: pagina.toString(),
      limite: limite.toString(),
      ...(categoria && { categoria }),
      ...(autor && { autor }),
    });

    return this.request<SearchResponse>(`/busqueda/articulos?${params}`);
  }

  // Método de health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }

  // Verificar si el usuario está autenticado
  isAuthenticated(): boolean {
    return !!this.token;
  }

  // Obtener token actual
  getToken(): string | null {
    return this.token;
  }
}

// Instancia singleton del cliente API
export const apiClient = new ApiClient(API_BASE_URL);

// Funciones de conveniencia exportadas
export const searchArticles = (
  query: string, 
  pagina?: number, 
  limite?: number, 
  categoria?: string,
  autor?: string
) => apiClient.searchArticles(query, pagina, limite, categoria, autor);

export const login = (email: string, password: string) =>
  apiClient.login(email, password);

export const register = (email: string, password: string, nombre: string) =>
  apiClient.register(email, password, nombre);

export const logout = () => apiClient.logout();

export const healthCheck = () => apiClient.healthCheck();

export const isAuthenticated = () => apiClient.isAuthenticated();

export const getToken = () => apiClient.getToken();

export default apiClient;