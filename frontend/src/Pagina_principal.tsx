import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { HighlightText, useSearchTerms } from './utils/highlight';
import { buildApiUrl, API_ENDPOINTS } from './services/api';

const Pagina_principal: React.FC = () => {
  const { usuario, token, logout } = useAuth();
  
  // Estados principales
  const [terminoBusqueda, setTerminoBusqueda] = useState<string>('');
  const [autorBusqueda, setAutorBusqueda] = useState<string>('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados de paginación
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const [totalResultados, setTotalResultados] = useState<number>(0);
  const [totalPaginas, setTotalPaginas] = useState<number>(0);

  // ✅ NUEVOS ESTADOS PARA FACETS Y FILTROS
  const [facetas, setFacetas] = useState<any>({});
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('');
  const [tipoSeleccionado, setTipoSeleccionado] = useState<string>('');
  const [entidadSeleccionada, setEntidadSeleccionada] = useState<string>('');

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
      facetas: Object.keys(facetas)
    });
  }, [resultados, totalResultados, cargando, error, usuario, facetas]);


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

    // ✅ CONSTRUIR PARÁMETROS CON FILTROS
    const params = new URLSearchParams();
    if (terminoBusqueda?.trim()) {
      params.append('q', terminoBusqueda.trim());
    }
    if (autorBusqueda?.trim()) {
      params.append('autor', autorBusqueda.trim());
    }
    if (categoriaSeleccionada?.trim()) {
      params.append('categoria', categoriaSeleccionada.trim());
    }
    if (tipoSeleccionado?.trim()) {
      params.append('tipo', tipoSeleccionado.trim());
    }
    if (entidadSeleccionada?.trim()) {
      params.append('entidades', entidadSeleccionada.trim());
    }
    params.append('pagina', paginaActual.toString());
    params.append('limite', '10');

    // ✅ URL CORREGIDA PARA VERCEL
    const url = buildApiUrl(`${API_ENDPOINTS.SEARCH_ARTICLES}?${params.toString()}`);
    console.log('📡 URL de búsqueda:', url);

    // Realizar petición
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('📥 Respuesta recibida:', response.status, response.statusText);

    const data = await response.json();
    console.log('📦 Datos recibidos:', data);

    if (!response.ok) {
      throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
    }

    if (data.exito) {
      setResultados(data.datos || []);
      setTotalResultados(data.total || 0);
      setTotalPaginas(data.totalPaginas || 1);
      setFacetas(data.facetas || {}); // ✅ GUARDAR FACETAS
      console.log(`✅ Éxito: ${(data.datos || []).length} resultados cargados`);
      console.log('📊 Facetas disponibles:', data.facetas);
    } else {
      setError(data.error || 'Error en la búsqueda');
      setResultados([]);
      setFacetas({});
    }

  } catch (error) {
    console.error('💥 Error en búsqueda:', error);
    setError(error instanceof Error ? error.message : 'Error de conexión');
    setResultados([]);
    setFacetas({});
  } finally {
    setCargando(false);
  }
};

  // ✅ FUNCIÓN PARA APLICAR FILTRO DE FACETA
  const aplicarFiltro = (tipo: 'categoria' | 'tipo' | 'entidad', valor: string) => {
    console.log(`🔧 Aplicando filtro ${tipo}:`, valor);
    
    // Limpiar resultados anteriores
    setResultados([]);
    setPaginaActual(1);
    
    // Aplicar filtro
    switch (tipo) {
      case 'categoria':
        setCategoriaSeleccionada(categoriaSeleccionada === valor ? '' : valor);
        break;
      case 'tipo':
        setTipoSeleccionado(tipoSeleccionado === valor ? '' : valor);
        break;
      case 'entidad':
        setEntidadSeleccionada(entidadSeleccionada === valor ? '' : valor);
        break;
    }
  };

  // ✅ LIMPIAR TODOS LOS FILTROS
  const limpiarFiltros = () => {
    setCategoriaSeleccionada('');
    setTipoSeleccionado('');
    setEntidadSeleccionada('');
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

  // ✅ EJECUTAR BÚSQUEDA CUANDO CAMBIEN FILTROS O PÁGINA
  useEffect(() => {
    if (paginaActual > 1 || categoriaSeleccionada || tipoSeleccionado || entidadSeleccionada) {
      realizarBusqueda();
    }
  }, [paginaActual, categoriaSeleccionada, tipoSeleccionado, entidadSeleccionada]);

  // ✅ CALCULAR SEARCH TERMS UNA VEZ A NIVEL DE COMPONENTE
  const searchTerms = useSearchTerms(terminoBusqueda, autorBusqueda);

  // ✅ ESTILOS MEJORADOS
  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    color: '#000000',
    fontFamily: 'Arial, sans-serif'
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #ddd',
    padding: '1rem 2rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#333333'
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
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9rem'
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
    borderRadius: '4px',
    marginRight: '1rem',
    color: '#000000'
  };

  const authorInputStyle: React.CSSProperties = {
    width: '200px',
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginRight: '1rem',
    color: '#000000'
  };

  const searchButtonStyle: React.CSSProperties = {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '0.75rem 1.5rem',
    borderRadius: '4px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginLeft: '0.5rem'
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
    transition: 'background-color 0.2s',
    color: '#000000'
  };

  const articleTitleStyle: React.CSSProperties = {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: '0.5rem'
  };

  const articleAuthorStyle: React.CSSProperties = {
    color: '#666666',
    fontSize: '0.9rem',
    marginBottom: '0.5rem'
  };

  const articleAbstractStyle: React.CSSProperties = {
    color: '#333333',
    lineHeight: '1.5',
    margin: '0.5rem 0'
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
    padding: '1rem',
    gap: '0.5rem'
  };

  const pageButtonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    border: '1px solid #ddd',
    backgroundColor: '#ffffff',
    color: '#000000',
    cursor: 'pointer',
    borderRadius: '4px'
  };

  const activePageButtonStyle: React.CSSProperties = {
    ...pageButtonStyle,
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#007bff'
  };

  const loadingStyle: React.CSSProperties = {
    textAlign: 'center',
    padding: '2rem',
    fontSize: '1.2rem',
    color: '#666666'
  };

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '1rem',
    margin: '1rem 2rem',
    borderRadius: '4px',
    border: '1px solid #f5c6cb'
  };

  // ✅ ESTILOS PARA FACETAS
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
    transition: 'all 0.2s'
  };

  const activeFacetButtonStyle: React.CSSProperties = {
    ...facetButtonStyle,
    backgroundColor: '#007bff',
    color: 'white',
    borderColor: '#007bff'
  };

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
            {cargando ? 'Buscando...' : 'Buscar'}
          </button>

          {/* ✅ BOTÓN LIMPIAR FILTROS */}
          {(categoriaSeleccionada || tipoSeleccionado || entidadSeleccionada) && (
            <button
              onClick={limpiarFiltros}
              style={{
                ...searchButtonStyle,
                backgroundColor: '#6c757d',
                marginLeft: '0.5rem'
              }}
            >
              Limpiar Filtros
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
          🔍 Buscando artículos...
        </div>
      )}

      {/* ✅ FACETAS Y RESULTADOS */}
      {!cargando && !error && (
        <div style={resultsContainerStyle}>
          {/* ✅ FACETAS SEGÚN DOCUMENTACIÓN */}
          {facetas && Object.keys(facetas).length > 0 && (
            <div style={facetContainerStyle}>
              <h3 style={{ marginBottom: '1rem', color: '#333', fontSize: '1.1rem' }}>
                🔍 Filtros Disponibles
              </h3>
              
              {/* Facet Categorías */}
              {facetas.categorias && facetas.categorias.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#666', fontSize: '0.9rem' }}>📂 Categorías:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {facetas.categorias.slice(0, 10).map((cat: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => aplicarFiltro('categoria', cat)}
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
              {facetas.autores && facetas.autores.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#666', fontSize: '0.9rem' }}>👤 Autores frecuentes:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {facetas.autores.slice(0, 8).map((autor: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setAutorBusqueda(autor)}
                        style={facetButtonStyle}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#e9ecef';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }}
                      >
                        {autor}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Facet Entidades */}
              {facetas.entidades && facetas.entidades.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <strong style={{ color: '#666', fontSize: '0.9rem' }}>🏷️ Entidades:</strong>
                  <div style={{ marginTop: '0.5rem' }}>
                    {facetas.entidades.slice(0, 12).map((entidad: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => aplicarFiltro('entidad', entidad)}
                        style={entidadSeleccionada === entidad ? activeFacetButtonStyle : facetButtonStyle}
                        onMouseEnter={(e) => {
                          if (entidadSeleccionada !== entidad) {
                            e.currentTarget.style.backgroundColor = '#e9ecef';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (entidadSeleccionada !== entidad) {
                            e.currentTarget.style.backgroundColor = '#f8f9fa';
                          }
                        }}
                      >
                        {entidad}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumen de resultados */}
          <div style={resultsSummaryStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                Encontrados {totalResultados} resultados (Página {paginaActual} de {totalPaginas})
              </span>
              
              {/* ✅ INDICADORES DE FILTROS ACTIVOS */}
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
                {entidadSeleccionada && (
                  <span style={{ 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    padding: '0.2rem 0.5rem', 
                    borderRadius: '3px', 
                    marginLeft: '0.5rem' 
                  }}>
                    🏷️ {entidadSeleccionada}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ✅ LISTA DE ARTÍCULOS CON HIGHLIGHTING */}
          <div style={articlesListStyle}>
            {(resultados || []).map((articulo, index) => {
              // ✅ USAR SEARCH TERMS CALCULADOS ARRIBA
              return (
                <div
                  key={articulo._id || index}
                  style={articleCardStyle}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8f9fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }}
                >
                  <div style={articleTitleStyle}>
                    <HighlightText 
                      text={String(articulo.rel_title || articulo.jobId || 'Sin título')}
                      searchTerms={searchTerms}
                    />
                  </div>
                  
                  <div style={articleAuthorStyle}>
                    👤 <HighlightText 
                      text={String(articulo.author_name || 'Autor desconocido')}
                      searchTerms={searchTerms}
                    />
                    {articulo.author_inst && ` - ${articulo.author_inst}`}
                  </div>
                  
                  <div style={articleAbstractStyle}>
                    <HighlightText 
                      text={String(articulo.rel_abs || 'Sin contenido disponible')}
                      searchTerms={searchTerms}
                    />
                  </div>
                  
                  <div style={articleMetaStyle}>
                    📂 <HighlightText 
                      text={String(articulo.category || 'Sin categoría')}
                      searchTerms={searchTerms}
                    /> | 
                    📅 {articulo.rel_date ? new Date(articulo.rel_date).toLocaleDateString() : 'Sin fecha'} | 
                    ⭐ Score: {articulo.score?.toFixed(2) || '0.00'}
                    {articulo.entities && articulo.entities.length > 0 && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>
                        🏷️ {articulo.entities.slice(0, 5).join(', ')}
                        {articulo.entities.length > 5 && '...'}
                      </div>
                    )}
                    {articulo.highlights && articulo.highlights.length > 0 && (
                      <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#007bff' }}>
                        ✨ Coincidencias encontradas en el texto
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Mensaje cuando no hay resultados */}
            {resultados.length === 0 && !cargando && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666666' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>
                  No se encontraron artículos
                </div>
                <div style={{ fontSize: '0.9rem' }}>
                  Intenta con otros términos de búsqueda o revisa los filtros aplicados
                </div>
              </div>
            )}
          </div>

          {/* ✅ PAGINACIÓN MEJORADA */}
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