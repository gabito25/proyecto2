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
        setToken(storedToken);
        setUsuario(parsedUser);
        console.log('✅ Sesión restaurada:', parsedUser.nombre);
      } catch (error) {
        console.error('❌ Error parseando usuario guardado:', error);
        localStorage.clear();
      }
    }
  }, []);

  const login = (userData: Usuario, authToken: string) => {
    setUsuario(userData);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('usuario', JSON.stringify(userData));
    console.log('✅ Login exitoso:', userData.nombre);
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