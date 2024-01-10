const express = require('express');
const cors = require('cors');
const routes = require('./src/Router')
const app = express()
const envioReporte = require('./src/controllers/correoController')
// const http = require('http');

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.json()) //permite el paso del payload en el body


app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en puerto: ${process.env.PORT}`);
});
  
const whiteList = ['http://appsgobm.com'];
//app.use(cors({origin:whiteList}));
app.use(cors({origin:"*"}));

app.use('/backendDocker',routes);



const { CronJob } = require('cron');


const tareasCron = new CronJob('10 11 * * *',()=>{
  envioReporte.enviarReporteHallazgo(1)
})

tareasCron.start()

