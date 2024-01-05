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


app.listen(process.env.PORT, () => {
  console.log(`Servidor corriendo en puerto: ${process.env.PORT}`);
});
  
const whiteList = ['http://appsgobm.com'];
//app.use(cors({origin:whiteList}));
app.use(cors({origin:"*"}));

app.use('/backendDocker',routes);




// ejemplo de como usar cron

// const { CronJob } = require('cron');

// const tareasCron = new CronJob('*/1 * * * *',()=>{
//     console.log('acá la tarea a realizar')
//  })


//  tareasCron.start()
