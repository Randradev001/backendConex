const { Resend } = require("resend");
const conector = require("../conectorMysql/conectorMysql");
const fs = require('fs');

const BodyCorreo = require('../MailTemplates/TemplateAprendizaje')


const buscarCorreos=()=>{
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
}


/*
  const enviarCorreo=async()=>{
     
    

    const correosAEnviar = await buscarCorreos()
    let listaCorreos=[]  // acá se almacenan los correos de los administradores para ser enviados

 
        correosAEnviar.map(correoReporte=>{
            listaCorreos.push(correoReporte.correo)
          }) 

  

  
    const reporte= fs.readFileSync(`/src/img/reporteStatusAprendizaje/reporteStatus.png`);
    


    const resend  = new Resend(process.env.RESEND);
   

    const { data, error } = await resend.emails.send({
      from: "soporte@appsgobm.com",
      to: listaCorreos,
      subject: "Estatus general acciones correctivas GOM ",
      html: BodyCorreo(),
      attachments:
      [
        {
          filename: `reporte.png`,
          content: reporte,
        },
      ]
    
    });
    console.log(error, 'error')
    console.log(data, 'data')


  
}
*/

const enviarCorreo = async () => {
  const correosAEnviar = await buscarCorreos();
  let listaCorreos = [];  // correos para ser enviados

  correosAEnviar.forEach((correoReporte, index) => {
      listaCorreos.push(correoReporte.correo);
      if ((index + 1) % 50 === 0 || index === correosAEnviar.length - 1) {
          // recorre hasta llegar al 50 y multiplos de 50
          enviarCorreoBatch(listaCorreos);
          listaCorreos = []; // reset al arreglo para la soguiente ronda
      }
  });
}

const enviarCorreoBatch = async (listaCorreos) => {
  const reporte = fs.readFileSync(`/src/img/reporteStatusAprendizaje/reporteStatus.png`);

  const resend = new Resend(process.env.RESEND);

  const { data, error } = await resend.emails.send({
      from: "soporte@appsgobm.com",
      to: listaCorreos,
      subject: "Estatus general acciones correctivas GOM",
      html: BodyCorreo(),
      attachments: [{
          filename: `reporte.png`,
          content: reporte,
      }]
  });
  console.log(error, 'error');
  console.log(data, 'data');
}


  module.exports={
    enviarCorreo
   
  }