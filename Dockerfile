FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=3000 TRUST_PROXY=1
EXPOSE 3000
# Monta un volumen en /app/data si quieres separar la base; por defecto usa /app/invitacion.db y /app/uploads
CMD ["node", "server.js"]
