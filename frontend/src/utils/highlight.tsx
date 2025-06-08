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
  // ✅ VERIFICACIONES ADICIONALES AGREGADAS
  if (!text || typeof text !== 'string') {
    return <>{text || ''}</>;
  }

  if (!searchTerms || !Array.isArray(searchTerms) || searchTerms.length === 0) {
    return <>{text}</>;
  }

  // ✅ FILTRO MÁS ROBUSTO
  const validTerms = searchTerms
    .filter(term => {
      // Verificar que term existe, es string, y no está vacío
      return term && 
             typeof term === 'string' && 
             term.trim && 
             term.trim().length > 0;
    })
    .map(term => {
      try {
        return escapeRegExp(term.trim());
      } catch (error) {
        console.warn('Error escapando término:', term, error);
        return '';
      }
    })
    .filter(term => term.length > 0); // Filtrar términos vacíos después del escape

  if (validTerms.length === 0) {
    return <>{text}</>;
  }

  // ✅ TRY-CATCH PARA REGEX
  let parts;
  try {
    const regex = new RegExp(`(${validTerms.join('|')})`, 'gi');
    parts = text.split(regex);
  } catch (regexError) {
    console.warn('Error creando regex:', regexError);
    return <>{text}</>;
  }

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
        // ✅ VERIFICACIÓN ADICIONAL PARA PART
        if (part === null || part === undefined) {
          return null;
        }

        // Convertir a string si no lo es
        const partStr = String(part);

        // Verificar si esta parte coincide con algún término de búsqueda
        const isMatch = validTerms.some(term => {
          try {
            return partStr.toLowerCase() === term.toLowerCase();
          } catch (error) {
            return false;
          }
        });

        return isMatch ? (
          <span key={index} style={defaultHighlightStyle}>
            {partStr}
          </span>
        ) : (
          partStr
        );
      })}
    </>
  );
};

// Hook para obtener términos de búsqueda
export const useSearchTerms = (searchQuery: string, authorQuery: string) => {
  const searchTerms = React.useMemo(() => {
    const terms: string[] = [];
    
    // ✅ VERIFICACIONES MÁS ROBUSTAS
    try {
      // Agregar términos de búsqueda principal
      if (searchQuery && 
          typeof searchQuery === 'string' && 
          searchQuery.trim && 
          searchQuery.trim()) {
        
        const queryTerms = searchQuery
          .trim()
          .split(/\s+/)
          .filter(term => {
            return term && 
                   typeof term === 'string' && 
                   term.trim && 
                   term.trim().length >= 2;
          });
        terms.push(...queryTerms);
      }
      
      // Agregar términos de autor
      if (authorQuery && 
          typeof authorQuery === 'string' && 
          authorQuery.trim && 
          authorQuery.trim()) {
        
        const authorTerms = authorQuery
          .trim()
          .split(/\s+/)
          .filter(term => {
            return term && 
                   typeof term === 'string' && 
                   term.trim && 
                   term.trim().length >= 2;
          });
        terms.push(...authorTerms);
      }
    } catch (error) {
      console.warn('Error procesando términos de búsqueda:', error);
      return [];
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
