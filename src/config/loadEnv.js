const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..', '..');
const externalEnvKeys = new Set(Object.keys(process.env));

const applyEnvFile = (fileName, { overrideFileValues = false } = {}) => {
  const filePath = path.join(rootDir, fileName);
  if (!fs.existsSync(filePath)) return;

  const parsed = dotenv.parse(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (externalEnvKeys.has(key)) continue;
    if (overrideFileValues || process.env[key] === undefined) process.env[key] = value;
  }
};

applyEnvFile('.env');

const nodeEnv = process.env.NODE_ENV || 'development';
if (!externalEnvKeys.has('NODE_ENV')) process.env.NODE_ENV = nodeEnv;

applyEnvFile(`.env.${nodeEnv}`, { overrideFileValues: true });

module.exports = {
  nodeEnv: process.env.NODE_ENV,
  rootDir
};
