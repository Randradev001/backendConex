const digits = (value, length, name) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || String(number).length > length) {
    throw new Error(`${name} no cabe en ${length} dígitos.`);
  }
  return String(number).padStart(length, '0');
};

// Conserva la composición y el cambio de juego ZPL de ImprimeETBD.
const buildLegacyBoxCode = ({ boxNumber, envCode, categoryCode, caliberCode, machine, line, person }) => {
  const raw = [
    digits(boxNumber, 6, 'Correlativo de caja'),
    digits(envCode, 3, 'Envase'),
    digits(categoryCode, 3, 'Categoría'),
    digits(caliberCode, 3, 'Código de calibre'),
    digits(machine, 2, 'Máquina'),
    digits(line, 2, 'Línea'),
    digits(person || 0, 4, 'Persona')
  ].join('');
  return `${raw.slice(0, 22)}>6${raw.slice(22)}`;
};

module.exports = { buildLegacyBoxCode };
