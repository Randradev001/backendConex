const socketio  = require('socket.io');
const conector = require('../conectorMysql/conectorMysql');
const jwt = require('jsonwebtoken');
const moment = require("moment");

class Socket{
    constructor(){
       
        this.io = socketio(8011,{
            path: "/reportabilidad",
            cors:{
                origin:'*',
                methods:['GET','POST']
               }    
        });
         this.socketEvents()  
    }

    socketEvents(){
       
        this.io.on('connection',(socket)=>{    
           // *************** PROYECTO REPORTABILIDAD GOBM *****************
                  socket.on('repAgregarAvance',()=>{  

                    this.io.emit('repAgregarAvance')                    
                  })
                  
                  socket.on('validaAvance',async(values)=>{ 
                  const {ctto,idAvance} = values
                  const users = await this.buscarIdUserPermisoPorCtto(ctto) 
                  const respuesta = await this.insertNotiFica(users,idAvance,1,null,null,'')
                   if(respuesta.affectedRows>0){
                        this.io.emit('avaValidados')           
                   }               

                  })

                  socket.on('notificaPAM',async({mesYear,sesion})=>{     
                                    
                    const {rut} = sesion  

                    const allUser = await this.buscarTodosUsuarios()
                    const mes=moment(mesYear).format('MM')
                    const year=moment(mesYear).format('YYYY')                   
                    const respuesta = await this.insertNotiFica(allUser,null,2,Number(mes),Number(year),rut)
                       this.io.emit('notificaPamResp',respuesta)   
                       
                  })


                  socket.on('notificaHito',async({mesYear,sesion})=>{ 
                    const {rut} = sesion                                 
                    const allUser = await this.buscarTodosUsuarios()
                    const mes=moment(mesYear).format('MM')
                    const year=moment(mesYear).format('YYYY')   
                            
                    const respuesta = await this.insertNotiFica(allUser,null,3,Number(mes),Number(year),rut)
                       this.io.emit('notificaHitoResp',respuesta)   
                       
                  })

                  socket.on('ingresoDV',()=>{ 
                       this.io.emit('actualizarHito') 
                  })

                  socket.on('ingresoHito',()=>{                     
                    this.io.emit('actualizarDV') 
                  })

                  

                  
                  
                  
            // *************** FIN PROYECTO REPORTABILIDAD GOBM *****************

        }) // cierra connection      
    }

    buscarIdUserPermisoPorCtto=(ctto)=>{
      const sql = `select
      per.*,
      usu.ctto_usu
      from rep_permiso per
      join tbl_usu usu on usu.rut_usu = per.rut
      where ctto_usu = ?`
      return new Promise(res=>{
        conector.query(sql,[ctto],(err,result)=>{
            if(err) throw err               
              res(result)             
           }) 
      })
    }

    insertNotiFica=(users,idAvance,tipoNoti,mes,year,rut)=>{
        let sql=''
        let rutFormat=''
         if(rut=='' || rut==undefined){
          rutFormat=null
         }else{
          rutFormat=`'${rut}'`
         }
        const ahora=moment().format('YYYY-MM-DD HH:mm:ss')
        if(users.length>0){   
               users.map((user,index)=>{                       
                  if(index===0){
                    sql=`insert into rep_notificaciones(fk_avance,fk_tip_noti,fk_rep_permiso,fec_hor_noti,est_noti,est,pam_mes,pam_year,res) values (${idAvance},${tipoNoti},${user.id},'${ahora}',0,0,${mes},${year},${rutFormat}),`
                  }else if(index!=0 && index!==users.length-1){
                    sql +=`(${idAvance},${tipoNoti},${user.id},'${ahora}',0,0,${mes},${year},${rutFormat}),`
                  }else if(index==users.length-1){
                    sql +=`(${idAvance},${tipoNoti},${user.id},'${ahora}',0,0,${mes},${year},${rutFormat})`
                  }                 
               })                
               return new Promise(res=>{
                conector.query(sql,(err,result)=>{
                    if(err) throw err               
                      res(result)             
                   }) 
            })
           
        }else{
            return 'No hay usuarios'
        } 
    }

    buscarTodosUsuarios=()=>{
      // todos los usuarios
      const sql='select * from rep_permiso'
       return new Promise(res=>{
        conector.query(sql,(err,result)=>{
          if(err) throw err               
            res(result)             
         }) 
       })
    }

}
module.exports=Socket;