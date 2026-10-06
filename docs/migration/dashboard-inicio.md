# Dashboard de inicio y atajos

## Finalidad

El dashboard de inicio de React reemplaza la muestra simulada del template por
una portada operacional de CONEX-CO. No se identifico en el inventario GX8 un
WorkPanel equivalente: esta pantalla pertenece al shell de navegacion de la
migracion y no crea ni modifica datos de negocio.

## Comportamiento vigente

- La ruta `/dashboard/default` y la raiz autenticada presentan el dashboard.
- Las tarjetas principales priorizan Recepcion de fruta, Calidad y evaluacion
  (con acceso directo al Tablero de lotes), Ordenes de proceso y Control de
  lineas.
- Los atajos secundarios incluyen indicadores de calidad, Captura de cajas,
  Diseno de etiquetas, Impresoras por linea y Productores.
- La cabecera muestra la fecha local, el usuario y la empresa activa.
- La seccion `Todos tus accesos` completa la navegacion con hasta doce opciones
  adicionales autorizadas.

## Seguridad

Los atajos se construyen desde el mismo arbol `SISTEMAS -> MODULOS -> PROGRAM`
entregado en la sesion y procesado por `buildAuthorizedMenu`. Una ruta que no
esta autorizada no aparece en ninguna tarjeta. Esto mejora la experiencia, pero
no reemplaza el middleware de autorizacion de cada endpoint Node.

Las pantallas de administracion de Seguridad vuelven a consultar la sesion al
guardar permisos directos, asignar o quitar roles y modificar una plantilla de
rol. De este modo el menu lateral y los atajos del dashboard se actualizan en la
misma sesion, sin exigir cerrar y volver a entrar.

## Alcance de datos

La portada no presenta indicadores agricolas simulados ni interpreta listados
parciales como metricas globales. Los contadores visibles describen solamente
la navegacion autorizada y la empresa activa. Los indicadores operacionales
permanecen en sus dashboards especializados.

## Verificacion

El 2026-10-05 se ejecuto ESLint dirigido sobre los componentes de
administracion de permisos sin errores y el build Vite completo, que transformo
6.046 modulos correctamente. El lint global conserva cuatro errores preexistentes
y ajenos en `src/pages/maestros/empresas.jsx`.
