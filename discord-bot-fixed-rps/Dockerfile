FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY . .
RUN adduser -D app && chown -R app:app /app
USER app
ENV TZ=Europe/Rome
CMD ["npm", "start"]
