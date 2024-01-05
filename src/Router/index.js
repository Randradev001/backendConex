const router = require("express").Router();

const correoRouter = require("./enviarCorreo")
router.use('/enviarCorreo',correoRouter)

module.exports = router


// ejemplo de como usar cron

// const { CronJob } = require('cron');

// const tareasCron = new CronJob('*/1 * * * *',()=>{
//     console.log('acá la tarea a realizar')
//  })


//  tareasCron.start()
