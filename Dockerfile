

FROM node:24.22.3-alpine3.24

WORKDIR /app

RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates font-freefont

ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000
CMD ["node", "index.js"]
