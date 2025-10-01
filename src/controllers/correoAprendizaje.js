const { Resend } = require("resend");
// const conector = require("../conectorMysql/conectorMysql");
const { getPool } = require("../conectorMysql/conectorSqlServer");
const fs = require('fs');

const BodyCorreo = require('../MailTemplates/TemplateAprendizaje');
const generarImages = require("../puppeteer/generarImg");


/* const buscarCorreos=()=>{
    return new Promise(res=>{
      let sql=`
      SELECT correo 
      FROM inc_correos
      WHERE est = 1
      `
      conector.query(sql, (err, result) => {
        if (err) throw err;
          res(result)
      });
    })
  } */

  // Versión async/await
const buscarCorreos = async () => {
  const pool = await getPool();
  const result = await pool.request().query(`
    SELECT correo
    FROM dbo.env_direcciones   
    WHERE estado = 1
  `);

  return result.recordset; // array de filas: [{ correo: '...' }, ...]

};


/*

  const enviarCorreoGenerado=async()=>{
     
    

    const correosAEnviar = await buscarCorreos()
    let listaCorreos=[]  // acá se almacenan los correos de los administradores para ser enviados

 
        correosAEnviar.map(correoReporte=>{
            listaCorreos.push(correoReporte.correo)
          })

  
    const reporte= fs.readFileSync(`/src/img/reporteAprendizaje/reporte.png`);


    const resend  = new Resend(process.env.RESEND);
   

    const { data, error } = await resend.emails.send({
      from: "soporte@appsgobm.com",
      to: listaCorreos,
      subject: "Aprendizaje de incidente GOM",
      html: BodyCorreo(),
      attachments:
      [
        {
          filename: `reporte.png`,
          content: reporte,
        },
      ]
    
    });
  
} */


const enviarCorreoGenerado = async (attachments) => {
  console.log('enviar correo', attachments)
  const correosAEnviar = await buscarCorreos();
  let listaCorreos = [];  // correos para ser enviados

  correosAEnviar.forEach((correoReporte, index) => {
      listaCorreos.push(correoReporte.correo);
      if ((index + 1) % 50 === 0 || index === correosAEnviar.length - 1) {
        console.log(listaCorreos, 'lista correos')
          // recorre hasta llegar al 50 y multiplos de 50
          enviarCorreoBatch(listaCorreos,attachments);
          listaCorreos = []; // reset al arreglo para la soguiente ronda
      }
  });
}

const enviarCorreoBatch = async (listaCorreos,attachments) => {
  const reporte= fs.readFileSync(`/src/img/reporteAprendizaje/reporte.png`);

  const resend = new Resend(process.env.RESEND);

  const { data, error } = await resend.emails.send({
      from: "soporte@appsgobm.com",
      to: listaCorreos,
      subject: "Aprendizaje de incidente GOM",
      html: BodyCorreo(),
      attachments:attachments
      /* [{
          filename: `reporte.png`,
          content: reporte,
      }] */
  });
  console.log(error, 'error');
  console.log(data, 'data');
}

// Función para generar la foto
const generaFoto = async (insertId) => {
  const imageBuffer = await generarImages({
    url: `${process.env.DOMINIO}/web/accionesCorrectivas/reporteCorreo?id=${insertId}`
  });
console.log(imageBuffer, 'buffer')
console.log(`${process.env.DOMINIO}/web/accionesCorrectivas/reporteCorreo?id=${insertId}`,'link')
  const attachments = [
    {
      filename: "reporte.png",
      content: imageBuffer,
      cid: "report",
    },
  ];

  return attachments;
};




const enviarCorreo = async (req, res) => {
  try {
    const insertId = req.body.insertId;
    console.log(req.body);

    const attachments = await generaFoto(insertId);
    
    await enviarCorreoGenerado(attachments);

    res.status(200).send('Correo enviado correctamente');
  } catch (error) {
    console.error('Error al enviar correo:', error);
    res.status(500).send('Error al enviar correo');
  }
};

module.exports = {
  enviarCorreo,
};


/*

const generaFoto=async(insertId)=>{

  const imageBuffer = await generarImages({
    url : `${process.env.DOMINIO}/web/accionesCorrectivas/reporteCorreo?id=${insertId}`
  })

  const attachments = [
    {
      filename: "reporte.png",
      content:imageBuffer,
      cid: "report",
    },
  ]
  console.log(attachments, 'atachccc')

 

};

const enviarCorreo = async (req, res) => {
  const  insertId  = req.body.insertId; 
  console.log(req.body)
  generaFoto(insertId)
  enviarCorreoGenerado(attachments)
 setTimeout(() => {
    enviarCorreoGenerado()
  }, "20000"); 
}
*/

  module.exports={
    enviarCorreo
   
  }