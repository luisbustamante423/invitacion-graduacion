# Cómo publicar la invitación con HTTPS

La ubicación del invitado SOLO funciona con HTTPS. Elige una opción:

## Opción A (la más rápida, para probar o para el día): Cloudflare Tunnel
1. Instala `cloudflared` en tu computadora.
2. En una terminal: `node server.js`
3. En otra: `cloudflared tunnel --url http://localhost:3000`
4. Te da una dirección `https://algo.trycloudflare.com`. Compártela. Tu computadora debe seguir encendida.

## Opción B: ngrok
`ngrok http 3000` → usa la dirección https que muestra.

## Opción C: hosting permanente (Render, Railway, Fly.io o un VPS)
- Sube esta carpeta (trae `Dockerfile`). Comando de inicio: `node server.js`.
- Variables: `TRUST_PROXY=1` (y `PORT` si el servicio lo pide).
- IMPORTANTE: el disco de muchos planes gratuitos se borra al reiniciar. Activa un **disco/volumen persistente**
  para `invitacion.db` y `uploads/`, o perderás confirmaciones y fotos subidas.
- Con VPS: Nginx + Let's Encrypt (certbot) delante de `node server.js`.

## Antes de compartir el enlace
1. Entra a `/admin` y cambia la contraseña `graduado`.
2. Sube tu MP3, fotos y pega los dos enlaces de Google Maps.
3. Abre el enlace https desde tu celular y prueba: ubicación → sello → música → mapas → confirmar asistencia.
