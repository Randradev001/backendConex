const Body=(sector, tipo)=>{

      let detalle = '';
      
      if(tipo === 1){
        detalle=`<td style="padding-bottom: 20px;" align="center" valign="top" class="description">Adjunto al correo encontrarás el reporte de hallazgos generados durante el turno. También puedes revisar el detalle de los hallazgos directamente desde la <a href='http://appsgobm.com/web/hallazgo_seguridad/listadoHalla' download>aplicación</a></td>`;
      }else{
        detalle=`<td style="padding-bottom: 20px;" align="center" valign="top" class="description">No existen hallazgos generados durante el turno. De todas maneras puedes revisar el detalle de los hallazgos anteriores directamente desde la <a href='http://appsgobm.com/web/hallazgo_seguridad/listadoHalla' download>aplicación</a></td>`;
      }


    const body = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
    </head>
    <style>
    
    </style>
    <body>
        <!-- © 2022 Shift Technologies. All rights reserved. -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f9f9f9" id="bodyTable">
      <tbody>
        <tr>
          <td style="padding-right:10px;padding-left:10px;" align="center" valign="top" id="bodyCell">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" class="wrapperBody" style="max-width:600px">
              <tbody>
                <tr>
                  <td align="center" valign="top">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="tableCard" style="background-color:#fff;border-color:#e5e5e5;border-style:solid;border-width:0 1px 1px 1px;">
                      <tbody>
                        <tr>
                          <td style="background-color:#f47600;font-size:1px;line-height:3px" class="topBorder" height="3">&nbsp;</td>
                        </tr> 
                        <tr>
                      </tr>                   
                        <tr>
                          <td style="padding-bottom: 10px;" align="center" valign="middle" class="emailLogo">
                            <h2 class="text" style="color:#000;font-family:Trebuchet MS, Lucida Sans Unicode, Lucida Grande, Lucida Sans, Arial, sans-serif;font-size:30px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:36px;text-transform:none;text-align:center;padding:0;margin:0"><small>Hallazgos de seguridad </h2>
                          </td>
                        </tr>
                        <tr>
                          <td align="center" valign="top" class="imgHero">
                            <img alt="" border="0" src="logoGOM.png" width="100" height="110" style="display:block;color: #f9f9f9;">
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-bottom: 5px; padding-left: 20px; padding-right: 20px;" align="center" valign="top" class="mainTitle">
                            <h3 class="text" style="color:#000;font-family:Poppins,Helvetica,Arial,sans-serif;font-size:20px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:36px;text-transform:none;text-align:center;padding:0;margin:0">${sector}</h3>
                          </td>
                        </tr> 
                        <tr>
                          <td style="padding-bottom: 30px; padding-left: 20px; padding-right: 20px;" align="center" valign="top" class="subTitle">
                            <h4 class="text" style="color:#000;font-family:Poppins,Helvetica,Arial,sans-serif;font-size:15px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:24px;text-transform:none;text-align:center;padding:0;margin:0">Reporte de hallazgos de seguridad generados durante el turno</h4>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding-left:20px;padding-right:20px" align="center" valign="top" class="containtTable ui-sortable">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" class="tableDescription" style="">
                              <tbody>
                                <tr>
                                  ${detalle}
                                </tr>
                                <tr>
                                <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                  Nota: Para ingresar debes iniciar sesión en la <a href='http://appsgobm.com/web/hallazgo_seguridad/listadoHalla' download>APPSGOBM</a> previamente.
                                </td>
                                </tr>
                              </tbody>
                            </table>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" class="tableDescription" style="">
                              <tbody>
                                <!-- <tr>
                                  <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                    <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0">Si usted no ha solicitado este código solo ignore este correo.</p>
                                  </td>
                                </tr> -->
                              </tbody>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size:1px;line-height:1px" height="20">&nbsp;</td>
                        </tr>
                      </tbody>
                    </table>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="space">
                      <tbody>
                        <tr>
                          <td style="font-size:1px;line-height:1px" height="30">&nbsp;</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>
            <table border="0" cellpadding="0" cellspacing="0" width="100%" class="wrapperFooter" style="max-width:600px">
              <tbody>
                <tr>
                  <td align="center" valign="top">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" class="footer">
                      <tbody>
                        
                        <tr>
                          <td style="padding: 10px 10px 5px;" align="center" valign="top" class="brandInfo">
                            <p class="text" style="color:#bbb;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:20px;text-transform:none;text-align:center;padding:0;margin:0">©&nbsp; APPSGOBM - GERENCIA DE OBRAS MINAS</p>
                          </td>
                        </tr>
    
                        <tr>
                          <td style="padding: 0px 10px 10px;" align="center" valign="top" class="footerEmailInfo">
                            <p class="text" style="color:#bbb;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:20px;text-transform:none;text-align:center;padding:0;margin:0">Este es un correo electrónico generado de forma automática, por favor no lo responda.</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="font-size:1px;line-height:1px" height="15">&nbsp;</td>
                        </tr>
                        <tr>
                    </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="font-size:1px;line-height:1px" height="30">&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
    </body>
    </html>
    `
      return body;
    }

module.exports=Body;




