# Un'immagine minuscola: node, una libreria, un file.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY index.js ./
# Le credenziali NON stanno nell'immagine: arrivano dall'ambiente (vedi
# index.js e il file .env sul server, che non entra in git).
EXPOSE 8081
CMD ["node", "index.js"]
