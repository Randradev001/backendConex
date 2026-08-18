require('./src/config/loadEnv');
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
  .map((origin) => origin.trim())
  .filter(Boolean);

const isDevelopmentOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production') return false;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    const isLocalHost = host === 'localhost' || host === '::1' || host.startsWith('127.');
    const isPrivateNetwork = host.startsWith('10.') || host.startsWith('192.168.')
      || /^172\.(1[6-9]|2\d|3[01])\./.test(host);

    return ['http:', 'https:'].includes(url.protocol) && (isLocalHost || isPrivateNetwork);
  } catch {
    return false;
  }
};

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isDevelopmentOrigin(origin)) return callback(null, true);
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  }
}));

app.use('/backendDocker',routes);



// const { CronJob } = require('cron');

// const tareasCron =  new CronJob('0 30 18 * * *',()=>{
//   console.log('pruebaCron')
// });

// tareasCron.start()

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

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Servidor corriendo en puerto: ${port}`);
});

