const router = require('../../Router/router');
const conector = require('../../conectorMysql/conectorMysql');



router.get('/getUser',(req,res)=>{   
    const sql = 'select nom_usu from tbl_usu'
       conector.query(sql,(err,result)=>{
        if(err) throw err
        res.status(200).json(result)
       })
    

})
module.exports = router;