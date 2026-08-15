# Estudio de maestros GX8 en CONEX

> Matriz estructural derivada del XPZ y de SQL Server. Describe claves, niveles
> y configuracion propuesta, pero no reemplaza el estado de implementacion de
> [CURRENT-STATE.md](CURRENT-STATE.md).

Fecha: 2026-07-29

## Decisiones de modalidad

- Todos los maestros con niveles se implementan como cabecera-detalle.
- El menu muestra solamente maestros padre.
- Los detalles se editan dentro del modal de la cabecera.
- Se usa una sola base SQL Server: la configurada en `SQLSERVER_DATABASE`.
- `EmpCod` proviene de la sesion salvo `DEFEMP`, que es la raiz de empresas.

## Matriz resumida

| Maestro GX | Pantalla | Menu | Tabla | Existe BD | Clave | Detalles | WorkPanel | Reglas/procedimientos | Observacion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DEFEMP | Empresas | Si | DEFEMP | Si | EmpCod | - | No | - | Raiz multiempresa; no filtra por EmpCod de sesion. |
| Temp01 | Temporadas | Si | Temp01 | Si | EmpCod + TempCod | - | No | - | Maestro por empresa de sesion. |
| Especies | Especies | Si | Especies | Si | EmpCod + Especod | Especies1, Calibres | Si | - | Calibres es detalle relacionado por Especod, aunque no sea nivel 2 de la Transaction Especies. |
| EnvCat | Envases | Si | EnvCat | Si | EmpCod + EnvCod | EnvCat1 | Si | - | Categorias se mantienen dentro del modal de envase. |
| Productores | Productores | Si | Productores | Si | EmpCod + ProdCod | Productores1 | Si | Verirut | Cuarteles se mantienen dentro del modal de productor. |
| Calibres | Especies | No | Calibres | Si | EmpCod + Especod + Calibre | - | Si | AgCeros, TraeCor | No va al menu; se administra desde Especies. |
| Agentes | Agentes | Si | Agentes | Si | EmpCod + AgeCod | - | Si | Verirut | - |
| Clientes | Clientes | Si | Clientes | Si | EmpCod + CliCod | - | Si | Verirut | - |
| Comunas | Comunas | Si | Comunas | Si | ComCod | - | No | - | - |
| Condicion | Condicion | Si | Condicion | Si | ConCod | - | No | - | - |
| Consig | Consig | Si | Consig | Si | EmpCod + ConsCod | - | Si | Verirut | - |
| Destinos | Destinos | Si | Destinos | Si | DestCod | - | No | - | - |
| Export | Exportadoras | Si | EXPORT1 | Si | EmpCod + ExpCod | ExpProd | Si | Verirut | ExpProd es relacion exportadora-productor. |
| Origen | Origen | Si | Origen | Si | EmpCod + OriCod | - | No | - | - |
| Tipdoc | Tipdoc | Si | Tipdoc | Si | TdCod | - | No | - | - |
| CausaAnul | CausaAnul | Si | CausaAnul | Si | CAnCod | - | No | - | - |
| DespaAuto | DespaAuto | Si | DespaAuto | Si | EmpCod + DACod | - | No | - | - |
| DestMP | DestMP | Si | DestMP | Si | DesMPCod | - | No | - | - |
| EnvMP | EnvMP | Si | EnvMP | Si | ENMTCod | - | No | - | - |
| ExpProd | Exportadoras | No | ExpProd | Si | EmpCod + ExpCod + ProdCod | - | No | - | No va al menu; se administra desde Exportadoras. |
| MaeLineaEmbalaje | MaeLineaEmbalaje | Si | MaeLineaEmbalaje | No | MaeLinCod | - | No | - | - |
| Monedas | Monedas | Si | Monedas | Si | MonCod | ValMExt | No | - | ValMExt incluye importacion Excel a estudiar contra GX8. |
| paramgen | Parametros generales | Si | paramgen | Si | EmpCod + PARCod | paramge1 | Si | - | Detalle de parametro se edita desde cabecera. |
| Procedencia | Procedencia | Si | Procedencia | Si | EmpCod + ProcCod | - | No | - | - |
| ProdGen | ProdGen | Si | ProdGen | Si | PRGCod | - | No | - | - |
| Puertos | Puertos | Si | Puertos | Si | PuCod | - | Si | - | - |
| Secciones | Secciones | Si | Secciones | Si | EmpCod + Seccod | - | No | - | - |
| TipMov | Tipos de movimiento | Si | TipMov | Si | EmpCod + TMcod | TipMov1 | No | - | Subtipos se editan desde cabecera. |
| ValMExt | Monedas | No | ValMExt | Si | MonCod + VMEFec | - | No | - | No va al menu; se administra desde Monedas. |

