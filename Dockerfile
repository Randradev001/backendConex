# Usar una imagen base de Node.js en Alpine
FROM node:alpine3.18
# Establecer el directorio de trabajo
WORKDIR /app
# Copiar los archivos de configuración de npm
COPY package*.json ./
# Instalar las dependencias de Node.js
RUN npm install
# Instalar Chromium y sus dependencias
RUN apk update && apk upgrade && \
    apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
# Establecer la variable de entorno para Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
# Copiar el resto del código de la aplicación
COPY . .
# Exponer el puerto que tu aplicación utiliza (si aplica)
EXPOSE 3000
# Comando para iniciar la aplicación
CMD ["npm", "start"]
