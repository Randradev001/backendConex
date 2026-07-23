# Seguridad

## Modelo de negocio

La autorizacion sigue la jerarquia original de CONEX:

`Empresa -> Usuario -> Sistema -> Modulo -> Programa -> Accion`

- `USUARIOS` identifica al usuario global de GeneXus.
- `ASIGSIST` asigna empresas y sistemas al usuario.
- `ASIG` asigna modulos.
- `ASIGPROG` asigna programas.
- `ASIGPROG1` es el segundo nivel y asigna acciones (`ProgOPCod`).
- `NIVSEG` se conserva para compatibilidad hasta confirmar su uso final.

## Autenticacion

El endpoint `POST /backendDocker/seguridad/login` valida `USUARIOS`. Si todavia no existe una credencial moderna, compara una sola vez con `UsuClave`, tal como hacia `VeriUsu`, y crea un hash `scrypt` en `SEGUSUCRED`.

La sesion es un token aleatorio en cookie `HttpOnly`. SQL Server guarda solamente su SHA-256 en `SEGSESION`. La empresa de trabajo queda dentro de la sesion y el middleware la publica como `req.context.empCod`; las pantallas no deben pedirla ni enviarla.

Si el usuario tiene una sola empresa, el login la selecciona automaticamente. Si tiene varias, el backend devuelve las empresas permitidas para que el formulario solicite una seleccion antes de crear la sesion.

## Procedimientos GX identificados

- `VeriUsu`: validacion de usuario y clave; migrado al servicio de autenticacion.
- `CamClave`: cambio de clave; migrado a `PUT /backendDocker/seguridad/password` con hash moderno.
- `VA2`: comprueba empresa, usuario, sistema, modulo, programa y accion; debe convertirse en middleware backend al proteger cada modulo.
- `TraeNSeg`: lee `UsuNseg`; se conserva en la sesion como dato compatible, no como concesion automatica de permisos.
- `Encripta`: usa `Encrypt64` y no tiene referencias detectadas; no se usa para nuevas claves.
- `VeriLicencia`: modifica parametros generales y debe estudiarse con el modulo de licenciamiento, no con el login.
- `VA`: retirado por decision de migracion porque no contiene logica util.

## Corte futuro

Cuando GeneXus deje de operar, se debe impedir el acceso por `UsuClave`, forzar cambio de claves migradas y limpiar el dato legado. Esa etapa requiere una decision explicita y no forma parte de la convivencia actual.

## Configuracion

En desarrollo, el backend admite por defecto React en `localhost` o `127.0.0.1`, puertos `3001` y `5173`. Para otros ambientes se configura una lista separada por comas:

```env
CORS_ORIGINS=https://conex.midominio.cl
SESSION_HOURS=12
SESSION_REMEMBER_HOURS=720
SESSION_COOKIE_NAME=conex_session
```

El frontend puede cambiar la direccion del backend con `VITE_API_URL`. En produccion ambos sitios deben publicarse con HTTPS; Node agrega `Secure` a la cookie cuando `NODE_ENV=production`.
