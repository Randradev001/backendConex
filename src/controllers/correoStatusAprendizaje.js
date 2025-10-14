const { Resend } = require("resend");
// const conector = require("../conectorMysql/conectorMysql");
const { getPool } = require("../conectorMysql/conectorSqlServer");
const fs = require('fs');
const BodyCorreoTerminado = require('../MailTemplates/TemplateTerminoEnvio');
const BodyCorreo = require('../MailTemplates/TemplateAprendizaje');
const generarImages = require("../puppeteer/generarImg");
const moment = require('moment');
moment.locale('es');
const sql = require('mssql'); 


  // Versión async/await
const buscarCorreos = async () => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT APIMail, APIRut, APINombre
    FROM dbo.API_rvdata   
    WHERE APIEstado = 1
  `);

  return result.recordset; // array de filas: [{ correo: '...' }, ...]

};

  // Versión async/await
  const buscarCorreosAdm = async () => {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT APIMail, APIRut, APINombre
      FROM dbo.API_rvdata  
      WHERE APIAdm = 1
    `);
  
    return result.recordset; // array de filas: [{ correo: '...' }, ...]
  
  };

const updateEnvios = async (statusEnvio) => {
  const pool = await getPool();

  for (const item of statusEnvio) {
    try {
      await pool.request()
        .input('status', sql.Int, item.status)
        .input('mensaje', sql.VarChar, item.mensaje || null)
        .input('rut', sql.Int, item.rut)
        .query(`
          UPDATE API_rvdata
          SET APIEstado = @status,
              APIMSGEnvio = @mensaje,
              APIFecha = GETDATE()
          WHERE APIRut = @rut
        `);

      console.log(`✅ Actualizado: ${item.rut}`);
    } catch (err) {
      console.error(`❌ Error actualizando ${item.rut}:`, err.message);
    }
  }
};

const insertContadoresEnvio = async (enviados, errores) => {
  const pool = await getPool(); // asumiendo que tu getPool() retorna un pool de mssql

  const fecha = moment().format('YYYY-MM-DD');

  const result = await pool.request()
    .input('fecha', sql.Date, fecha)
    .input('enviados', sql.Int, enviados)
    .input('errores', sql.Int, errores)
    .query(`
      INSERT INTO API_ENV_INFO (API_ENV_FECHA, API_ENV_ENVIADOS, API_ENV_ERRORES) 
      VALUES (@fecha, @enviados, @errores)
    `);
    enviarCorreoIni(enviados, errores)
  return result;


};


/*
const enviarCorreo = async (req, res) => {
  const correosAEnviar = await buscarCorreos();
  console.log(correosAEnviar, 'trae desde tabla')
  let listaCorreos = [];  // correos para ser enviados

  correosAEnviar.forEach((correoReporte, index) => {
      listaCorreos.push({correo:correoReporte.APIMail, rut:correoReporte.APIRut, nombre:correoReporte.APINombre });
      if ((index + 1) % 5000 === 0 || index === correosAEnviar.length - 1) {
          // recorre hasta llegar al 50 y multiplos de 50
          enviarCorreoBatch(listaCorreos);
          listaCorreos = []; // reset al arreglo para la soguiente ronda
      }
  });
} */

  const enviarCorreo = async (req, res) => {
    try {
      const correosAEnviar = await buscarCorreos();
      console.log(correosAEnviar, 'trae desde tabla');
  
      let listaCorreos = [];
  
      for (let i = 0; i < correosAEnviar.length; i++) {
        const correoReporte = correosAEnviar[i];
        listaCorreos.push({
          correo: correoReporte.APIMail,
          rut: correoReporte.APIRut,
          nombre: correoReporte.APINombre
        });
  
        if ((i + 1) % 5000 === 0 || i === correosAEnviar.length - 1) {
          // aquí esperamos a que termine
          await enviarCorreoBatch(listaCorreos);
          listaCorreos = [];
        }
      }
  
      // devolvemos algo al cliente
      return res.json({
        ok: true,
        procesados: correosAEnviar.length,
        msg: "Envío de correos completado"
      });
  
    } catch (error) {
      console.error("Error en enviarCorreo:", error);
      return res.status(500).json({
        ok: false,
        error: error.message || "Error interno"
      });
    }
  };
  



const enviarCorreoBatch = async (listaCorreos) => {
  // const reporte = fs.readFileSync(`/src/img/reporteStatusAprendizaje/prueba.pdf`);
  // const reporteEX = fs.readFileSync(`/src/img/reporteStatusAprendizaje/reporte.xlsx`);
console.log(listaCorreos,'correos listos a enviar')
  const fs = require('fs');
  const path = require('path');
  const statusEnvio = [];
  let enviadosOk = 0;
  let enviadosError = 0;
  const resend = new Resend(process.env.RESEND);

  for(const{correo, rut, nombre} of listaCorreos){
  // Construye la ruta de forma dinámica

 /* const pdfPath = path.join(
    __dirname,             // C:\proyectos2025\BakcenDocker\backendDocker\src\controllers
    '..',                  // sube a src\
    'img',                 // entra a img\
    'reporteStatusAprendizaje',
   `${rut.trim()}.pdf`
  );

  const reporte = fs.readFileSync(pdfPath); */
  try {
    const { data, error } = await resend.emails.send({
      from: "Informaciones <no-reply@apenvios.com>",
      to: correo.trim(),
      subject: "Reporte de renta variable septiembre 2025",
      html: BodyCorreo(correo, rut, nombre),
      /* attachments: [{
          filename: `${rut.trim()}.pdf`,
          content: reporte,
      }] */
  });
  console.log(error , 'tyu - error');
  console.log(data, 'tyu- data');

  if (error) {
    enviadosError++;
    statusEnvio.push({
      rut,
      nombre,
      status: 3, // 3 = error
      mensaje: error.message || JSON.stringify(error),
    });
  } else {
    enviadosOk++;
    statusEnvio.push({
      rut,
      nombre,
      status: 2, // 2 = enviado OK
      mensaje:'E-mail fue enviado correctamente al destinatario' // data.id, // guardamos el ID del envío
    });
  }
} catch (err) {
  console.error(err, 'exception');
  statusEnvio.push({
    rut,
    nombre,
    status: 3,
    mensaje: err.message || String(err),
  });
}

  }

console.log(statusEnvio)
updateEnvios(statusEnvio)
insertContadoresEnvio(enviadosOk, enviadosError) 

}



const enviarCorreoIni = async (okEnviados,noEnviados
) => {
  const correosAEnviar = await buscarCorreosAdm();
  let listaCorreos = [];  // correos para ser enviados

  correosAEnviar.forEach((correoReporte, index) => {
      listaCorreos.push(correoReporte.APIMail.trim());
      if ((index + 1) % 50 === 0 || index === correosAEnviar.length - 1) {
          // recorre hasta llegar al 50 y multiplos de 50
          enviarCorreoBatchIni(listaCorreos, okEnviados, noEnviados);
          listaCorreos = []; // reset al arreglo para la soguiente ronda
      }
  });
}

const enviarCorreoBatchIni = async (listaCorreos, okEnviados, noEnviados) => {
console.log(listaCorreos, 'correos administrativos')

  const resend = new Resend(process.env.RESEND);

  const { data, error } = await resend.emails.send({
      from: "Informaciones <no-reply@apenvios.com>",
      to: listaCorreos,
      subject: "Termino de envio de correos masivos",
      html: BodyCorreoTerminado(okEnviados, noEnviados),
     
      
  });

}

  module.exports={
    enviarCorreo
   
  }