'use strict';
/**
 * Define TODO el contenido editable de la invitación.
 * El panel de administración se construye automáticamente a partir de esta lista,
 * y los valores por defecto (def) se guardan en la tabla "settings" la primera vez.
 *
 * Tipos de campo: text, textarea, image, audio, mapsurl, coord, datetime, tz, range, select, phone
 */

const FONT_OPTIONS = [
  ['Pinyon Script', 'Pinyon Script (caligrafía formal y elegante)'],
  ['Great Vibes', 'Great Vibes (caligrafía fluida)'],
  ['Italianno', 'Italianno (caligrafía fina y moderna)'],
  ['Playfair Display', 'Playfair Display (cursiva editorial, estilo revista de lujo)'],
];

const GROUPS = [
  {
    id: 'gate', tab: 'content', title: '1. Pantalla "Activar ubicación"',
    fields: [
      { key: 'gate_title', label: 'Título', type: 'text', def: 'Activa tu ubicación' },
      { key: 'gate_text', label: 'Texto explicativo', type: 'textarea', def: 'Para mostrarte cómo llegar a la celebración necesitamos acceder a la ubicación de tu dispositivo.' },
      { key: 'gate_button', label: 'Texto del botón', type: 'text', def: 'Activar ubicación' },
    ],
  },
  {
    id: 'envelope', tab: 'content', title: '2. Sobre y sello de cera',
    fields: [
      { key: 'env_title', label: 'Texto sobre el sobre', type: 'text', def: 'Estás invitado' },
      { key: 'env_hint', label: 'Indicación debajo del sobre', type: 'text', def: 'Toca el sello para abrir tu invitación' },
      { key: 'seal_text', label: 'Texto dentro del sello (1 a 3 caracteres)', type: 'text', def: '26', max: 4 },
    ],
  },
  {
    id: 'header', tab: 'content', title: '3. Encabezado (gorro y título)',
    fields: [
      { key: 'cap_text', label: 'Texto bajo el gorro de graduado', type: 'text', def: 'Promoción 2026' },
      { key: 'title', label: 'Título principal', type: 'text', def: 'Mi Graduación' },
      { key: 'title_font', label: 'Tipo de letra del título', type: 'select', options: FONT_OPTIONS, def: 'Pinyon Script' },
    ],
  },
  {
    id: 'block1', tab: 'content', title: '4. Presentación (imagen izquierda + texto derecha)',
    fields: [
      { key: 'block1_image', label: 'Imagen (izquierda)', type: 'image', def: '/img/ejemplo-retrato.svg' },
      { key: 'block1_text', label: 'Texto (derecha)', type: 'textarea', def: 'Con mucha alegría te invito a compartir conmigo uno de los días más importantes de mi vida. Después de años de esfuerzo, llegó el momento de celebrar juntos este logro.' },
    ],
  },
  {
    id: 'loc1', tab: 'content', title: '5. Primera ubicación (colegio)',
    fields: [
      { key: 'loc1_title', label: 'Título', type: 'text', def: 'Ubicación del colegio' },
      { key: 'loc1_maps_url', label: 'Enlace de Google Maps', type: 'mapsurl', def: '', help: 'Pega el enlace del lugar (también funcionan los enlaces cortos maps.app.goo.gl). Al guardar se calculan las coordenadas.' },
      { key: 'loc1_label', label: 'Nombre del lugar (se muestra bajo el mapa)', type: 'text', def: 'Colegio (lugar de ejemplo: cámbialo en el panel)' },
      { key: 'loc1_lat', label: 'Latitud (se rellena sola)', type: 'coord', axis: 'lat', def: '-17.3895' },
      { key: 'loc1_lng', label: 'Longitud (se rellena sola)', type: 'coord', axis: 'lng', def: '-66.1568' },
    ],
  },
  {
    id: 'countdown', tab: 'content', title: '6. Cuenta regresiva',
    fields: [
      { key: 'countdown_title', label: 'Título', type: 'text', def: 'Faltan' },
      { key: 'countdown_date', label: 'Fecha y hora del evento', type: 'datetime', def: '2026-12-11T12:30' },
      { key: 'countdown_tz', label: 'Zona horaria de esa hora (Bolivia = -04:00)', type: 'tz', def: '-04:00' },
      { key: 'cd_days', label: 'Etiqueta "días"', type: 'text', def: 'Días' },
      { key: 'cd_hours', label: 'Etiqueta "horas"', type: 'text', def: 'Horas' },
      { key: 'cd_minutes', label: 'Etiqueta "minutos"', type: 'text', def: 'Minutos' },
      { key: 'cd_seconds', label: 'Etiqueta "segundos"', type: 'text', def: 'Segundos' },
      { key: 'countdown_done_text', label: 'Texto cuando llegue la fecha', type: 'text', def: '¡Llegó el gran día!' },
    ],
  },
  {
    id: 'block2', tab: 'content', title: '7. Segunda imagen + texto',
    fields: [
      { key: 'block2_image', label: 'Imagen', type: 'image', def: '/img/ejemplo-horizontal.svg' },
      { key: 'block2_text', label: 'Texto (debajo de la imagen)', type: 'textarea', def: 'Después de la ceremonia te esperamos para brindar, comer y celebrar en un ambiente muy especial. Tu presencia es el mejor regalo.' },
    ],
  },
  {
    id: 'loc2', tab: 'content', title: '8. Segunda ubicación (celebración)',
    fields: [
      { key: 'loc2_title', label: 'Título', type: 'text', def: 'Ubicación de la celebración' },
      { key: 'loc2_maps_url', label: 'Enlace de Google Maps', type: 'mapsurl', def: '', help: 'Pega el enlace del lugar. Al guardar se calculan las coordenadas.' },
      { key: 'loc2_label', label: 'Nombre del lugar (se muestra bajo el mapa)', type: 'text', def: 'Salón de eventos (lugar de ejemplo: cámbialo en el panel)' },
      { key: 'loc2_lat', label: 'Latitud (se rellena sola)', type: 'coord', axis: 'lat', def: '-17.4128' },
      { key: 'loc2_lng', label: 'Longitud (se rellena sola)', type: 'coord', axis: 'lng', def: '-66.1390' },
      { key: 'route_button_text', label: 'Texto del botón "cómo llegar" (ambos mapas)', type: 'text', def: 'Abrir ruta en Google Maps' },
    ],
  },
  {
    id: 'gallery', tab: 'content', title: '9. Galería de recuerdos (el título; las fotos están en la pestaña Carrusel)',
    fields: [
      { key: 'gallery_title', label: 'Título', type: 'text', def: 'Galería de recuerdos' },
    ],
  },
  {
    id: 'rsvp', tab: 'content', title: '10. Confirmación de asistencia',
    fields: [
      { key: 'rsvp_title', label: 'Título', type: 'text', def: 'Confirmación de asistencia' },
      { key: 'rsvp_intro', label: 'Texto introductorio', type: 'textarea', def: 'Cuéntanos si podrás acompañarnos.' },
      { key: 'rsvp_name_label', label: 'Etiqueta del nombre', type: 'text', def: 'Nombre completo' },
      { key: 'rsvp_name_placeholder', label: 'Texto de ayuda en el campo nombre', type: 'text', def: 'Escribe tu nombre' },
      { key: 'rsvp_attend_label', label: 'Pregunta de asistencia', type: 'text', def: '¿Asistirá?' },
      { key: 'rsvp_yes_label', label: 'Opción "sí"', type: 'text', def: 'Sí, ahí estaré' },
      { key: 'rsvp_no_label', label: 'Opción "no"', type: 'text', def: 'No podré asistir' },
      { key: 'rsvp_companions_label', label: 'Etiqueta de acompañantes', type: 'text', def: 'Número de acompañantes (opcional)' },
      { key: 'rsvp_button', label: 'Texto del botón', type: 'text', def: 'Confirmar asistencia' },
      { key: 'rsvp_success', label: 'Mensaje al confirmar', type: 'text', def: '¡Gracias por confirmar! Te esperamos.' },
      { key: 'rsvp_success_no', label: 'Mensaje si no asistirá', type: 'text', def: 'Gracias por avisarnos. ¡Te vamos a extrañar!' },
    ],
  },
  {
    id: 'contact', tab: 'content', title: '11. Contacto',
    fields: [
      { key: 'contact_title', label: 'Título', type: 'text', def: 'Contacto' },
      { key: 'contact_whatsapp', label: 'Número de WhatsApp (con código de país, ej. 59170000000)', type: 'phone', def: '59170000000' },
      { key: 'contact_whatsapp_label', label: 'Texto del botón de WhatsApp', type: 'text', def: 'Escríbeme por WhatsApp' },
      { key: 'contact_text', label: 'Texto debajo de WhatsApp', type: 'textarea', def: 'Ante cualquier duda, estoy a un mensaje de distancia.' },
    ],
  },
  {
    id: 'farewell', tab: 'content', title: '12. Mensaje de despedida',
    fields: [
      { key: 'farewell_text', label: 'Mensaje', type: 'textarea', def: 'Gracias por ser parte de este logro. Cada paso que di fue más fácil con personas como tú a mi lado.' },
      { key: 'farewell_image', label: 'Imagen de fondo', type: 'image', def: '/img/ejemplo-fondo.svg' },
      { key: 'farewell_opacity', label: 'Opacidad de la imagen de fondo (%)', type: 'range', def: '45' },
    ],
  },
  {
    id: 'footer', tab: 'content', title: '13. Pie de página',
    fields: [
      { key: 'footer_text', label: 'Derechos de autor', type: 'text', def: '© 2026 Luis Bustamante. Todos los derechos reservados.' },
      { key: 'admin_link_text', label: 'Texto del enlace pequeño al panel', type: 'text', def: 'administración' },
    ],
  },
  {
    id: 'music', tab: 'music', title: 'Música de la invitación',
    fields: [
      { key: 'music_file', label: 'Archivo de audio (MP3, M4A, OGG o WAV)', type: 'audio', def: '/audio/ejemplo.wav' },
      { key: 'music_volume', label: 'Volumen inicial (%)', type: 'range', def: '60' },
    ],
  },
];

const FIELDS = GROUPS.flatMap((g) => g.fields);
const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

module.exports = { GROUPS, FIELDS, FIELD_BY_KEY, FONT_OPTIONS };