## Configuracion propuesta por maestro

### Empresas (DEFEMP)

- Tabla: `DEFEMP` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`
- Listado: `EmpNom`, `EmpGiro`, `Empdir`, `EmpRut`, `EmpDV`, `EmpRepre`
- Formulario cabecera: `EmpCod`, `EmpNom`, `EmpGiro`, `Empdir`, `EmpRut`, `EmpDV`, `EmpRepre`, `EmpSw`, `EmpPar1`, `EmpPar2`, `empreg`, `Empprov`, `Empcom`, `empSisProd`, `EmpTempLot`, `EmpCodSAG`, `EmpCodCom`, `EmpRutIMG`, `EmpTReg`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.
- Nota: Raiz multiempresa; no filtra por EmpCod de sesion.

### Temporadas (Temp01)

- Tabla: `Temp01` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `TempCod`
- Listado: `TempCod`, `TempDes`, `TempActiva`, `TempFecAbre`, `TempFecCierra`
- Formulario cabecera: `EmpCod`, `TempCod`, `TempDes`, `TempFecAbre`, `TempLogA`, `TempFecCierra`, `TempLogC`, `TempActiva`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado
- Nota: Maestro por empresa de sesion.

### Especies (Especies)

- Tabla: `Especies` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `Especod`
- Listado: `Especod`, `EspeNom`, `EspeDiaV`
- Formulario cabecera: `EmpCod`, `EmpNom`, `Especod`, `EspeNom`, `EspeNomExt`, `EspeNomC`, `EspeDiaV`, `EspeSag`, `EspePLU`, `EspeCMP`, `EspeNMP`, `EspeSECod`
- Detalles en modal: `Especies1`, `Calibres`
- Niveles GX detectados: `VarCod*` + `VarNom` + `varnomC` + `VarPLU` + `VarSECod`
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`, `EspeNom`. No se tratan como columnas fisicas faltantes.
- Campos del inventario no encontrados con el mismo nombre en BD: `EspeNMP`
- Nota: Calibres es detalle relacionado por Especod, aunque no sea nivel 2 de la Transaction Especies.

### Envases (EnvCat)

- Tabla: `EnvCat` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `EnvCod`
- Listado: `EnvCod`, `EnvNom`, `EnvNomExt`
- Formulario cabecera: `EmpCod`, `EmpNom`, `EnvCod`, `EnvNom`, `EnvNomExt`, `EnvnomC`, `EnvPeso`, `EnvDestare`, `EnvPesoB`, `EnvUso`, `EnvSECod`, `EnvCMP`, `EnvNMP`
- Detalles en modal: `EnvCat1`
- Niveles GX detectados: `Catcod*` + `CatNom` + `CatnomExt` + `CatNomC` + `CatSECod`
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.
- Campos del inventario no encontrados con el mismo nombre en BD: `EnvNMP`
- Nota: Categorias se mantienen dentro del modal de envase.

### Productores (Productores)

- Tabla: `Productores` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `ProdCod`
- Listado: `ProdCod`, `ProdNom`, `ProdRut`, `ProdDv`, `ProdComuna`, `ProdProvincia`
- Formulario cabecera: `EmpCod`, `EmpNom`, `ProdCod`, `ProdNom`, `ProdRut`, `ProdDv`, `ProdComuna`, `ProdProvincia`, `ProdPack`, `ProdPackCom`, `ProdPackProv`, `ProdCodExt`, `Prodnom2`, `ProdCodSAG`, `ProdSECod`
- Detalles en modal: `Productores1`
- Niveles GX detectados: `CuarCod*` + `CuarNom` + `CuarnomC`
- Procedimientos asociados: `Verirut`
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.
- Nota: Cuarteles se mantienen dentro del modal de productor.

### Especies (Calibres)

- Tabla: `Calibres` (existe en CONEX)
- Menu visible: no
- Clave: `EmpCod`, `Especod`, `Calibre`
- Listado: `Especod`, `EspeNom`, `Calibre`, `CalCod`
- Formulario cabecera: `EmpCod`, `EmpNom`, `Especod`, `EspeNom`, `Calibre`, `CalCod`
- Detalles en modal: ninguno
- Procedimientos asociados: `AgCeros`, `TraeCor`
- Campos referenciados GX: `EmpNom`, `EspeNom`. No se tratan como columnas fisicas faltantes.
- Nota: No va al menu; se administra desde Especies.

### Agentes (Agentes)

