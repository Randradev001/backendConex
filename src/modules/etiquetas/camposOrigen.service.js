const { validateDocument } = require('./zpl/zplCore');

// Documenta las variables productivas de impresion.service.variableValues.
const VARIABLE_ORIGINS = Object.freeze({
  producto: ['ESPECIES.EspeNom', 'Especie configurada en LINCONFIG.Especod.', 'Configuración de líneas / Especies'],
  especie: ['ESPECIES.EspeNom', 'Especie configurada en LINCONFIG.Especod.', 'Configuración de líneas / Especies'],
  especie_externa: ['ESPECIES.EspeNomExt / EspeNom', 'Nombre externo; si está vacío utiliza el nombre de la especie.', 'Maestros → Especies'],
  variedad: ['ESPECIES1.VarNom', 'Variedad de ORDPROC.Especod + ORDPROC.VarCod.', 'Orden de proceso / Maestros → Especies → Variedades'],
  fecha: ['ORDPROC.OrdpFecha', 'Fecha de la orden activa. CONFIGETI.ConfTipFecha y ConfSepFec de origen definen el formato; por defecto DD/MM/YYYY.', 'Orden de proceso'],
  productor: ['PRODUCTORES.ProdNom / ORDPROC.ProdCod', 'Productor de ORDPROC.ProdCod; si no tiene nombre utiliza su código.', 'Maestros → Productores'],
  productor_codigo: ['PRODUCTORES.ProdCodExt / ORDPROC.ProdCod', 'Código externo del productor; si está vacío utiliza el código de la orden.', 'Maestros → Productores'],
  productor_secundario: ['PRODUCTORES.ProdNom2 / ProdNom / ORDPROC.ProdCod', 'Utiliza el nombre secundario; después el nombre principal y finalmente el código del productor.', 'Maestros → Productores'],
  comuna: ['PRODUCTORES.ProdComuna', 'TOWNSHIP de GROWER: comuna del productor de la orden activa. Si está vacía, se imprime vacío.', 'Maestros → Productores → Comuna productor'],
  provincia: ['PRODUCTORES.ProdProvincia', 'PROVINCE de GROWER: provincia del productor de la orden activa. Si está vacía, se imprime vacío.', 'Maestros → Productores → Provincia productor'],
  envase: ['ENVCAT.EnvNom / LINCONFIG.EnvCod', 'Envase configurado en la línea; si no tiene nombre utiliza su código.', 'Configuración de líneas / Maestros → Envases'],
  envase_externo: ['ENVCAT.EnvNomExt / EnvNom / LINCONFIG.EnvCod', 'Nombre externo del envase; después nombre principal y código.', 'Maestros → Envases'],
  categoria: ['ENVCAT1.CatNom / LINCONFIG.Catcod', 'Categoría configurada en la línea; si no tiene nombre utiliza su código.', 'Configuración de líneas / Maestros → Envases → Categorías'],
  categoria_externa: ['ENVCAT1.CatNomExt / CatNom / LINCONFIG.Catcod', 'Nombre externo de la categoría; después nombre principal y código.', 'Maestros → Envases → Categorías'],
  calibre: ['LINCONFIG.Calibre', 'Calibre configurado en la línea.', 'Configuración de líneas'],
  calibre_sin_ceros: ['LINCONFIG.Calibre', 'Calibre configurado en la línea, eliminando todos los caracteres 0 por compatibilidad GX8.', 'Configuración de líneas'],
  codigo: ['GenCor.GenCor10 (GenCod=ETILIN) + LINCONFIG + CALIBRES.CalCod + LINEAS', 'Código de caja: correlativo (6), envase (3), categoría (3), código de calibre (3), máquina (2), línea (2) y persona LConfCodPer (4).', 'Se genera automáticamente al preparar la impresión'],
  lote: ['ORDPROC.Ordpnum', 'Número de la orden de proceso activa.', 'Orden de proceso']
});

const ELEMENT_NAMES = { text: 'Texto', barcode: 'Código de barras', qr: 'QR', line: 'Línea', rectangle: 'Rectángulo', image: 'Imagen', 'raw-zpl': 'ZPL conservado' };

const describeFieldOrigins = (rawDocument, { versioned = true } = {}) => {
  const document = validateDocument(rawDocument);
  const designSource = versioned ? 'ETIQUETAVERSION.EtiDesignJson' : 'ETIQUETAPLANTILLA.EtiDesignJson';
  const rows = document.elements.map((element, index) => {
    const content = String(element.content ?? '');
    const names = [...new Set([...content.matchAll(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi)].map((match) => match[1].toLowerCase()))];
    const tags = names.map((name) => {
      const origin = Object.hasOwn(VARIABLE_ORIGINS, name) ? VARIABLE_ORIGINS[name] : null;
      return {
        name, known: Boolean(origin),
        source: origin?.[0] || 'Sin origen productivo registrado',
        description: origin?.[1] || 'Este tag no está resuelto por el worker. Revise su definición antes de imprimir.',
        editAt: origin?.[2] || 'Diseñador de etiquetas → Contenido'
      };
    });
    const graphic = !['text', 'barcode', 'qr'].includes(element.type);
    const mixed = names.length > 0 && content.replace(/\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/gi, '').trim().length > 0;
    return {
      id: element.id, number: index + 1, type: ELEMENT_NAMES[element.type] || element.type,
      content: graphic ? element.resourceName || ELEMENT_NAMES[element.type] || element.type : content,
      visible: element.visible !== false, kind: graphic ? 'graphic' : names.length ? (mixed ? 'mixed' : 'dynamic') : 'fixed',
      source: designSource, tags,
      description: graphic
        ? 'Elemento gráfico del diseño.'
        : names.length ? 'Los tags se completan al preparar la impresión. El texto que los acompaña se guarda en el diseño.'
          : 'Texto fijo del diseño. Se imprime tal como está escrito; no se consulta un maestro para completarlo.',
      editAt: 'Diseñador de etiquetas → Diseño → Seleccionar campo → Contenido'
    };
  });
  return {
    context: 'En la impresión por línea, la empresa de ejecución y la temporada activa determinan la orden de proceso activa. El productor se relaciona por ORDPROC.ProdCod. La etiqueta se elige por ETIXCAL.ConfCod o, en su defecto, ORDPROC.OrdpCodEti, y se imprime su versión vigente.',
    rows
  };
};

module.exports = { describeFieldOrigins, VARIABLE_ORIGINS };
