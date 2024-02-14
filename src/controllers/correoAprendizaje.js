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

 
        correosAEnviar.map(correoReporte=>{
            listaCorreos.push(correoReporte.correo)
          })
    


  
    const reporte= fs.readFileSync(`/src/img/reporteAprendizaje/reporte.png`);


    const resend  = new Resend(process.env.RESEND);
   
       
    await new Promise(resolve => setTimeout(resolve, 10000));


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


  
}

  module.exports={
    enviarCorreo
   
  }