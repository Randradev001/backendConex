module.exports = {
    apps: [{
      name: "nodeEnvioMail",
      cwd: "C:/Produccion/nodeEnvioMail/backendEmailSenderAP", // ruta del proyecto
      script: "./index.js",   // <-- aquí el cambio
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      },
      watch: false,
      max_memory_restart: "300M"
    }]
  };