const { Resend } = require("resend");
const conector = require("../conectorMysql/conectorMysql");
const fs = require('fs');
const buildPDF = require('../pdfKit/pdfKits');

const BodyCorreo = require('../MailTemplates/Template')




const buscarCorreosHallazgo=(id)=>{
  return new Promise(res=>{
    let sql=`
    SELECT mail 
    FROM hal_seg_correos
    WHERE fk_combina = ?
    AND est = 1
    `
    conector.query(sql,[id], (err, result) => {
      if (err) throw err;
        res(result)
    });
  })
}

const enviarCorreo = async(id, sector, tipo)=>{

  const correosValidadores = await buscarCorreosHallazgo(id)
  let correos=[]  // acá se almacenan los correos de los administradores para ser enviados

  // correos.push('imeri001@contratistas.codelco.cl');

  correosValidadores.map(correohAL=>{
    correos.push(correohAL.mail)
  })
  

  const pdfArchivo= tipo=== 1 ? fs.readFileSync(`/src/pdf/reporte_hallazgo_${id}.pdf`) : '';
  const logoGom= fs.readFileSync(`/src/img/logoGOM.png`);


  const resend  = new Resend(process.env.RESEND);

  const { data, error } = await resend.emails.send({
    from: "soporte@appsgobm.com",
    to: correos,
    subject: "Reporte hallazgo",
    html: BodyCorreo(sector, tipo),
    attachments: tipo === 1 ? 
    [
      {
        filename: `reporte_hallazgo_${id}.pdf`,
        content: pdfArchivo,
      },
      {
        filename: `logoGOM.png`,
        content: logoGom,
      },
    ]
    :
    [
      {
        filename: `logoGOM.png`,
        content: logoGom,
      }
    ]
  });



}




const buscaDatosPdf = async(id, mina, ctto, subctto, tipo)=>{

  return new Promise((res)=>{

    let filtroMina = '';
    let filtroArea = '';
    let filtroNivel = '';
    let filtroCtto = '';
    let filtroSubCtto = '';
    let filtroHorario = '';

    // Filtro por turno
    if(tipo ===1){
      filtroHorario = ` AND hal.fec_hor_ocurrencia BETWEEN CONCAT(CURDATE(), ' 8:00:00') AND CONCAT(CURDATE(), ' 20:00:00') `;
    }else{
      filtroHorario = ` AND hal.fec_hor_ocurrencia BETWEEN CONCAT(CURDATE() - INTERVAL 1 DAY, ' 20:00:00') AND CONCAT(CURDATE(), ' 8:00:00')`;
    }


    // Mina
    if(mina !==0){
      filtroMina = ` AND hal.fk_mina = ${mina} `;
    }else{
      filtroMina = ``;
    }

    // Area
    if(id===1 || id===2 || id===3){
      filtroArea = ` AND hal.fk_area IN (1, 2, 3, 10, 16, 17, 18, 20) `;
    }else if(id===6){
      filtroArea = ` AND hal.fk_area = 8 `;
    }else if(id===9){
      filtroArea = ` AND hal.fk_area = 27 `;
    }else{
      filtroArea = ``;
    }

    // Nivel
    if(id===1 || id===2){
      filtroNivel = ` AND hal.fk_nivel = 2 `;
    }else if(id===3 || id===4 || id===5){
      filtroNivel = ` AND hal.fk_nivel = 5 `;
    }else if(id===10 || id===12 || id===14 || id===15 || id===17 || id===19 || id===20){
      filtroNivel = ` AND hal.fk_nivel IN (1, 2) `;
    }else if(id===11 || id===13 || id===16 || id===18){
      filtroNivel = ` AND hal.fk_nivel = 9 `;
    }else{
      filtroNivel = ``;
    }

    // Contrato
    if(ctto !==0){
      filtroCtto = ` AND hal.num_ctto = ${ctto} `;
    }else{
      filtroCtto = ``;
    }
    
    // Subcontrato
    if(subctto !==0){
      filtroSubCtto = ` AND hal.fk_sub_ctto = ${subctto} `;
    }else{
      filtroSubCtto = ` AND hal.fk_sub_ctto = 0 `;
    }

    const sql = `SELECT
    hal.id,
    cla.nom AS clasificacion,
    jer.nom AS jerarquia,
    hal.fec_hor_ocurrencia AS fechorocurrencia,
    DATE_FORMAT(NOW(),'%d-%m-%Y') AS fechahoy,
    hal.des_obs,
    hal.tur_trabajo AS turno,
    min.nom AS mina,
    hal.ldh_postura AS postura,
    emp.nom_empre AS empresa,
    hal.num_ctto AS ctto,
    rch.nom AS riesgocritico,
    dccadc.Nombre AS nombreadc,
    dccing.Nombre AS nombreing,
    dccsup.Nombre AS nombresup,
    CASE
      WHEN hal.est_hallazgo =1 THEN 'Abierto'
      WHEN hal.est_hallazgo =2 THEN 'Cerrado'
      ELSE 'Desconocido'
    END AS detaestado,
    arcs.archivos
    FROM hal_seg_registros hal
    LEFT JOIN rep_mina min
    ON min.id = hal.fk_mina
    LEFT JOIN rep_area are
    ON are.id = hal.fk_area
    LEFT JOIN rep_nivel niv
    ON niv.id = hal.fk_nivel
    LEFT JOIN tbl_empre emp
    ON emp.rut_empre = hal.rut_empresa
    LEFT JOIN hal_seg_rc rch
    ON rch.id = hal.fk_rie_critico
    LEFT JOIN tofitobd.DotacionCC dccadc
    ON dccadc.Rut = hal.rut_adc_det
    LEFT JOIN tofitobd.DotacionCC dccing
    ON dccing.Rut = hal.rut_ing_res
    LEFT JOIN tofitobd.DotacionCC dccsup
    ON dccsup.Rut = hal.rut_tra_supervisor
    LEFT JOIN hal_seg_clasificacion cla
    ON cla.id = hal.fk_clasificacion
    LEFT JOIN hal_seg_jerarquia jer
    ON jer.id = hal.fk_jerarquia
    LEFT JOIN (
      SELECT 
      fk_hal_seg_reg, 
      REPLACE(GROUP_CONCAT(fil_ruta), "../hallazgo_seguridad/documentos", "") AS archivos
      FROM hal_seg_registros_files
      GROUP BY fk_hal_seg_reg
    ) arcs
    ON arcs.fk_hal_seg_reg = hal.id
    WHERE hal.vig_hallazgo = 1
    ${filtroMina}
    ${filtroArea}
    ${filtroNivel}
    ${filtroCtto}
    ${filtroSubCtto}
    ${filtroHorario}
    ORDER BY hal.id DESC
    `

    conector.query(sql, (err, result) => {
      if (err) throw err;
      res(result)
    });

  })


};


