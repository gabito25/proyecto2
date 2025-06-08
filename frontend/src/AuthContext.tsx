import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { logout as apiLogout } from './services/api';

interface Usuario {
  id: string;
  nombre: string;
  email: string;
}

interface AuthContextType {
  usuario: Usuario | null;
  token: string | null;
  login: (userData: Usuario, authToken: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// Función para limpiar y validar objeto usuario
const limpiarUsuario = (userData: any): Usuario | null => {
  try {
    if (!userData || typeof userData !== 'object') {
      return null;
    }

    // Extraer solo las propiedades que necesitamos
    const usuarioLimpio: Usuario = {
      id: String(userData.id || ''),
      nombre: String(userData.nombre || ''),
      email: String(userData.email || '')
    };

    // Validar que las propiedades requeridas existan
    if (!usuarioLimpio.id || !usuarioLimpio.nombre || !usuarioLimpio.email) {
      console.error('❌ Usuario inválido - faltan propiedades requeridas:', usuarioLimpio);
      return null;
    }

    return usuarioLimpio;
  } catch (error) {
    console.error('❌ Error limpiando usuario:', error);
    return null;
  }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Cargar datos del localStorage al iniciar
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('usuario');

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        console.log('🔍 Usuario parseado desde localStorage:', parsedUser);
        
        const usuarioLimpio = limpiarUsuario(parsedUser);
        if (usuarioLimpio) {
          setToken(storedToken);
          setUsuario(usuarioLimpio);
          console.log('✅ Sesión restaurada:', usuarioLimpio.nombre);
        } else {
          console.error('❌ Usuario guardado inválido, limpiando localStorage');
          localStorage.clear();
        }
      } catch (error) {
        console.error('❌ Error parseando usuario guardado:', error);
        localStorage.clear();
      }
    }
  }, []);

  const login = (userData: Usuario, authToken: string) => {
    console.log('🔍 Datos recibidos en login:', userData);
    
    const usuarioLimpio = limpiarUsuario(userData);
    if (!usuarioLimpio) {
      console.error('❌ Error: datos de usuario inválidos en login');
      return;
    }

    setUsuario(usuarioLimpio);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('usuario', JSON.stringify(usuarioLimpio));
    console.log('✅ Login exitoso:', usuarioLimpio.nombre);
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Error en logout del servidor:', error);
    } finally {
      setUsuario(null);
      setToken(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('usuario');
      console.log('✅ Sesión cerrada');
    }
  };

  const value: AuthContextType = {
    usuario,
    token,
    login,
    logout,
    isAuthenticated: !!token && !!usuario
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};