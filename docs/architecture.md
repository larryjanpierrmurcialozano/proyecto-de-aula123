# Arquitectura del proyecto

## Estado actual

El proyecto es un monolito Flask modular. `backend/iniciador.py` registra los
blueprints y sirve el frontend estatico desde `frontend/`. La aplicacion Flask
se conecta a PostgreSQL mediante `backend/utils/database.py` y `psycopg 3`.
Los respaldos MySQL existentes son fuentes historicas de migracion y no son
usados por las rutas activas.

La primera reorganizacion separa los recursos por responsabilidad:

- `backend/routes/<modulo>/`: blueprint Python y guia interna de cada modulo.
- `backend/utils/`: conexion, helpers y constantes compartidas.
- `frontend/`: templates, JavaScript, CSS e imagenes.
- `storage/uploads/`: archivos subidos por usuarios.
- `storage/backups/`: respaldos de bases de datos, no versionados.
- `scripts/database/`: herramientas de exportacion e importacion.
- `scripts/legacy/`: scripts antiguos que no deben ejecutarse por defecto.
- `docs/`: instalacion, correo, periodos y arquitectura.

## Objetivo

La estructura objetivo es un monolito modular por bloques. Cada bloque de
negocio podra separar posteriormente sus rutas, servicios, repositorios y
esquemas sin cambiar las URLs publicas.

```text
backend/routes/
  asistencia/
    routes.py
    README.md
  calificaciones/
    routes.py
    README.md
  ...

backend/app/
  core/             # configuracion y errores comunes
  infrastructure/   # base de datos, archivos, correo e integraciones
  modules/          # auth, academico, asistencia, calificaciones, etc.
frontend/
storage/
scripts/
tests/
docs/
```

## Reglas de migracion

1. Mantener las URLs actuales mientras se mueve cada modulo.
2. Centralizar rutas fisicas antes de mover codigo Python.
3. Migrar un bloque por vez y probar sus endpoints.
4. No mezclar backups, uploads ni secretos con codigo versionable.
5. Retirar `routes/temp.py`, copias `.bak` y codigo legacy solo despues de
   confirmar que no tienen consumidores activos.

## Convivencia Python + C#

Durante la migracion Flask sigue siendo la entrada del frontend y conserva las
URLs publicas. Las responsabilidades se separan por operacion, no por modulo:

- **C# ASP.NET Core:** consultas y cambios de datos, validaciones de negocio y
  operaciones transaccionales sobre PostgreSQL.
- **Python/Flask:** generacion y procesamiento de PDF/Excel, plantillas
  institucionales, archivos adjuntos, almacenamiento documental y reportes
  cuyo formato ya utiliza el sistema.
- **Flask como puerta de entrada:** valida la sesion actual y dirige cada
  operacion al manejador asignado, conservando las URLs que consume el frontend.

Un mismo modulo puede usar ambos servicios. Por ejemplo, Observador puede
guardar y consultar observaciones desde C# y seguir generando sus PDF desde
Python; Asistencia puede migrar el registro y consulta de datos mientras Python
mantiene justificantes y reportes documentales. Calificaciones puede migrar
actividades y notas, manteniendo en Python la importacion, exportacion y
sincronizacion de planillas.

No se elimina la implementacion Python al crear su equivalente C#. Se cambia el
destino interno de una ruta solo despues de comparar respuestas, permisos,
efectos en PostgreSQL y, cuando corresponda, archivos producidos. Antes de
ampliar el proxy se debe resolver la identidad compartida entre la sesion Flask
y C#, para que ambos lados apliquen los mismos roles y permisos.
