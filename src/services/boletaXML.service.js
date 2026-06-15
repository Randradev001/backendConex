const { create } = require('xmlbuilder2');

const generateBoletaDteXml = (data) => {
  const total = data.items.reduce(
    (sum, item) => sum + item.cantidad * item.precio,
    0
  );

  const doc = create({ version: '1.0', encoding: 'ISO-8859-1' })
    .ele('DTE', { version: '1.0' })
      .ele('Documento', { ID: `B${data.folio}` })
        .ele('Encabezado')
          .ele('IdDoc')
            .ele('TipoDTE').txt('39').up()
            .ele('Folio').txt(data.folio).up()
            .ele('FchEmis').txt(data.fechaEmision).up()
            .ele('IndServicio').txt('3').up()
          .up()
          .ele('Emisor')
            .ele('RUTEmisor').txt(data.emisor.rut).up()
            .ele('RznSocEmisor').txt(data.emisor.razonSocial).up()
            .ele('GiroEmisor').txt(data.emisor.giro).up()
            .ele('DirOrigen').txt(data.emisor.direccion).up()
            .ele('CmnaOrigen').txt(data.emisor.comuna).up()
            .ele('CiudadOrigen').txt(data.emisor.ciudad).up()
          .up()
          .ele('Receptor')
            .ele('RUTRecep').txt(data.receptor?.rut || '66666666-6').up()
            .ele('RznSocRecep').txt(data.receptor?.razonSocial || 'CONSUMIDOR FINAL').up()
          .up()
          .ele('Totales')
            .ele('MntTotal').txt(total).up()
          .up()
        .up();

  data.items.forEach((item, index) => {
    doc.ele('Detalle')
      .ele('NroLinDet').txt(index + 1).up()
      .ele('NmbItem').txt(item.descripcion).up()
      .ele('QtyItem').txt(item.cantidad).up()
      .ele('PrcItem').txt(item.precio).up()
      .ele('MontoItem').txt(item.cantidad * item.precio).up()
    .up();
  });

  doc.ele('TED', { version: '1.0' })
    .ele('DD')
      .ele('RE').txt(data.emisor.rut).up()
      .ele('TD').txt('39').up()
      .ele('F').txt(data.folio).up()
      .ele('FE').txt(data.fechaEmision).up()
      .ele('RR').txt(data.receptor?.rut || '66666666-6').up()
      .ele('RSR').txt(data.receptor?.razonSocial || 'CONSUMIDOR FINAL').up()
      .ele('MNT').txt(total).up()
      .ele('IT1').txt(data.items[0]?.descripcion || 'ITEM').up()
      .ele('CAF').txt('PENDIENTE_CAF_REAL').up()
      .ele('TSTED').txt(new Date().toISOString()).up()
    .up()
    .ele('FRMT').txt('PENDIENTE_FIRMA_TED').up()
  .up();

  doc.ele('TmstFirma').txt(new Date().toISOString()).up();

  return {
    xml: doc.end({ prettyPrint: true }),
    total,
  };
};

module.exports = { generateBoletaDteXml };