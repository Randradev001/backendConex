
const moment = require('moment');
moment.locale('es');

const BodyTermino=(correo, rut, nombre)=>{

    const body = `
   <!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Descargar Documento</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f8f8f8; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 8px;">
      <tr>
        <td style="text-align: center;">
          <h2 style="color: #333333;">${nombre}</h2>
          <p style="color: #555555; font-size: 16px;">
            
Adjunto encontrara detalle de cálculo de Renta variable, correspondiente a remuneración del mes de ${moment().locale("es").format("MMMM YYYY")}.
El presente documento, detalla incentivos, que componen renta variable que percibe en el periodo antes detallado, en acuerdo a las disposiciones establecidas por PROCESADORA DE ALIMENTOS DEL SUR LTDA.

          </p>
          <a href="https://www.fsolidario.cl/documentos/8059134.pdf"
             style="display: inline-block; padding: 12px 24px; margin-top: 20px;
                    background-color: #007BFF; color: #ffffff; text-decoration: none;
                    font-size: 16px; border-radius: 6px;"
             target="_blank">
            Descargar PDF
          </a>
          <p style="color: #777777; font-size: 14px; margin-top: 20px;">
            Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
            <a href="https://www.fsolidario.cl/documentos/8059134.pdf" style="color: #007BFF;">
              https://www.fsolidario.cl/documentos/8059134.pdf
            </a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
    `
 return body;
}
module.exports=BodyTermino;




