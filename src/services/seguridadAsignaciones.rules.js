const { SecurityError } = require('./seguridad.service');

const positiveInteger = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new SecurityError(400, 'VALIDATION_ERROR', `${label} debe ser un entero mayor que cero.`);
  }
  return parsed;
};

const normalizeLogin = (value) => {
  const login = String(value || '').trim().toUpperCase();
  if (!login) throw new SecurityError(400, 'VALIDATION_ERROR', 'Debe indicar el usuario.');
  if (login.length > 10) throw new SecurityError(400, 'VALIDATION_ERROR', 'El usuario admite hasta 10 caracteres.');
  return login;
};

const readProgramCode = (value) => {
  if (value && typeof value === 'object') return value.ProgCod ?? value.progCod;
  return value;
};

const normalizeAssignment = (payload = {}) => {
  if (typeof payload.assigned !== 'boolean') {
    throw new SecurityError(400, 'VALIDATION_ERROR', 'assigned debe ser verdadero o falso.');
  }

  const rawModules = payload.modules ?? [];
  if (!Array.isArray(rawModules)) {
    throw new SecurityError(400, 'VALIDATION_ERROR', 'modules debe ser una lista.');
  }

  if (!payload.assigned) return { assigned: false, modules: [] };

  const modules = new Map();
  for (const rawModule of rawModules) {
    const Modcod = positiveInteger(rawModule?.Modcod ?? rawModule?.modCod, 'Modcod');
    const rawPrograms = rawModule?.programs ?? rawModule?.programas ?? [];
    if (!Array.isArray(rawPrograms)) {
      throw new SecurityError(400, 'VALIDATION_ERROR', `Los programas del modulo ${Modcod} deben ser una lista.`);
    }

    const programs = new Set(modules.get(Modcod)?.programs || []);
    rawPrograms.forEach((program) => programs.add(positiveInteger(readProgramCode(program), 'ProgCod')));
    modules.set(Modcod, { Modcod, programs: [...programs].sort((left, right) => left - right) });
  }

  return { assigned: true, modules: [...modules.values()].sort((left, right) => left.Modcod - right.Modcod) };
};

const programKey = (row) => `${Number(row.Modcod)}|${Number(row.ProgCod)}`;
const moduleCode = (row) => Number(row.Modcod ?? row.AsigMod ?? row);

const difference = (left, right) => [...left].filter((key) => !right.has(key));

const buildAssignmentPlan = (existing, target) => {
  const currentModules = new Set((existing.modules || []).map(moduleCode));
  const currentPrograms = new Map((existing.programs || []).map((row) => [programKey(row), {
    Modcod: Number(row.Modcod),
    ProgCod: Number(row.ProgCod)
  }]));
  const targetModules = new Set(target.modules.map((row) => row.Modcod));
  const targetPrograms = new Map();

  for (const module of target.modules) {
    for (const ProgCod of module.programs) {
      targetPrograms.set(programKey({ Modcod: module.Modcod, ProgCod }), { Modcod: module.Modcod, ProgCod });
    }
  }

  const sortNumbers = (values) => values.sort((left, right) => left - right);
  const sortPrograms = (values) => values.sort((left, right) => left.Modcod - right.Modcod || left.ProgCod - right.ProgCod);

  return {
    assignSystem: target.assigned && !existing.assigned,
    removeSystem: !target.assigned && Boolean(existing.assigned),
    addModules: sortNumbers(difference(targetModules, currentModules)),
    removeModules: sortNumbers(difference(currentModules, targetModules)),
    addPrograms: sortPrograms(difference(new Set(targetPrograms.keys()), new Set(currentPrograms.keys())).map((key) => targetPrograms.get(key))),
    removePrograms: sortPrograms(difference(new Set(currentPrograms.keys()), new Set(targetPrograms.keys())).map((key) => currentPrograms.get(key)))
  };
};

module.exports = { positiveInteger, normalizeLogin, normalizeAssignment, buildAssignmentPlan, programKey };
