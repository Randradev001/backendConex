require('dotenv').config();  //permite acceder a las variables de entorno
const mysql = require('mysql');

const conectorDota = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USERBD,
    password: process.env.PASSWORD,
    database: process.env.DATABASEDOTA
})

module.exports= conectorDota