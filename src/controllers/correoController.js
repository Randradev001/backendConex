const { Resend } = require("resend");
const conector = require("../conectorMysql/conectorMysql");
const fs = require('fs');

const enviarCorreo = async(req , res)=>{

  // const sql = `select * from rh_permisos where rut='14.420.975-3'`;
  // conector.query(sql, [], (err, result) => {   
  //   if (err) throw err;   
  //     console.log(result)
  //   res.status(200).json(result);

  // });

 const pdfArchivo=  fs.readFileSync('/app/hallazgo.pdf');

const resend  = new Resend(process.env.RESEND);

    const { data, error } = await resend.emails.send({
        from: "soporte@appsgobm.com",
        to: ["cgala005@contratistas.codelco.cl"],
        subject: "Adjuntado pdf",
        html: "<strong>Prueba adjuntando pdf</strong>",
        attachments: [
          {
            filename: 'hallazgo.pdf',
            content: pdfArchivo,
            
          },
        ],
      });

      if (error) {
        return res.status(400).json({ error });
      }

      res.status(200).json({ data });

}


module.exports={
    enviarCorreo
}