FROM node:alpine3.18

WORKDIR /

COPY package*.json ./


RUN npm install
# Descargar e instalar Google Chrome
RUN apt-get update && apt-get install -y wget gnupg2 \
    && wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# Establecer la variable de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

COPY . .

CMD ["npm", "start"]