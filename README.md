# Invitación de graduación · Promoción 2026

Aplicación web con base de datos `invitacion.db`, sobre plomo con sello de cera, música, mapas con ruta,
cuenta regresiva, carrusel 3D, confirmación de asistencia y panel de administración.

## Cómo iniciarla

Necesitas **Node.js 22.13 o superior** (trae SQLite integrado; no hay que instalar nada más).

```bash
cd invitacion-graduacion
node server.js          # o: npm start
```

- Invitación: http://localhost:3000
- Administración: http://localhost:3000/admin  →  contraseña: `graduado` (sirve en mayúsculas, minúsculas o mezcladas)
- Otro puerto: `PORT=8080 node server.js` (en Windows PowerShell: `$env:PORT=8080; node server.js`)

Si tu Node es más antiguo: `npm install better-sqlite3` y el sistema lo usa automáticamente.

## IMPORTANTE: la ubicación necesita HTTPS

Los navegadores solo dejan activar la ubicación en páginas seguras:
- En tu computadora, `http://localhost` funciona.
- Desde el celular usando `http://192.168.x.x:3000` **no funciona** (el aviso de ubicación saldrá con error).
- Para probar en el celular o publicarla necesitas HTTPS: un hosting con certificado (Render, Railway, un VPS con Nginx + Let's Encrypt)
  o un túnel temporal (Cloudflare Tunnel / ngrok).
- Detrás de un proxy (Nginx, etc.) inicia con `TRUST_PROXY=1` para que el control de intentos use la IP real.

## Estructura

```
server.js            servidor y API (sin dependencias)
db.js                crea invitacion.db y sus tablas
schema.js            lista de TODO lo editable (el panel se arma solo a partir de aquí)
maps.js              saca coordenadas de enlaces de Google Maps
invitacion.db        base de datos (se crea sola si falta)
public/index.html    la invitación
public/css, js       diseño y lógica de la invitación
public/admin/        panel de administración
public/img, audio    imágenes y melodía de EJEMPLO
uploads/             lo que subas desde el panel (fotos y audio)
```

### Tablas de invitacion.db
| Tabla | Para qué |
|---|---|
| `settings` | todos los textos, imágenes, enlaces, fecha, WhatsApp, música, etc. |
| `carousel_images` | fotos del carrusel y su orden |
| `visits` | una fila por cada ingreso (aunque sea la misma persona), con si activó ubicación y si abrió el sobre |
| `rsvps` | confirmaciones: nombre, si asiste, acompañantes |
| `admin_sessions` | sesiones abiertas del panel |

## Qué se puede editar desde el panel (/admin)

- **Resumen:** confirmados (+acompañantes), pendientes, no asistirán, visitas totales, personas distintas,
  quiénes entraron más de una vez, aperturas del sobre, activaciones de ubicación, gráfica de 14 días y últimos ingresos.
- **Contenido:** pantalla de ubicación, sobre y sello, texto bajo el gorro, título y su tipo de letra, imagen izquierda + texto,
  ambas ubicaciones (pegando el enlace de Google Maps), cuenta regresiva (fecha, hora, etiquetas), segunda imagen + texto,
  título de la galería, formulario de confirmación, contacto/WhatsApp, mensaje de despedida (imagen + opacidad) y pie de página.
- **Carrusel:** agregar varias fotos a la vez, ordenarlas y eliminarlas.
- **Música:** subir el MP3 y fijar el volumen inicial.
- **Confirmaciones:** lista completa, con opción de eliminar.
- **Seguridad:** cambiar la contraseña.

## Notas de funcionamiento

- La ubicación del invitado se usa **solo en su navegador** para dibujar la ruta. No se guarda en la base de datos.
- "Pendientes" = personas (dispositivos) que entraron pero todavía no han respondido el formulario.
- La música arranca al tocar el sello (ese toque es el permiso que exigen los navegadores para el audio).
- Mapas: Leaflet + OpenStreetMap; ruta: servicio público OSRM; "Abrir ruta en Google Maps" es el respaldo.
  Todo esto requiere internet en el dispositivo del invitado.

## Pendiente por hacer (lo único que falta es tu contenido real y pruebas en dispositivos)

1. Entra a `/admin` (contraseña `graduado`) y **cámbiala** en la pestaña Seguridad.
2. Cambia título, textos, imágenes, WhatsApp, mensaje de despedida y sube tu MP3.
3. Pega los **dos enlaces de Google Maps** (colegio y celebración). Las coordenadas de ejemplo apuntan a Cochabamba.
4. Publica con **HTTPS** (la ubicación no funciona sin él, salvo en `localhost`).
5. Prueba mapas/ruta y música en un celular real (iPhone incluido) con internet y ubicación activada.
6. Haz copia de `invitacion.db` y de la carpeta `uploads/` de vez en cuando.
