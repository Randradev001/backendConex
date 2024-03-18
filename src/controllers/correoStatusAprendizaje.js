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



  const enviarCorreo=async()=>{
     
    

    const correosAEnviar = await buscarCorreos()
    let listaCorreos=[]  // acá se almacenan los correos de los administradores para ser enviados

 /*
        correosAEnviar.map(correoReporte=>{
            listaCorreos.push(correoReporte.correo)
          }) */

     for (let index = 0; index < 50; index++) {
      listaCorreos.push('randr014@contratistas.codelco.cl')
     }     

  
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


  module.exports={
    enviarCorreo
   
  }