const nodemailer = require('nodemailer');

  class MailServer{

      constructor(){      

          this.mailer = nodemailer.createTransport({
            service:'gmail',
            auth: {
              user: 'appsgobmsoporte@gmail.com',
              pass: 'knmrwznhmwhcmgfs',
            }


          })

      }

      enviarCorreo(paramsTo, subject, html,attachments){
        
            const correo =  this.mailer.sendMail({
                from: '"AppsGobm" <soporteGobm@gmail.com',
                to:paramsTo,
                subject:subject,
                text:'AppsGobm',
                html:html,
                attachments:attachments
            },function(err,info){
                if (err) {
                    console.log(err)
                }else{
                    return correo;
                }
            })

      }

}

module.exports=MailServer;