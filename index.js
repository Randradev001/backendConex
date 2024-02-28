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



// const { CronJob } = require('cron');

// const tareasCron =  new CronJob('0 30 18 * * *',()=>{
//   console.log('pruebaCron')
// });

// tareasCron.start()

const cron = require('node-cron');
const { enviarCorreo } = require('./src/controllers/correoStatusAprendizaje');


// Turno 1
cron.schedule('0 0 8 * * *', () => {
 // 	envioReporte.enviarReporteHallazgo(1)
},{
  scheduled: true,
  timezone: "America/Santiago"
});

// Turno 2
cron.schedule('0 0 20 * * *', () => {
 // envioReporte.enviarReporteHallazgo(2)
},{
scheduled: true,
timezone: "America/Santiago"
});

// Correo dias lunes aprendizaje '0 9 * * 1 '
cron.schedule('0 9 * * 1 ', () => {
  console.log('envio de correo 09:00')
  enviarCorreo()
 },{
 scheduled: true,
 timezone: "America/Santiago"
 });

