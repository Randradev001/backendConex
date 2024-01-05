class avisoAmonestacionMail{

    constructor(){      

    }

    setBody(datosCorreo){
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
                              <td style="padding-top: 7px;padding-left:7px"  class="imgHero">
                                <div>
                                    <img alt="" border="0" src="cid:logo_gobm" width="70" height="auto" style="display:block;color: #f9f9f9;">
                                </div>
                              </td>
                            </tr>                   
                             <tr>
                               <td style="padding-bottom: 10px;" align="center" valign="middle" class="emailLogo">
                                                         <h2 class="text" style="color:#000;font-family:Trebuchet MS, Lucida Sans Unicode, Lucida Grande, Lucida Sans, Arial, sans-serif;font-size:30px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:36px;text-transform:none;text-align:center;padding:0;margin:0"><small>Precaución con posible contratación</h2>
                               </td>
                             </tr>
                             <tr>
                              <td align="center" valign="top" class="imgHero">
                                
                                  <img alt="" border="0" src="cid:logo_accion" width="150" height="160" style="display:block;color: #f9f9f9;">
                              </td>
                            </tr>
                            <tr>
                            <td style="padding-bottom: 5px; padding-left: 20px; padding-right: 20px;" align="center" valign="top" class="mainTitle">
                              <h2 class="text" style="color:#000;font-family:Poppins,Helvetica,Arial,sans-serif;font-size:25px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:36px;text-transform:none;text-align:center;padding:0;margin:0">El/la trabajador(a) :<br><small> ${datosCorreo.nomContratador} ${datosCorreo.apeContratador}  </small></h2>
                            </td>
                          </tr>
                             <tr>
                               <td style="padding-bottom: 30px; padding-left: 20px; padding-right: 20px;" align="center" valign="top" class="subTitle">
                                 <h4 class="text" style="color:#999;font-family:Poppins,Helvetica,Arial,sans-serif;font-size:10px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:24px;text-transform:none;text-align:center;padding:0;margin:0"></h4>
                               </td>
                             </tr>
                             <tr>
                               <td style="padding-left:20px;padding-right:20px" align="center" valign="top" class="containtTable ui-sortable">
                                 <table border="0" cellpadding="0" cellspacing="0" width="100%" class="tableDescription" style="">
                                   <tbody>
                                   <tr>
                                   <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                     <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0">De la empresa <b>${datosCorreo.empContratador}</p>
                                   </td>
                                 </tr>
                                   <tr>
                                   <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                     <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0">Presentó posibles intenciones de habilitar y/o contratar a 
                                   </td>
                                 </tr>
                                   <tr>
                                   <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                     <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0"><b>${datosCorreo.nombreAmonestado}</b>
                                   </td>
                                 </tr>
                                 <tr>
                                 <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                   <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0">Rut <b>${datosCorreo.rutAmonestado} </b>
                                 </td>
                               </tr>
                                 <tr>
                                 <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                   <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0">El cual presenta una amonestación realizada el 
                                 </td>
                               </tr>
                                 <tr>
                                 <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                   <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0"><b> ${datosCorreo.fecAmonestacion} </b> 
                                 </td>
                               </tr>
                                   </tbody>
                                 </table>
                                 <table border="0" cellpadding="0" cellspacing="0" width="100%" class="tableDescription" style="">
                                   <tbody>
                                   <tr>
                                 <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                   <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0"><p>Si necesita ponerse en contacto con <b>${datosCorreo.nomContratador} ${datosCorreo.apeContratador}</b> </p>
                                 </td>
                               </tr>
                                   <tr>
                                 <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                   <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0"><p>Su correo electrónico es <b>${datosCorreo.emaContratador}</b></p>
                                 </td>
                               </tr>
                                   <tr>
                                 <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                   <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0"><p>Su número de teléfono es <b>${datosCorreo.numContratador}</b></p>
                                 </td>
                               </tr>
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
                            <td align="center" valign="top" class="imgHero">
                              
                              <img alt="" border="0" src="cid:logo_codelco" width="100" height="auto" style="display:block;color: #f9f9f9;">

                            </td>
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

}

module.exports=avisoAmonestacionMail;