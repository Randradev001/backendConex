const express = require('express');
const cors = require('cors');
const routes = require('./src/Router')
const app = express()
// const http = require('http');

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.json()) //permite el paso del payload en el body


const port = 8051;
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto: ${port}`);
});
  
const whiteList = ['http://appsgobm.com','http://localhost:3000'];
//app.use(cors({origin:whiteList}));
app.use(cors({origin:"*"}));

app.use('/backendDocker',routes);