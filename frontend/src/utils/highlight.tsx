import React from 'react';

interface HighlightProps {
  text: string;
  searchTerms: string[];
  highlightStyle?: React.CSSProperties;
}

// Función para escapar caracteres especiales de regex
const escapeRegExp = (string: string): string => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Componente para resaltar texto
export const HighlightText: React.FC<HighlightProps> = ({ 
  text, 
  searchTerms, 
  highlightStyle 
}) => {
  if (!text || searchTerms.length === 0) {
    return <>{text}</>;
  }

  // Filtrar términos vacíos y crear patrón regex
  const validTerms = searchTerms
    .filter(term => term && term.trim().length > 0)
    .map(term => escapeRegExp(term.trim()));

  if (validTerms.length === 0) {
    return <>{text}</>;
  }

  // Crear regex para buscar todos los términos (case insensitive)
  const regex = new RegExp(`(${validTerms.join('|')})`, 'gi');

  // Dividir el texto en partes
  const parts = text.split(regex);

  // Estilo por defecto para highlight
  const defaultHighlightStyle: React.CSSProperties = {
    backgroundColor: '#ffeb3b',
    fontWeight: 'bold',
    padding: '1px 2px',
    borderRadius: '2px',
    color: '#000',
    ...highlightStyle
  };

  return (
    <>
      {parts.map((part, index) => {
        // Verificar si esta parte coincide con algún término de búsqueda
        const isMatch = validTerms.some(term => 
          part.toLowerCase() === term.toLowerCase()
        );

        return isMatch ? (
          <span key={index} style={defaultHighlightStyle}>
            {part}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
};

// Hook para obtener términos de búsqueda
export const useSearchTerms = (searchQuery: string, authorQuery: string) => {
  const searchTerms = React.useMemo(() => {
    const terms: string[] = [];
    
    // Agregar términos de búsqueda principal
    if (searchQuery && searchQuery.trim()) {
      // Dividir por espacios y filtrar términos cortos
      const queryTerms = searchQuery
        .trim()
        .split(/\s+/)
        .filter(term => term.length >= 2); // Solo términos de 2+ caracteres
      terms.push(...queryTerms);
    }
    
    // Agregar términos de autor
    if (authorQuery && authorQuery.trim()) {
      const authorTerms = authorQuery
        .trim()
        .split(/\s+/)
        .filter(term => term.length >= 2);
      terms.push(...authorTerms);
    }
    
    return terms;
  }, [searchQuery, authorQuery]);

  return searchTerms;
};

// Estilos predefinidos para diferentes tipos de highlight
export const highlightStyles = {
  title: {
    backgroundColor: '#4caf50',
    color: 'white',
    fontWeight: 'bold',
    padding: '2px 4px',
    borderRadius: '3px'
  },
  author: {
    backgroundColor: '#2196f3',
    color: 'white',
    fontWeight: 'bold',
    padding: '1px 3px',
    borderRadius: '2px'
  },
  abstract: {
    backgroundColor: '#ffeb3b',
    color: '#000',
    fontWeight: 'bold',
    padding: '1px 2px',
    borderRadius: '2px'
  },
  content: {
    backgroundColor: '#ff9800',
    color: 'white',
    fontWeight: 'bold',
    padding: '1px 3px',
    borderRadius: '2px'
  }
};

