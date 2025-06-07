import type {Documento} from '../types/Documento';

export const documentosMock: Documento[] = [
  {
    id: 1,
    titulo: 'Efectividad de las vacunas COVID-19',
    autor: 'Dra. Ana Pérez',
    fecha: '2021-06-15',
    resumen: 'Este estudio analiza la eficacia de las vacunas aplicadas en América Latina...'
  },
  {
    id: 2,
    titulo: 'Impacto del confinamiento en la salud mental',
    autor: 'Dr. Juan Gómez',
    fecha: '2020-12-05',
    resumen: 'La cuarentena ha generado efectos psicológicos significativos...'
  },
  {
    id: 3,
    titulo: 'Transmisión aérea del SARS-CoV-2',
    autor: 'Dra. Laura Rodríguez',
    fecha: '2022-01-10',
    resumen: 'Se presenta evidencia sobre la propagación del virus por aerosoles...'
  },
  {
    id: 4,
    titulo: 'Muertes por COVID-19',
    autor: 'Dra. Laura Rodríguez',
    fecha: '2022-03-10',
    resumen: 'Se presenta un conteo de muertes por COVID-19...'
  }
];
