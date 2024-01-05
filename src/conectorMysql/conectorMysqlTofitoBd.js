require('dotenv').config();  //permite acceder a las variables de entorno
const mysql = require('mysql');

const conectorTofito = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USERBD,
    password: process.env.PASSWORD,
    database: process.env.DATABASETOFITO
})

module.exports= conectorTofito