
const moment = require('moment');
moment.locale('es');

const Body=(okEnviados, noEnviados)=>{
console.log('entro al termino')
    const body = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Status Envío Masivo</title>
  </head>
  <body style="font-family: Arial, sans-serif; background-color: #f8f8f8; padding: 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; margin: auto; background-color: #ffffff; padding: 20px; border-radius: 8px;">
      <tr>
        <td style="text-align: center;">
          <h2 style="color: #333333;">Status envío masivo del día ${moment().locale("es").format("DD/MM/YYYY")}</h2>
          <p style="color: #555555; font-size: 16px; line-height: 1.5;">
            Enviados correctos: <strong style="color: green;">${okEnviados}</strong><br>
            Enviados con errores: <strong style="color: red;">${noEnviados}</strong>
          </p>
          <p style="color: #777777; font-size: 14px; margin-top: 20px;">
            Este reporte corresponde al estado de los correos enviados de manera automática en la fecha indicada.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
    `
 return body;
}
module.exports=Body;




