# Dockerfile
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# dipendenze
COPY package.json ./
RUN npm install --omit=dev && adduser -D app && mkdir -p /app/data && chown -R app:app /app

# codice
COPY --chown=app:app . .

USER app

# opzionale: timezone
ENV TZ=Europe/Rome

# il bot non espone porte; healthcheck usa i log
CMD ["npm", "start"]
