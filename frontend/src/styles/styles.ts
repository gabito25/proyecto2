// Estilos
import type {CSSProperties} from "react";

export const container: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    backgroundColor: '#f8fafc',
    padding: '1rem',
    width: '100vw',
};



export const card: CSSProperties = {
    width: '100%',
    maxWidth: '700px',
    backgroundColor: '#ffffff',
    padding: '2rem',
    borderRadius: '16px',
    boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
    overflowY: 'auto',
    fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
    lineHeight: '1.6',
    color: '#333',
};

export const titulo: CSSProperties = {
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '1.5rem',
    color: '#1e293b',
};

export const resumen: CSSProperties = {
    marginTop: '1rem',
    marginBottom: '2rem',
    whiteSpace: 'pre-wrap',
};

export const botonVolver: CSSProperties = {
    marginTop: '2rem',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'background-color 0.3s',
};






export const searchBarContainer: CSSProperties = {
  marginBottom: '1rem',
  flexShrink: 0,
};

export const searchInput: CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  fontSize: '1rem',
  borderRadius: '8px',
  border: '1px solid #ccc',
  boxSizing: 'border-box',
};

export const contentContainer: CSSProperties = {
  display: 'flex',
  flex: 1,
  gap: '1rem',
  minHeight: "auto",
  overflow: 'hidden', // evita scroll aquí
};

export const sidebar: CSSProperties = {
  width: '200px',
  backgroundColor: '#fff',
  padding: '1rem',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  height: '100%',
  boxSizing: 'border-box',
  overflowY: 'auto',
};

export const selectStyle: CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  fontSize: '1rem',
  borderRadius: '6px',
  border: '1px solid #ccc',
  boxSizing: 'border-box',
};

export const mainContent: CSSProperties = {
  flex: 1,
  backgroundColor: '#fff',
  color: '#000000',
  padding: '1rem',
  borderRadius: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
  overflowY: 'auto',
  height: "auto",
  maxHeight: '100%'
};



export const logoutButtonStyle: CSSProperties = {
  marginTop: '1rem',
  width: '100%',
  padding: '0.5rem',
  fontSize: '1rem',
  borderRadius: '8px',
  border: 'none',
  backgroundColor: '#dc3545',
  color: '#fff',
  cursor: 'pointer',
};



export const cardStyle: CSSProperties = {
  backgroundColor: '#f9f9f9',
  padding: '1rem',
  borderRadius: '10px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  border: '1px solid #ddd',
};

export const verMasButtonStyle: CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.5rem 1rem',
  backgroundColor: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontWeight: 'bold',
  fontSize: '0.95rem',
};
