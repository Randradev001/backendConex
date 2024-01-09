const PDFDocument = require('pdfkit-table');
const fs = require('fs');

const pathFotos = process.env.PATH_DOCUMENT_HALSEG;


function buildPDF(id, dataCabecera, dataFechaLugar, dataResponsables, dataTabla, dataArchivos){

    const doc = new PDFDocument({ margin: 18, size: 'A4' });

    const titulo = 'Reporte hallazgos de seguridad';
    const anchoPagina = doc.page.width;
    const posicionHor = (anchoPagina - doc.widthOfString(titulo)) / 2;

    let positionXPh = 18;
    let positionYPh = 45;

    let positionXTx = 18;
    let positionYTx = 34;

    const tablaCabecera = {
        headers: [
            { label:"Empresa", property: 'empresa', width: 220, renderer: null },
            { label:"Contrato", property: 'contrato', width: 70, renderer: null }, 
            { label:"Sector", property: 'sector', width: 265, renderer: null }, 
        ],
        rows: [dataCabecera]
    };

    const tablaFechaLugar = {
        headers: [
            { label:"Fecha", property: 'fecha', width: 70, renderer: null },
            { label:"Turno", property: 'turno', width: 50, renderer: null }, 
            { label:"Mina", property: 'mina', width: 70, renderer: null }, 
        ],
        rows: [dataFechaLugar]
    };

    const tablaResponsables = {
        headers: [
            { label:"Administrador de contrato", property: 'adm', width: 185, renderer: null }, 
            { label:"Ingeniero residente", property: 'ing', width: 185, renderer: null }, 
            { label:"Supervisor", property: 'supervisor', width: 185, renderer: null }, 
        ],
        rows: [dataResponsables]
    };

    const tablaContenido = {
        headers: [
            { label:"N°", property: 'n', width: 20, renderer: null },
            { label:"Clase", property: 'clase', width: 30, renderer: null }, 
            { label:"Descripción", property: 'descripcion', width: 180, renderer: null }, 
            { label:"Jerarquía", property: 'jerarquía', width: 60, renderer: null }, 
            { label:"Postura", property: 'postura', width: 100, renderer: null },
            { label:"Riesgo crítico", property: 'riesgo', width: 130, renderer: null },
            { label:"Estado", property: 'estado', width: 35, renderer: null },
        ],
        rows: dataTabla
    };

    
    const tablaTitulo = {
        title: "Reporte Hallazgos",
        headers: [
            { label:"Datos generales", property: 'adm', width: 140, renderer: null }, 
        ],
        rows: []
    };

    const tablaSubTitulo = {
        headers: [
            { label:"Hallazgos generados durante el turno", property: 'adm', width: 185, renderer: null }, 
        ],
        rows: []
    };

    const tablaTituloEvidencia = {
        headers: [
            { label:"Evidencias", property: 'adm', width: 550, renderer: null }, 
        ],
        rows: []
    };

    
    /* Agregados al PDF*/

    // doc.on('data', dataCallback);
    // doc.on('end', endCallback);


    doc.image(`./src/img/pdflogogom.png`, 530, 15, { width: 50 })
    doc.image(`./src/img/pdflogocodelco.png`, 18, 15, { width: 60 });
      
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();
    doc.moveDown();

    doc.table(tablaTitulo, { width: 550 });
    doc.table(tablaFechaLugar, { width: 550 });
    doc.table(tablaCabecera, { width: 550 });
    doc.table(tablaResponsables, { width: 550 });

    doc.moveDown();
    doc.moveDown();
    doc.table(tablaSubTitulo, { width: 550 });
    doc.table(tablaContenido, { width: 550 });

    doc.addPage()

    doc.table(tablaTituloEvidencia, { width: 550 });
    doc.moveDown();

    dataArchivos.map(ides => {

        doc.fontSize(8).text(`Hallazgo N° ${ides.ide}`, positionXTx, positionYTx)
        ides.fotos.map(imgs => {
            doc.image(`./src/fotosEvidencia${imgs}`, positionXPh, positionYPh, {
                width: 180,
                height: 100
            });
            positionXPh = positionXPh + 185
        });
        doc.moveDown();

        positionXPh = 18;

        positionYPh = positionYPh + 120;
        positionYTx = positionYTx + 120;
    });

    doc.end();

    doc.pipe(fs.createWriteStream(`./src/pdf/reporte_hallazgo_${id}.pdf`));

}

module.exports = buildPDF;