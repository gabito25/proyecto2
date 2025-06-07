import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { HighlightText, highlightStyles } from './utils/highlight';
import { useEffect, useState } from 'react';
import { buildApiUrl, API_ENDPOINTS } from './services/api';

interface Documento {
  _id: string;
  rel_title: string;
  rel_abs: string;
  author_name: string;
  author_inst: string;
  category: string;
  rel_date: string;
  entities: string[];
  content: string;
  jobId?: string;
  score?: number;
  highlights?: any[];
}

const Pagina_documento: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario, token } = useAuth();
  
  const [documento, setDocumento] = useState<Documento | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Cargar documento al montar el componente
  useEffect(() => {
    if (id) {
      cargarDocumento(id);
    } else {
      setError('ID de documento no válido');
      setCargando(false);
    }
  }, [id]);

  const cargarDocumento = async (documentoId: string) => {
    try {
      setCargando(true);
      setError(null);

      console.log('📄 Cargando documento:', documentoId);

      if (!token) {
        setError('No hay sesión activa');
        return;
      }

      // ✅ URL CORREGIDA PARA VERCEL
      const response = await fetch(buildApiUrl(API_ENDPOINTS.GET_DOCUMENT(documentoId)), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      console.log('📦 Respuesta del documento:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Error al cargar el documento');
      }

      if (data.exito) {
        setDocumento(data.datos);
        console.log('✅ Documento cargado correctamente');
      } else {
        setError(data.error || 'Documento no encontrado');
      }

    } catch (error) {
      console.error('❌ Error cargando documento:', error);
      setError(error instanceof Error ? error.message : 'Error de conexión');
    } finally {
      setCargando(false);
    }
  };

  const volver = () => {
    navigate('/pagina_principal');
  };

  const cerrarSesion = async () => {
    const { logout } = useAuth();
    await logout();
  };

  // Formatear fecha
  const formatearFecha = (fecha: string) => {
    try {
      return new Date(fecha).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return fecha;
    }
  };

  // Estilos
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#ffffff',
    color: '#2c3e50',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    lineHeight: '1.6'
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e9ecef',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
    backdropFilter: 'blur(10px)'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.8rem',
    fontWeight: '600',
    color: '#2c3e50',
    margin: 0
  };

  const userInfoStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  };

  const backButtonStyle: React.CSSProperties = {
    backgroundColor: '#f8f9fa',
    color: '#495057',
    border: '1px solid #dee2e6',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const logoutButtonStyle: React.CSSProperties = {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '500',
    transition: 'all 0.2s ease'
  };

  const contentStyle: React.CSSProperties = {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '2rem',
    backgroundColor: 'transparent'
  };

  const documentHeaderStyle: React.CSSProperties = {
    marginBottom: '2rem',
    paddingBottom: '1.5rem',
    borderBottom: '1px solid #e9ecef'
  };

  const documentTitleStyle: React.CSSProperties = {
    fontSize: '2rem',
    fontWeight: '700',
    color: '#2c3e50',
    marginBottom: '1.5rem',
    lineHeight: '1.3'
  };

  const metaGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '1.5rem',
    marginBottom: '1.5rem'
  };

  const metaItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem'
  };

  const metaLabelStyle: React.CSSProperties = {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const metaValueStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: '#2c3e50',
    fontWeight: '500'
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '2rem'
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  };

  const contentTextStyle: React.CSSProperties = {
    fontSize: '1rem',
    color: '#495057',
    lineHeight: '1.7',
    backgroundColor: '#f8f9fa',
    padding: '1.5rem',
    borderRadius: '8px',
    border: '1px solid #e9ecef'
  };

  const entitiesContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '0.75rem',
    marginTop: '0.75rem'
  };

  const entityTagStyle: React.CSSProperties = {
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    padding: '0.375rem 0.75rem',
    borderRadius: '20px',
    fontSize: '0.875rem',
    fontWeight: '500',
    border: '1px solid #bbdefb'
  };

  const loadingStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    height: '60vh',
    fontSize: '1.1rem',
    color: '#6c757d'
  };

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '1.5rem',
    margin: '2rem',
    borderRadius: '8px',
    border: '1px solid #f5c6cb',
    textAlign: 'center' as const,
    fontSize: '1rem'
  };

  if (cargando) {
    return (
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>BioRxiv Search</h1>
          <div style={userInfoStyle}>
            {usuario && (
              <span style={{color: '#333333'}}>
                Bienvenido, {usuario.nombre}
              </span>
            )}
            <button style={backButtonStyle} onClick={volver}>
              ← Volver
            </button>
            <button style={logoutButtonStyle} onClick={cerrarSesion}>
              Cerrar Sesión
            </button>
          </div>
        </header>
        
        <div style={loadingStyle}>
          📄 Cargando documento...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>BioRxiv Search</h1>
          <div style={userInfoStyle}>
            {usuario && (
              <span style={{color: '#333333'}}>
                Bienvenido, {usuario.nombre}
              </span>
            )}
            <button style={backButtonStyle} onClick={volver}>
              ← Volver
            </button>
            <button style={logoutButtonStyle} onClick={cerrarSesion}>
              Cerrar Sesión
            </button>
          </div>
        </header>
        
        <div style={errorStyle}>
          ❌ {error}
        </div>
      </div>
    );
  }

  if (!documento) {
    return (
      <div style={containerStyle}>
        <header style={headerStyle}>
          <h1 style={titleStyle}>BioRxiv Search</h1>
          <div style={userInfoStyle}>
            <button style={backButtonStyle} onClick={volver}>
              ← Volver
            </button>
          </div>
        </header>
        
        <div style={errorStyle}>
          📄 Documento no encontrado
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <h1 style={titleStyle}>BioRxiv Search</h1>
        <div style={userInfoStyle}>
          {usuario && (
            <span style={{color: '#333333'}}>
              Bienvenido, {usuario.nombre}
            </span>
          )}
          <button style={backButtonStyle} onClick={volver}>
            ← Volver a búsqueda
          </button>
          <button style={logoutButtonStyle} onClick={cerrarSesion}>
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Contenido del documento */}
      <div style={contentStyle}>
        {/* Encabezado del documento */}
        <div style={documentHeaderStyle}>
          <h1 style={documentTitleStyle}>
            {documento.rel_title || 'Sin título'}
          </h1>
          
          {/* Grid de metadatos */}
          <div style={metaGridStyle}>
            <div style={metaItemStyle}>
              <span style={metaLabelStyle}>
                <span>👤</span> Autor
              </span>
              <span style={metaValueStyle}>{documento.author_name || 'Autor desconocido'}</span>
            </div>
            
            {documento.author_inst && (
              <div style={metaItemStyle}>
                <span style={metaLabelStyle}>
                  <span>🏛️</span> Institución
                </span>
                <span style={metaValueStyle}>{documento.author_inst}</span>
              </div>
            )}
            
            <div style={metaItemStyle}>
              <span style={metaLabelStyle}>
                <span>📂</span> Categoría
              </span>
              <span style={metaValueStyle}>{documento.category || 'General'}</span>
            </div>
            
            <div style={metaItemStyle}>
              <span style={metaLabelStyle}>
                <span>📅</span> Fecha
              </span>
              <span style={metaValueStyle}>{formatearFecha(documento.rel_date)}</span>
            </div>
            
            {documento.score && (
              <div style={metaItemStyle}>
                <span style={metaLabelStyle}>
                  <span>⭐</span> Puntuación
                </span>
                <span style={metaValueStyle}>{documento.score.toFixed(2)}</span>
              </div>
            )}
            
            {documento.jobId && (
              <div style={metaItemStyle}>
                <span style={metaLabelStyle}>
                  <span>🆔</span> ID
                </span>
                <span style={metaValueStyle}>{documento.jobId}</span>
              </div>
            )}
          </div>

          {/* Entidades */}
          {documento.entities && documento.entities.length > 0 && (
            <div style={sectionStyle}>
              <span style={metaLabelStyle}>
                <span>🏷️</span> Entidades
              </span>
              <div style={entitiesContainerStyle}>
                {documento.entities.map((entity, index) => (
                  <span key={index} style={entityTagStyle}>
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Resumen */}
        {documento.rel_abs && (
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>
              <span>📋</span> Resumen
            </h2>
            <div style={contentTextStyle}>
              <HighlightText 
                text={documento.rel_abs}
                searchTerms={[]} // No hay términos de búsqueda definidos
                highlightStyle={highlightStyles.abstract}
              />
            </div>
          </div>
        )}

        {/* Contenido completo */}
        {documento.content && (
          <div style={sectionStyle}>
            <h2 style={sectionTitleStyle}>
              <span>📄</span> Contenido
            </h2>
            <div style={contentTextStyle}>
              {documento.content.split('\n').map((paragraph, index) => (
                <p key={index} style={{ marginBottom: '1rem', margin: 0 }}>
                  <HighlightText 
                    text={paragraph || '\u00A0'}
                    searchTerms={[]} // No hay términos de búsqueda definidos
                    highlightStyle={highlightStyles.content}
                  />
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pagina_documento;

