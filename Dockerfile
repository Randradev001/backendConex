FROM node:alpine3.18

WORKDIR /

COPY package*.json ./

RUN npm install

COPY . .

CMD ["npm", "start"]