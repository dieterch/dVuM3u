FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/logos /data && chown -R node:node /app /data

ENV NODE_ENV=production
ENV PORT=3005

EXPOSE 3005

CMD ["node", "server.js"]
