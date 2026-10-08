const fs = require('node:fs/promises');
const path = require('node:path');

const createPrintSpool = ({ root }) => ({
  async savePrepared(job, prepared) {
    await fs.mkdir(root, { recursive: true });
    const baseName = `${String(job.id).padStart(10, '0')}-${prepared.preparationId}`;
    const zplPath = path.join(root, `${baseName}.zpl`);
    const metadataPath = path.join(root, `${baseName}.json`);
    const tempSuffix = `.tmp-${process.pid}-${Date.now()}`;
    const metadata = {
      localJobId: job.id,
      preparationId: prepared.preparationId,
      sha256: prepared.sha256,
      printer: prepared.printer,
      label: prepared.label,
      phase: 'prepared',
      preparedAt: new Date().toISOString()
    };
    await fs.writeFile(`${zplPath}${tempSuffix}`, prepared.zpl, 'utf8');
    await fs.rename(`${zplPath}${tempSuffix}`, zplPath);
    await fs.writeFile(`${metadataPath}${tempSuffix}`, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
    await fs.rename(`${metadataPath}${tempSuffix}`, metadataPath);
    return { zplPath, metadataPath };
  }
});

module.exports = { createPrintSpool };
