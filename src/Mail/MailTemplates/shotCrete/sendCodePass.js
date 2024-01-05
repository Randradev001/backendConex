  class sendCodePass{

      constructor(){      

      }

      setBody(codigo){
        
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
                                 <td style="padding-bottom: 10px;" align="center" valign="middle" class="emailLogo">
                                                           <h2 class="text" style="color:#000;font-family:Trebuchet MS, Lucida Sans Unicode, Lucida Grande, Lucida Sans, Arial, sans-serif;font-size:30px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:36px;text-transform:none;text-align:center;padding:0;margin:0"><small>Reestablecimiento de contraseña </h2>
                                 </td>
                               </tr>
                               <tr>
                                 <td style="padding-bottom: 5px; padding-left: 20px; padding-right: 20px;" align="center" valign="top" class="mainTitle">
                                   <h2 class="text" style="color:#000;font-family:Poppins,Helvetica,Arial,sans-serif;font-size:25px;font-weight:500;font-style:normal;letter-spacing:normal;line-height:36px;text-transform:none;text-align:center;padding:0;margin:0">Su código es :<br>${codigo}</h2>
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
                                           <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:16px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0">Ingrese este código en la app de hormigones para poder reestablecer su contraseña</p>
                                         </td>
                                       </tr>
                                     </tbody>
                                   </table>
                                   <table border="0" cellpadding="0" cellspacing="0" width="100%" class="tableDescription" style="">
                                     <tbody>
                                       <tr>
                                         <td style="padding-bottom: 20px;" align="center" valign="top" class="description">
                                           <p class="text" style="color:#666;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:22px;text-transform:none;text-align:center;padding:0;margin:0">Si usted no ha solicitado este código solo ignore este correo.</p>
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
                                   <p class="text" style="color:#bbb;font-family:Open Sans,Helvetica,Arial,sans-serif;font-size:12px;font-weight:400;font-style:normal;letter-spacing:normal;line-height:20px;text-transform:none;text-align:center;padding:0;margin:0">Este es un correo electrónico generado de forma automática; por favor no lo responda.</p>
                                 </td>
                               </tr>
                               <tr>
                                 <td style="font-size:1px;line-height:1px" height="15">&nbsp;</td>
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

module.exports=sendCodePass;