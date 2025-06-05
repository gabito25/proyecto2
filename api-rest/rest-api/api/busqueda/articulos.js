require('dotenv').config({ path: '.env.local' });

const clientPromise = require('../../lib/mongodb.js');
const { corsMiddleware } = require('../../middleware/cors.js');
const { requireAuth } = require('../../middleware/auth.js');
const { limpiarEntrada } = require('../../lib/validaciones.js');

module.exports = async function handler(req, res) {
  if (corsMiddleware(req, res)) return;
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      exito: false, 
      error: 'Método no permitido' 
    });
  }

  try {
    await requireAuth(req);

    const client = await clientPromise;
    const db = client.db('searchdb');
    const collection = db.collection('documents');

    const { 
      q = '', 
      pagina = 1, 
      limite = 20,
      categoria,
      tipo,
      autor,
      fecha,
      entidades
    } = req.query;

    const paginaNum = parseInt(pagina);
    const limiteNum = Math.min(parseInt(limite), 100);
    const skip = (paginaNum - 1) * limiteNum;

    const pipeline = [];

    if (q) {
      const busquedaLimpia = limpiarEntrada(q);
      pipeline.push({
        $search: {
          index: 'default',
          compound: {
            should: [
              {
                text: {
                  query: busquedaLimpia,
                  path: ['rel_title', 'rel_abs'],
                  fuzzy: { 
                    maxEdits: 1,
                    prefixLength: 3
                  },
                  score: { boost: { value: 2 } }
                }
              },
              {
                text: {
                  query: busquedaLimpia,
                  path: 'entities',
                  score: { boost: { value: 1.5 } }
                }
              },
              {
                text: {
                  query: busquedaLimpia,
                  path: ['author_name', 'category'],
                  score: { boost: { value: 1 } }
                }
              }
            ]
          },
          highlight: {
            path: ['rel_title', 'rel_abs']
          }
        }
      });

      pipeline.push({
        $addFields: {
          score: { $meta: "searchScore" },
          highlights: { $meta: "searchHighlights" }
        }
      });
    }

    const filtros = {};
    
    if (categoria) filtros.category = categoria;
    if (tipo) filtros.type = tipo;
    if (autor) filtros.author_name = { $regex: autor, $options: 'i' };
    if (fecha) filtros.rel_date = { $regex: `^\\d{2}/\\d{2}/${fecha}` };
    if (entidades) filtros.entities = { $in: entidades.split(',') };

    if (Object.keys(filtros).length > 0) {
      pipeline.push({ $match: filtros });
    }

    pipeline.push({
      $facet: {
        metadata: [
          { $count: 'total' },
          { $addFields: { 
            pagina: paginaNum,
            limite: limiteNum,
            totalPaginas: { $ceil: { $divide: ['$total', limiteNum] } }
          }}
        ],
        datos: [
          { $sort: q ? { score: -1 } : { rel_date: -1 } },
          { $skip: skip },
          { $limit: limiteNum },
          { $project: {
            _id: 1,
            rel_title: 1,
            rel_doi: 1,
            rel_link: 1,
            rel_abs: { $substr: ['$rel_abs', 0, 300] },
            author_name: 1,
            author_inst: 1,
            category: 1,
            type: 1,
            rel_date: 1,
            entities: { $slice: ['$entities', 10] },
            score: 1,
            highlights: 1
          }}
        ],
        facetas: [
          { $limit: 1000 },
          { $group: {
            _id: null,
            categorias: { $push: '$category' },
            tipos: { $push: '$type' },
            autores: { $push: '$author_name' },
            años: { 
              $push: { 
                $substr: ['$rel_date', 6, 4] 
              } 
            },
            entidadesArr: { $push: '$entities' }
          }},
          { $project: {
            categorias: 1,
            tipos: 1,
            autores: { $slice: ['$autores', 100] },
            años: 1,
            entidades: {
              $reduce: {
                input: '$entidadesArr',
                initialValue: [],
                in: { $setUnion: ['$$value', '$$this'] }
              }
            }
          }}
        ]
      }
    });

    const resultados = await collection.aggregate(pipeline).toArray();
    
    if (!resultados || resultados.length === 0) {
      return res.status(200).json({
        exito: true,
        datos: {
          total: 0,
          pagina: paginaNum,
          limite: limiteNum,
          totalPaginas: 0,
          resultados: [],
          facetas: {}
        }
      });
    }

    const metadata = resultados[0].metadata[0] || { 
      total: 0, 
      pagina: paginaNum, 
      limite: limiteNum,
      totalPaginas: 0 
    };
    
    const datos = resultados[0].datos || [];
    const facetasRaw = resultados[0].facetas[0] || {};

    const facetas = procesarFacetas(facetasRaw);

    res.status(200).json({
      exito: true,
      datos: {
        total: metadata.total,
        pagina: metadata.pagina,
        limite: metadata.limite,
        totalPaginas: metadata.totalPaginas,
        resultados: datos.map(doc => ({
          ...doc,
          resumen: doc.rel_abs + (doc.rel_abs?.length >= 300 ? '...' : '')
        })),
        facetas
      }
    });

  } catch (error) {
    console.error('Error en búsqueda:', error);
    res.status(error.message.includes('Token') ? 401 : 500).json({ 
      exito: false, 
      error: error.message || 'Error al realizar la búsqueda' 
    });
  }
};

function procesarFacetas(facetasRaw) {
  const facetas = {};
  
  if (facetasRaw.categorias) {
    facetas.categorias = contarYOrdenar(facetasRaw.categorias, 15);
  }
  
  if (facetasRaw.tipos) {
    facetas.tipos = contarYOrdenar(facetasRaw.tipos, 10);
  }
  
  if (facetasRaw.autores) {
    const autoresFlat = facetasRaw.autores.flat();
    facetas.autores = contarYOrdenar(autoresFlat, 20);
  }
  
  if (facetasRaw.años) {
    facetas.años = contarYOrdenar(facetasRaw.años, 10)
      .sort((a, b) => b.valor.localeCompare(a.valor));
  }
  
  if (facetasRaw.entidades) {
    facetas.entidades = facetasRaw.entidades
      .slice(0, 30)
      .map(e => ({ valor: e, cantidad: 1 }));
  }
  
  return facetas;
}

function contarYOrdenar(array, limite = 10) {
  const conteo = {};
  
  array.forEach(item => {
    if (item && item !== '') {
      conteo[item] = (conteo[item] || 0) + 1;
    }
  });
  
  return Object.entries(conteo)
    .map(([valor, cantidad]) => ({ valor, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limite);
}