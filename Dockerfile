FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev && \
    apk update && apk add curl && \
    rm -rf /var/cache/apk/*

COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/index.js"]
