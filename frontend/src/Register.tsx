import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from './services/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (formData.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    if (!formData.nombre.trim()) {
      setError('El nombre es requerido');
      return;
    }

    setLoading(true);

    try {
      const data = await register(formData.email, formData.password, formData.nombre.trim());

      if (data.exito) {
        alert('Registro exitoso. Ahora puedes iniciar sesión.');
        navigate('/login');
      } else {
        setError(data.mensaje || 'Error al registrar usuario');
      }
    } catch (err: any) {
      console.error('Error al registrar:', err);
      setError('Error al registrar usuario. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={formContainerStyle}>
        <h2 style={titleStyle}>Crear Cuenta</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="nombre"
            placeholder="Nombre completo"
            value={formData.nombre}
            onChange={handleChange}
            required
            style={inputStyle}
            disabled={loading}
          />
          <input
            type="email"
            name="email"
            placeholder="Correo electrónico"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
            disabled={loading}
          />
          <input
            type="password"
            name="password"
            placeholder="Contraseña (mín. 6 caracteres)"
            value={formData.password}
            onChange={handleChange}
            required
            style={inputStyle}
            disabled={loading}
            minLength={6}
          />
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirmar contraseña"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            style={inputStyle}
            disabled={loading}
          />
          <button 
            type="submit" 
            style={{
              ...buttonStyle,
              backgroundColor: loading ? '#ccc' : '#28a745',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>
        {error && (
          <p style={{ color: 'red', marginTop: '1rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
        <p style={linkTextStyle}>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" style={linkStyle}>
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}

// Estilos (mantienen los mismos que tenías)
const containerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  height: '100vh',
  width: '100vw',
  backgroundColor: '#f0f2f5',
};

const formContainerStyle = {
  backgroundColor: '#ffffff',
  padding: '2rem',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  width: '100%',
  maxWidth: '400px',
};

const titleStyle = {
  textAlign: 'center' as const,
  marginBottom: '1.5rem',
  color: '#333',
};

const inputStyle = {
  width: '100%',
  padding: '0.75rem',
  marginBottom: '1rem',
  border: '1px solid #ccc',
  borderRadius: '8px',
  fontSize: '1rem',
  backgroundColor: '#cccccc',
  color: '#1b1b1b',
  boxSizing: 'border-box' as const,
};

const buttonStyle = {
  width: '100%',
  padding: '0.75rem',
  backgroundColor: '#28a745',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '1rem',
  cursor: 'pointer',
};

const linkTextStyle = {
  marginTop: '1rem',
  fontSize: '0.9rem',
  color: '#555',
};

const linkStyle = {
  color: '#bb1515',
  textDecoration: 'underline',
  cursor: 'pointer',
};