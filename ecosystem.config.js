module.exports = {
    apps: [{
      name: "nodeEnvioMail",
      cwd: "C:/Produccion/nodeEnvioMail/backendEmailSenderAP", // ruta del proyecto
      script: "./index.js",   // <-- aquí el cambio
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        SERVER: "http://localhost:3000",   // <--- necesario (string)
        RESEND: "re_XJDieT7j_7yxSqPzfDiecv4vuGLy6Fw9H"  // <--- tu API key si usas Resend
      },
      watch: false,
      max_memory_restart: "300M"
    }]
  };