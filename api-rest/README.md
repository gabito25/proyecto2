# BioRxiv API

Este proyecto proporciona una API REST para acceder a datos de BioRxiv, permitiendo buscar y recuperar información de preprints científicos.

## Requisitos

- Node.js (v14 o superior)
- npm (v6 o superior)

## Instalación

```bash
# Clonar el repositorio
git clone [url-del-repositorio]

# Instalar dependencias
npm install
```

## Configuración

1. Copia el archivo `.env.example` a `.env`
2. Ajusta las variables de entorno según sea necesario

## Scripts Disponibles

- `npm run dev`: Inicia el servidor en modo desarrollo
- `npm run start`: Inicia el servidor en modo producción
- `npm run build`: Construye el proyecto
- `npm run test`: Ejecuta las pruebas
- `npm run lint`: Ejecuta el linter

## Estructura del Proyecto

```
.
├── api/            # Endpoints de la API
├── lib/            # Utilidades y funciones auxiliares
├── middleware/     # Middleware de Express
├── tests/          # Pruebas unitarias y de integración
└── config/         # Archivos de configuración
```

## Uso de la API

### Endpoints Disponibles

- `GET /api/papers`: Obtiene lista de papers
- `GET /api/papers/:id`: Obtiene un paper específico
- `GET /api/search`: Búsqueda de papers

Para más detalles sobre los endpoints, consulta la documentación de la API.

## Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la Licencia ISC. Ver el archivo `LICENSE` para más detalles. 