// 1
const buscarCombinaciones = ()=>{

  return new Promise((res)=>{

    const sql = `
    SELECT
    id, sector, id_mina AS mina, contrato AS ctto, id_subcontrato AS subctto
    FROM hal_seg_combina_correo
    WHERE est = 1
    `
  
    conector.query(sql, (err, result) => {
      if (err) throw err;
      res(result)
    });
    
  })

}



const enviarReporteHallazgo = async(tipo)=>{

  const resCombinaciones = await buscarCombinaciones();
  resCombinaciones.map(async(com) => {
    const datosPdf = await buscaDatosPdf(com.id, com.mina, com.ctto, com.subctto, tipo);
    if(datosPdf.length > 0){

      const {empresa, ctto, nombreadc, nombreing, nombresup, turno, mina, fechahoy} = datosPdf[0];

      const dataCabecera = [
        empresa,
        ctto,
        com.sector
      ];

      const dataFechaLugar = [
        fechahoy,
        turno,
        mina
      ];

      const dataResponsables = [
        nombreadc,
        nombreing,
        nombresup,
      ];

      const dataTabla = datosPdf.map(row => ([
        row.id, 
        row.clasificacion,
        row.des_obs,
        row.jerarquia,
        row.postura,
        row.riesgocritico,
        row.detaestado
      ]));

      const dataArchivos = datosPdf.map(row => ({
        ide: row.id, 
        fotos: row.archivos.split(',')
      }));

      buildPDF(
        com.id,
        dataCabecera,
        dataFechaLugar,
        dataResponsables,
        dataTabla,
        dataArchivos
      );

      setTimeout(() => {
        enviarCorreo(com.id, com.sector, 1)
      }, "1000");


    }else{

      setTimeout(() => {
        enviarCorreo(com.id, com.sector, 2)
      }, "1000");

    }
    
  });


}





module.exports={
  enviarCorreo,
  enviarReporteHallazgo
}