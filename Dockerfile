FROM node:alpine3.18

WORKDIR /

COPY package*.json ./


RUN npm install
# Descargar e instalar Google Chrome
RUN curl -LO https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
RUN apt-get install -y ./google-chrome-stable_current_amd64.deb
RUN rm google-chrome-stable_current_amd64.deb 

# Establecer la variable de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

COPY . .

CMD ["npm", "start"]