# ADR-002: Autenticacion durante la convivencia

## Estado

Aceptado para la prueba de migracion.

## Decision

Usar sesiones opacas persistidas en SQL Server y cookies `HttpOnly`, sin agregar librerias nuevas. Las claves modernas usan `crypto.scrypt` de Node.js y se almacenan en `SEGUSUCRED`.

Durante la convivencia, una clave que aun no este migrada puede validarse contra `USUARIOS.UsuClave`. Tras el primer acceso correcto se crea inmediatamente la credencial moderna. No se modifica `UsuClave` para no interrumpir el sistema GeneXus existente.

## Consecuencia

El inicio de sesion nuevo puede convivir con GX8, pero la clave legada seguira siendo un riesgo hasta el corte definitivo. Produccion debe usar HTTPS para que la cookie tenga el atributo `Secure`.