- Tabla: `Agentes` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `AgeCod`
- Listado: `AgeCod`, `Agerut`, `AgeDv`, `AgeNom`
- Formulario cabecera: `EmpCod`, `EmpNom`, `AgeCod`, `Agerut`, `AgeDv`, `AgeNom`, `AgecodMP`
- Detalles en modal: ninguno
- Procedimientos asociados: `Verirut`
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.

### Clientes (Clientes)

- Tabla: `Clientes` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `CliCod`
- Listado: `CliCod`, `Clirut`, `CliDv`, `CliNom`
- Formulario cabecera: `EmpCod`, `EmpNom`, `CliCod`, `Clirut`, `CliDv`, `CliNom`, `Clidirec`, `CliGiro`, `Cliciu`, `CliCom`, `CliFono`, `CliRegion`
- Detalles en modal: ninguno
- Procedimientos asociados: `Verirut`
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.

### Comunas (Comunas)

- Tabla: `Comunas` (existe en CONEX)
- Menu visible: si
- Clave: `ComCod`
- Listado: `Comdesc`
- Formulario cabecera: `ComCod`, `Comdesc`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### Condicion (Condicion)

- Tabla: `Condicion` (existe en CONEX)
- Menu visible: si
- Clave: `ConCod`
- Listado: `ConNom`, `ConNomC`, `ConEst`
- Formulario cabecera: `ConCod`, `ConNom`, `ConNomC`, `ConEst`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### Consig (Consig)

- Tabla: `Consig` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `ConsCod`
- Listado: `ConsCod`, `ConsRut`, `ConsDV`, `ConsNom`
- Formulario cabecera: `EmpCod`, `EmpNom`, `ConsCod`, `ConsRut`, `ConsDV`, `ConsNom`
- Detalles en modal: ninguno
- Procedimientos asociados: `Verirut`
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.

### Destinos (Destinos)

- Tabla: `Destinos` (existe en CONEX)
- Menu visible: si
- Clave: `DestCod`
- Listado: `DestNom`, `DestCMP`, `DestNMP`
- Formulario cabecera: `DestCod`, `DestNom`, `DestCMP`, `DestNMP`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado
- Campos del inventario no encontrados con el mismo nombre en BD: `DestNMP`

### Exportadoras (Export)

- Tabla: `EXPORT1` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `ExpCod`
- Listado: `ExpCod`, `ExpNom`, `ExpRut`, `ExpDv`
- Formulario cabecera: `EmpCod`, `EmpNom`, `ExpCod`, `ExpNom`, `ExpRut`, `ExpDv`, `EXPCodMP`, `EXPSECod`
- Detalles en modal: `ExpProd`
- Procedimientos asociados: `Verirut`
- Campos referenciados GX: `EmpNom`, `ExpNom`. No se tratan como columnas fisicas faltantes.
- Nota: ExpProd es relacion exportadora-productor.

### Origen (Origen)

- Tabla: `Origen` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `OriCod`
- Listado: `EmpNom`, `Orinom`, `OriEst`
- Formulario cabecera: `EmpCod`, `EmpNom`, `OriCod`, `Orinom`, `OriEst`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.

### Tipdoc (Tipdoc)

- Tabla: `Tipdoc` (existe en CONEX)
- Menu visible: si
- Clave: `TdCod`
- Listado: `TdNom`, `TdInter`, `TdBloq`
- Formulario cabecera: `TdCod`, `TdNom`, `TdInter`, `TdBloq`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### CausaAnul (CausaAnul)

- Tabla: `CausaAnul` (existe en CONEX)
- Menu visible: si
- Clave: `CAnCod`
- Listado: `CanNom`, `CanPE`, `CanLoginC`, `CanFecC`
- Formulario cabecera: `CAnCod`, `CanNom`, `CanPE`, `CanLoginC`, `CanFecC`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### DespaAuto (DespaAuto)

- Tabla: `DespaAuto` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `DACod`
- Listado: `DANombre`, `DAVig`
- Formulario cabecera: `EmpCod`, `DACod`, `DANombre`, `DAVig`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### DestMP (DestMP)

- Tabla: `DestMP` (existe en CONEX)
- Menu visible: si
- Clave: `DesMPCod`
- Listado: `DesMPNom`
- Formulario cabecera: `DesMPCod`, `DesMPNom`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### EnvMP (EnvMP)

- Tabla: `EnvMP` (existe en CONEX)
- Menu visible: si
- Clave: `ENMTCod`
- Listado: `ENMTDesc`
- Formulario cabecera: `ENMTCod`, `ENMTDesc`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### Exportadoras (ExpProd)

