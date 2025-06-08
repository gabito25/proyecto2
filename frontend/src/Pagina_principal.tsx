import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { searchArticles, Article, SearchResponse } from './services/api';

// ✅ COMPONENTE HIGHLIGHT SÚPER SIMPLE Y SEGURO
const SimpleHighlight: React.FC<{
  text: any;
  search: string;
}> = ({ text, search }) => {
  // Convertir todo a string de forma segura
  const safeText = String(text || '');
  const safeSearch = String(search || '').trim();
  
  // Si no hay término de búsqueda, mostrar texto normal
  if (!safeSearch || safeSearch.length < 2) {
    return <>{safeText}</>;
  }
  
  try {
    // Buscar coincidencias (case insensitive)
    const regex = new RegExp(`(${safeSearch})`, 'gi');
    const parts = safeText.split(regex);
    
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = part.toLowerCase() === safeSearch.toLowerCase();
          return isMatch ? (
            <span 
              key={i} 
              style={{
                backgroundColor: '#ffeb3b',
                fontWeight: 'bold',
                padding: '1px 2px',
                borderRadius: '2px'
              }}
            >
              {part}
            </span>
          ) : (
            part
          );
        })}
      </>
    );
  } catch {
    // Si hay error, mostrar texto sin highlight
    return <>{safeText}</>;
  }
};

