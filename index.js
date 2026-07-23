require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./src/Router')
const app = express()
// const envioReporte = require('./src/controllers/correoController')
// const http = require('http');

var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(express.json()) //permite el paso del payload en el body
app.get('/ping', (req, res) => {
  res.send('Servidor responde ✅');
});


const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3001,http://127.0.0.1:3001,http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  }
}));

app.use('/backendDocker',routes);



// const { CronJob } = require('cron');

// const tareasCron =  new CronJob('0 30 18 * * *',()=>{
//   console.log('pruebaCron')
// });

// tareasCron.start()

const cron = require('node-cron');
const { enviarCorreo } = require('./src/controllers/correoStatusAprendizaje');

const dteRouter = require('./src/Router/dte.routes');
app.use('/dte', dteRouter);

/*
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
}); */

// Correo dias lunes aprendizaje '0 9 * * 1 '
//10 10 18 3 1 
 cron.schedule('03 02 04 10 *', () => {
  console.log('envio de correo 09:00')
  enviarCorreo()
 },{
 scheduled: true,
 timezone: "America/Santiago"
 }); 

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto: ${port}`);
});