- Tabla: `ExpProd` (existe en CONEX)
- Menu visible: no
- Clave: `EmpCod`, `ExpCod`, `ProdCod`
- Listado: `ExpCod`, `ExpNom`, `ProdCod`, `ProdNom`
- Formulario cabecera: `EmpCod`, `EmpNom`, `ExpCod`, `ExpNom`
- Detalles en modal: ninguno
- Niveles GX detectados: `ProdCod*` + `ProdNom` + `ProdComuna`
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`, `ExpNom`. No se tratan como columnas fisicas faltantes.
- Nota: No va al menu; se administra desde Exportadoras.

### MaeLineaEmbalaje (MaeLineaEmbalaje)

- Tabla: `MaeLineaEmbalaje` (no detectada en CONEX)
- Menu visible: si
- Clave: `MaeLinCod`
- Listado: `MaeLinDes`
- Formulario cabecera: `MaeLinCod`, `MaeLinDes`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### Monedas (Monedas)

- Tabla: `Monedas` (existe en CONEX)
- Menu visible: si
- Clave: `MonCod`
- Listado: `MonDes`, `MonLogC`
- Formulario cabecera: `MonCod`, `MonDes`, `MonLogC`
- Detalles en modal: `ValMExt`
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `MonDes`. No se tratan como columnas fisicas faltantes.
- Nota: ValMExt incluye importacion Excel a estudiar contra GX8.

### Parametros generales (paramgen)

- Tabla: `paramgen` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `PARCod`
- Listado: `PARCod`, `PARDes`, `PARValor1`, `PARValor2`, `PARValor3`
- Formulario cabecera: `EmpCod`, `PARCod`, `PARDes`, `PARValor1`, `PARValor2`, `PARValor3`
- Detalles en modal: `paramge1`
- Niveles GX detectados: `PAR1Cod*` + `PAR1Des` + `PAR1Valor1` + `PAR1Valor2` + `PAR1Valor3` + `Par1Texto`
- Procedimientos asociados: ninguno detectado
- Nota: Detalle de parametro se edita desde cabecera.

### Procedencia (Procedencia)

- Tabla: `Procedencia` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `ProcCod`
- Listado: `EmpNom`, `ProcNom`, `ProcEst`
- Formulario cabecera: `EmpCod`, `EmpNom`, `ProcCod`, `ProcNom`, `ProcEst`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.

### ProdGen (ProdGen)

- Tabla: `ProdGen` (existe en CONEX)
- Menu visible: si
- Clave: `PRGCod`
- Listado: `PRGDesc`
- Formulario cabecera: `PRGCod`, `PRGDesc`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### Puertos (Puertos)

- Tabla: `Puertos` (existe en CONEX)
- Menu visible: si
- Clave: `PuCod`
- Listado: `PuCod`, `PuNombre`, `PuNac`
- Formulario cabecera: `PuCod`, `PuNombre`, `PuNac`, `PuCodHomo`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado

### Secciones (Secciones)

- Tabla: `Secciones` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `Seccod`
- Listado: `EmpNom`, `SecNom`
- Formulario cabecera: `EmpCod`, `EmpNom`, `Seccod`, `SecNom`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.

### Tipos de movimiento (TipMov)

- Tabla: `TipMov` (existe en CONEX)
- Menu visible: si
- Clave: `EmpCod`, `TMcod`
- Listado: `EmpNom`, `TMNom`
- Formulario cabecera: `EmpCod`, `EmpNom`, `TMcod`, `TMNom`
- Detalles en modal: `TipMov1`
- Niveles GX detectados: `TMSCod*` + `TMSNom`
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `EmpNom`. No se tratan como columnas fisicas faltantes.
- Nota: Subtipos se editan desde cabecera.

### Monedas (ValMExt)

- Tabla: `ValMExt` (existe en CONEX)
- Menu visible: no
- Clave: `MonCod`, `VMEFec`
- Listado: `MonCod`, `MonDes`, `VMEFec`, `VMEVal`
- Formulario cabecera: `MonCod`, `MonDes`, `VMEFec`, `VMEVal`
- Detalles en modal: ninguno
- Procedimientos asociados: ninguno detectado
- Campos referenciados GX: `MonDes`. No se tratan como columnas fisicas faltantes.
- Nota: No va al menu; se administra desde Monedas.

## Siguientes confirmaciones

1. Validar nombres visibles y columnas de listado contra cada WorkPanel GX8.
2. Definir permisos `SistCod`, `Modcod`, `ProgCod` y acciones por maestro padre.
3. Confirmar maestros sin WorkPanel antes de habilitar CRUD completo.
4. Ejecutar pruebas de alta, modificacion, baja, dependencia y exportacion por maestro.