const Pagina_principal: React.FC = () => {
  const navigate = useNavigate();
  const { usuario, token, logout } = useAuth();
  
  // Estados principales
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [autorBusqueda, setAutorBusqueda] = useState<string>('');
  const [resultados, setResultados] = useState<Article[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [totalResultados, setTotalResultados] = useState<number>(0);
  const [totalPaginas, setTotalPaginas] = useState<number>(0);

  // Estados para filtros
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('');

  // Estados para facetas derivadas de resultados
  const [categorias, setCategorias] = useState<string[]>([]);
  const [autoresFrequentes, setAutoresFrequentes] = useState<string[]>([]);

  // Verificar que el usuario y token estén disponibles
  useEffect(() => {
    console.log('✅ Usuario autenticado:', usuario?.nombre);
  }, [usuario]);

  // Debug del estado
  useEffect(() => {
    console.log('📱 Estado actualizado:', {
      resultados: resultados.length,
      totalResultados,
      cargando,
      error,
      usuario: usuario?.nombre,
      categorias: categorias.length
    });
  }, [resultados, totalResultados, cargando, error, usuario, categorias]);

  // Función para navegar al documento
  const navegarADocumento = (documentoId: string) => {
    console.log('📄 Navegando a documento:', documentoId);
    navigate(`/documento/${documentoId}`);
  };

  const realizarBusqueda = async () => {
    try {
      console.log('🔍 Iniciando búsqueda...', { 
        terminoBusqueda, 
        autorBusqueda, 
        categoriaSeleccionada,
        paginaActual 
      });
      
      setCargando(true);
      setError(null);
      
      // Verificar token
      console.log('🔑 Token presente:', !!token);
      
      if (!token) {
        setError('No hay sesión activa. Por favor, inicia sesión nuevamente.');
        setCargando(false);
        return;
      }

      // Usar la función searchArticles del API
      const data: SearchResponse = await searchArticles(
        terminoBusqueda || '',
        paginaActual,
        10,
        categoriaSeleccionada || undefined,
        autorBusqueda || undefined
      );

      console.log('📦 Datos recibidos:', data);

      if (data.exito) {
        setResultados(data.datos || []);
        setTotalResultados(data.total || 0);
        setTotalPaginas(data.totalPaginas || 1);
        
        // Extraer facetas de los resultados
        extraerFacetas(data.datos || []);
        
        console.log(`✅ Éxito: ${(data.datos || []).length} resultados cargados`);
      } else {
        setError(data.mensaje || 'Error en la búsqueda');
        setResultados([]);
        limpiarFacetas();
      }

    } catch (error) {
      console.error('💥 Error en búsqueda:', error);
      setError(error instanceof Error ? error.message : 'Error de conexión');
      setResultados([]);
      limpiarFacetas();
    } finally {
      setCargando(false);
    }
  };

 const extraerFacetas = (articulos: Article[]) => {
  try {
    // Extraer categorías únicas de forma segura
    const categoriasUnicas = [...new Set(
      articulos
        .map(art => String(art.category || ''))
        .filter(cat => cat && cat.length > 0)
    )].slice(0, 10);

    // ✅ EXTRACCIÓN DE AUTORES MEJORADA - maneja objetos y arrays
    const autoresUnicos = [...new Set(
      articulos
        .flatMap(art => {
          // Manejar diferentes formatos de autores
          if (art.rel_authors && Array.isArray(art.rel_authors)) {
            return art.rel_authors.map(autor => {
              // Si el autor es un objeto, extraer el nombre
              if (typeof autor === 'object' && autor !== null) {
                return typeof autor === 'object' && autor !== null
                  ? String(
                      (autor as { name?: string; author_name?: string; firstName?: string; lastName?: string }).name ||
                      (autor as { name?: string; author_name?: string; firstName?: string; lastName?: string }).author_name ||
                      (autor as { name?: string; author_name?: string; firstName?: string; lastName?: string }).firstName ||
                      (autor as { name?: string; author_name?: string; firstName?: string; lastName?: string }).lastName ||
                      ''
                    )
                  : String(autor || '');
              }
              // Si es string, usarlo directamente
              return String(autor || '');
            });
          }
          
          // Si rel_authors no es array, usar author_name
          if (art.author_name) {
            if (typeof art.author_name === 'object' && art.author_name !== null) {
              const authorObj = art.author_name as { name?: string; author_name?: string };
              return [String(authorObj.name || authorObj.author_name || '')];
            }
            return [String(art.author_name)];
          }
          
          return [];
        })
        .filter(autor => autor && autor.trim().length > 0)
    )].slice(0, 8);

    console.log('📊 Facetas extraídas:', { categorias: categoriasUnicas, autores: autoresUnicos });

    setCategorias(categoriasUnicas);
    setAutoresFrequentes(autoresUnicos);
  } catch (error) {
    console.error('❌ Error extrayendo facetas:', error);
    limpiarFacetas();
  }
};

// ✅ FUNCIÓN PARA MOSTRAR AUTORES DE FORMA SEGURA - Agrega esta función también

const obtenerNombreAutor = (autor: any): string => {
  try {
    if (!autor) return 'Autor desconocido';
    
    // Si es string, devolverlo
    if (typeof autor === 'string') {
      return autor.trim();
    }
    
    // Si es objeto, intentar extraer el nombre
    if (typeof autor === 'object') {
      const nombre = autor.name || 
                    autor.author_name || 
                    autor.firstName || 
                    autor.lastName || 
                    autor.given || 
                    autor.family || 
                    JSON.stringify(autor);
      return String(nombre).trim();
    }
    
    return String(autor).trim();
  } catch (error) {
    console.warn('Error procesando autor:', error, autor);
    return 'Autor desconocido';
  }
};

  const limpiarFacetas = () => {
    setCategorias([]);
    setAutoresFrequentes([]);
  };

  // Función para aplicar filtro de categoría
  const aplicarFiltroCategoria = (categoria: string) => {
    console.log(`🔧 Aplicando filtro categoría:`, categoria);
    
    // Limpiar resultados anteriores
    setResultados([]);
    setPaginaActual(1);
    
    // Alternar selección
    setCategoriaSeleccionada(categoriaSeleccionada === categoria ? '' : categoria);
  };

  // Función para seleccionar autor desde facetas
  const seleccionarAutor = (autor: string) => {
    setAutorBusqueda(autor);
    setPaginaActual(1);
  };

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setCategoriaSeleccionada('');
    setTipoSeleccionado('');
    setAutorBusqueda('');
    setPaginaActual(1);
  };

  // Manejar búsqueda con Enter
  const manejarEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setPaginaActual(1);
      realizarBusqueda();
    }
  };

  // Manejar click del botón buscar
  const manejarBusqueda = () => {
    setPaginaActual(1);
    realizarBusqueda();
  };

  // Cerrar sesión
  const cerrarSesion = async () => {
    await logout();
  };

  // Cambiar página
  const cambiarPagina = (nuevaPagina: number) => {
    setPaginaActual(nuevaPagina);
  };

  // Ejecutar búsqueda cuando cambien filtros o página
  useEffect(() => {
    if (paginaActual > 1 || categoriaSeleccionada) {
      realizarBusqueda();
    }
  }, [paginaActual, categoriaSeleccionada]);

  // Estilos
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    color: '#000000',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #ddd',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100
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

  const searchContainerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    padding: '2rem',
    margin: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    marginRight: '1rem',
    color: '#000000'
  };

  const authorInputStyle: React.CSSProperties = {
    width: '200px',
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '6px',
    marginRight: '1rem',
    color: '#000000'
  };

  const searchButtonStyle: React.CSSProperties = {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '6px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginLeft: '0.5rem',
    fontWeight: '500',
    transition: 'all 0.2s ease'
  };

  const resultsContainerStyle: React.CSSProperties = {
    margin: '0 2rem',
    color: '#000000'
  };

  const resultsSummaryStyle: React.CSSProperties = {
    padding: '1rem',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f8f9fa',
    color: '#333333',
    borderRadius: '4px 4px 0 0'
  };

  const articlesListStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderRadius: '0 0 4px 4px',
    color: '#000000'
  };

  const articleCardStyle: React.CSSProperties = {
    padding: '1.5rem',
    borderBottom: '1px solid #eee',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    color: '#000000'
  };

  const articleTitleStyle: React.CSSProperties = {
    fontSize: '1.2rem',
    fontWeight: '600',
    color: '#007bff',
    marginBottom: '0.5rem',
    lineHeight: '1.4'
  };

  const articleAuthorStyle: React.CSSProperties = {
    color: '#666666',
    fontSize: '0.9rem',
    marginBottom: '0.5rem'
  };

  const articleAbstractStyle: React.CSSProperties = {
    color: '#333333',
    lineHeight: '1.6',
    margin: '0.5rem 0',
    maxHeight: '4.8rem',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical' as const
  };

  const articleMetaStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: '#888888',
    marginTop: '0.5rem'
  };

  const paginationStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '2rem 1rem',
    gap: '0.5rem'
  };

  const pageButtonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    border: '1px solid #ddd',
    backgroundColor: '#ffffff',
    color: '#000000',
    cursor: 'pointer',
    borderRadius: '6px',
    transition: 'all 0.2s ease'
  };

  const activePageButtonStyle: React.CSSProperties = {
    ...pageButtonStyle,
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#007bff'
  };

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center' as const,
    padding: '3rem 2rem',
    fontSize: '1.2rem',
    color: '#666666'
  };

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '1rem',
    margin: '1rem 2rem',
    borderRadius: '6px',
    border: '1px solid #f5c6cb'
  };

  // Estilos para facetas
  const facetContainerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    margin: '0 0 1rem 0',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const facetButtonStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.4rem 0.8rem',
    margin: '0.2rem',
    backgroundColor: '#f8f9fa',
    color: '#333',
    border: '1px solid #ddd',
    borderRadius: '15px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s ease'
  };

  const activeFacetButtonStyle: React.CSSProperties = {
    ...facetButtonStyle,
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#007bff'
  };

  const entitiesStyle: React.CSSProperties = {
    display: 'inline-block',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    padding: '0.2rem 0.5rem',
    borderRadius: '10px',
    fontSize: '0.75rem',
    marginRight: '0.25rem',
    marginTop: '0.25rem'
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <header style={headerStyle}>
        <h1 style={titleStyle}>BioRxiv Search</h1>
        <div style={userInfoStyle}>
          {usuario && (
            <span style={{color: '#333333', fontWeight: '500'}}>
              Bienvenido, {usuario.email}
            </span>
          )}
          <button style={logoutButtonStyle} onClick={cerrarSesion}>
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Formulario de búsqueda */}
      <div style={searchContainerStyle}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Buscar artículos... (ej: Bioinformatics, COVID-19)"
            value={terminoBusqueda}
            onChange={(e) => setTerminoBusqueda(e.target.value)}
            onKeyPress={manejarEnter}
            style={searchInputStyle}
            disabled={cargando}
          />
          
          <input
            type="text"
            placeholder="Filtrar por autor"
            value={autorBusqueda}
            onChange={(e) => setAutorBusqueda(e.target.value)}
            onKeyPress={manejarEnter}
            style={authorInputStyle}
            disabled={cargando}
          />
          
          <button
            onClick={manejarBusqueda}
            disabled={cargando}
            style={{
              ...searchButtonStyle,
              opacity: cargando ? 0.7 : 1,
              cursor: cargando ? 'not-allowed' : 'pointer'
            }}
          >
            {cargando ? '🔍 Buscando...' : '🔍 Buscar'}
          </button>

          {/* Botón limpiar filtros */}
          {(categoriaSeleccionada || autorBusqueda) && (
            <button
              onClick={limpiarFiltros}
              style={{
                ...searchButtonStyle,
                backgroundColor: '#6c757d',
                marginLeft: '0.5rem'
              }}
            >
              🗑️ Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={errorStyle}>
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {cargando && (
        <div style={loadingStyle}>
          <div style={{fontSize: '2rem', marginBottom: '1rem'}}>🔍</div>
          Buscando artículos...
        </div>
      )}

      {/* Facetas y resultados */}
      {!cargando && !error && (
        <div style={resultsContainerStyle}>
          {/* Facetas */}
          {(categorias.length > 0 || autoresFrequentes.length > 0) && (
            <div style={facetContainerStyle}>
              <h3 style={{ marginBottom: '1rem', color: '#333', fontSize: '1.1rem' }}>
                🔍 Filtros Disponibles
              </h3>
              
              {/* Facet Categorías */}
              {categorias.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#666', fontSize: '0.9rem' }}>📂 Categorías:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {categorias.map((cat: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => aplicarFiltroCategoria(cat)}
                        style={categoriaSeleccionada === cat ? activeFacetButtonStyle : facetButtonStyle}
                        onMouseEnter={(e) => {
                          if (categoriaSeleccionada !== cat) {
                            e.currentTarget.style.backgroundColor = '#e9ecef';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (categoriaSeleccionada !== cat) {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Facet Autores */}
              {autoresFrequentes.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#666', fontSize: '0.9rem' }}>👤 Autores frecuentes:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {autoresFrequentes.map((autor: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => seleccionarAutor(autor)}
                        style={{
                          ...facetButtonStyle,
                          backgroundColor: autorBusqueda === autor ? '#28a745' : '#f8f9fa',
                          color: autorBusqueda === autor ? 'white' : '#333',
                          borderColor: autorBusqueda === autor ? '#28a745' : '#ddd'
                        }}
                        onMouseEnter={(e) => {
                          if (autorBusqueda !== autor) {
                            e.currentTarget.style.backgroundColor = '#e9ecef';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (autorBusqueda !== autor) {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }
                        }}
                      >
                        {autor}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumen de resultados */}
          {totalResultados > 0 && (
            <div style={resultsSummaryStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  📊 Encontrados <strong>{totalResultados}</strong> resultados 
                  (Página {paginaActual} de {totalPaginas})
                </span>
                
                {/* Indicadores de filtros activos */}
                <div style={{ fontSize: '0.85rem' }}>
                  {categoriaSeleccionada && (
                    <span style={{ 
                      backgroundColor: '#007bff', 
                      color: 'white', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '3px', 
                      marginLeft: '0.5rem' 
                    }}>
                      📂 {categoriaSeleccionada}
                    </span>
                  )}
                  {autorBusqueda && (
                    <span style={{ 
                      backgroundColor: '#28a745', 
                      color: 'white', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '3px', 
                      marginLeft: '0.5rem' 
                    }}>
                      👤 {autorBusqueda}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Lista de artículos */}
          <div style={articlesListStyle}>
            {resultados.map((articulo, index) => (
              <div
                key={articulo._id || index}
                style={articleCardStyle}
                onClick={() => navegarADocumento(articulo._id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={articleAuthorStyle}>
                  👤 <SimpleHighlight 
                    text={obtenerNombreAutor(articulo.author_name) || 'Autor desconocido'}
                    search={autorBusqueda}
                  />
                  {articulo.rel_authors && Array.isArray(articulo.rel_authors) && articulo.rel_authors.length > 1 && (
                    <span style={{color: '#999', fontSize: '0.8rem'}}>
                      {' '}(+{articulo.rel_authors.length - 1} coautores)
                    </span>
                  )}
                </div>
                
                <div style={articleAuthorStyle}>
                  👤 <SimpleHighlight 
                    text={articulo.author_name || 'Autor desconocido'}
                    search={autorBusqueda}
                  />
                  {articulo.rel_authors && articulo.rel_authors.length > 1 && (
                    <span style={{color: '#999', fontSize: '0.8rem'}}>
                      {' '}(+{articulo.rel_authors.length - 1} coautores)
                    </span>
                  )}
                </div>
                
                <div style={articleAbstractStyle}>
                  <SimpleHighlight 
                    text={articulo.rel_abs || articulo.resumen || 'Sin resumen disponible'}
                    search={terminoBusqueda}
                  />
                </div>
                
                <div style={articleMetaStyle}>
                  <div style={{marginBottom: '0.25rem'}}>
                    📂 <SimpleHighlight 
                      text={articulo.category || 'Sin categoría'}
                      search={terminoBusqueda}
                    /> | 📅 {articulo.rel_date ? new Date(articulo.rel_date).toLocaleDateString('es-ES') : 'Sin fecha'} | ⭐ Score: {articulo.score?.toFixed(2) || '0.00'}
                    {articulo.type && (
                      <> | 📄 {String(articulo.type)}</>
                    )}
                  </div>

                  {/* Entidades si existen */}
                  {articulo.entities && Array.isArray(articulo.entities) && articulo.entities.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      🏷️ {articulo.entities.slice(0, 5).map((entity, idx) => (
                        <span key={idx} style={entitiesStyle}>
                          {String(entity)}
                        </span>
                      ))}
                      {articulo.entities.length > 5 && (
                        <span style={{color: '#666', fontSize: '0.75rem'}}>
                          +{articulo.entities.length - 5} más
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Highlights si existen */}
                  {articulo.highlights && Array.isArray(articulo.highlights) && articulo.highlights.length > 0 && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#007bff' }}>
                      ✨ Texto coincidente encontrado
                    </div>
                  )}
                  
                  {/* Links si existen */}
                  {(articulo.rel_link || articulo.rel_doi) && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                      {articulo.rel_doi && <span style={{color: '#28a745'}}>🔗 DOI disponible</span>}
                      {articulo.rel_link && <span style={{color: '#17a2b8', marginLeft: '0.5rem'}}>🌐 Enlace original</span>}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Mensaje cuando no hay resultados */}
            {resultados.length === 0 && !cargando && (
              <div style={{ padding: '3rem', textAlign: 'center' as const, color: '#666666' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                  No se encontraron artículos
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  Intenta con otros términos de búsqueda o revisa los filtros aplicados
                </div>
              </div>
            )}
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div style={paginationStyle}>
              <button
                onClick={() => cambiarPagina(paginaActual - 1)}
                disabled={paginaActual <= 1}
                style={{
                  ...pageButtonStyle,
                  opacity: paginaActual <= 1 ? 0.5 : 1,
                  cursor: paginaActual <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                ← Anterior
              </button>

              {Array.from({ length: Math.min(5, totalPaginas) }, (_, i) => {
                let pageNum;
                if (totalPaginas <= 5) {
                  pageNum = i + 1;
                } else if (paginaActual <= 3) {
                  pageNum = i + 1;
                } else if (paginaActual >= totalPaginas - 2) {
                  pageNum = totalPaginas - 4 + i;
                } else {
                  pageNum = paginaActual - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => cambiarPagina(pageNum)}
                    style={pageNum === paginaActual ? activePageButtonStyle : pageButtonStyle}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => cambiarPagina(paginaActual + 1)}
                disabled={paginaActual >= totalPaginas}
                style={{
                  ...pageButtonStyle,
                  opacity: paginaActual >= totalPaginas ? 0.5 : 1,
                  cursor: paginaActual >= totalPaginas ? 'not-allowed' : 'pointer'
                }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Pagina_principal;