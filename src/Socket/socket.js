const socketio  = require('socket.io');
const conector = require('../conectorMysql/conectorMysql');


class Socket{
    constructor(){
       
        this.io = socketio( process.env.PORT_SOCKET,{
            path: "/backendRepo",
            cors:{
                origin:'*',
                methods:['GET','POST']
               }    
        });
         this.socketEvents()  
    }

    socketEvents(){
       
        this.io.on('connection',(socket)=>{    

                  
                    // acá los sockets respectivos
                  
         

        }) // cierra connection      
    }







}
module.exports=Socket;