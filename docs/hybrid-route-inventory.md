# Inventario inicial para la transición híbrida Python + C#

## Propósito y alcance

Este documento registra las rutas API activas detectadas en los blueprints
registrados por `backend/iniciador.py` y su destino inicial dentro de la
arquitectura híbrida. No cambia la implementación: describe el estado observado
y propone qué responsabilidad conservar en Python o migrar a C#.

La clasificación es preliminar. “Funcional” significa operaciones de consulta
y manejo de datos; no implica que la ruta esté probada o libre de dependencias
documentales. Antes de implementar cada módulo se debe revisar su contrato,
permisos, esquema PostgreSQL y consumidores del frontend.

## Arquitectura de transición

```text
Navegador / Frontend
        |
        v
Flask (entrada actual, sesión y rutas existentes)
   |                         |
   | rutas documentales      | rutas funcionales migradas
   v                         v
Python (Excel/PDF/archivos)  C# ASP.NET Core (módulos funcionales)
   |                         |
   +------------+------------+
                v
          PostgreSQL

Los archivos continúan en las ubicaciones configuradas bajo storage/ y en las
plantillas institucionales existentes. El reenvío Flask -> C# aún no está
implementado. Flask y C# hoy tienen sesiones independientes.
```

Flask se mantiene como punto de entrada. Hay un proxy optativo para Estudiantes
y para las rutas académicas implementadas en C#: grados, grupos, materias y
asignaciones de docente. Flask valida su sesión y reenvía la identidad a C# con
un secreto compartido entre procesos. El navegador no debe enviar esas
cabeceras. El proxy está desactivado por defecto; con una opción vacía, las
rutas Python siguen atendiendo las solicitudes.

## Inventario de rutas API

En las tablas, `{id}` y `{id_entero}` representan parámetros de ruta enteros;
`{ruta_archivo}` puede contener una ruta. Las rutas con varios alias ejecutan la
misma función Python y se muestran juntas. Las rutas documentales se quedan en
Python durante la transición; las funcionales son candidatas a C#.

| Módulo | Rutas activas (método y patrón) | Responsabilidad y destino preliminar |
|---|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/register`, `GET /api/auth/check`, `POST /api/auth/logout`, `GET /api/auth/profile`, `POST /api/auth/change-password` | Sesión y cuenta. Mantener temporalmente en Flask para conservar la sesión actual; C# ya tiene implementaciones paralelas, pero no comparte la cookie Flask. Resolver identidad común antes de hacer el corte. |
| Salud y dashboard | `GET /api/health`, `GET /api/dashboard/stats` | Salud: C# ya tiene una comprobación PostgreSQL; dashboard: funcional, candidato a C#. Mantener la ruta Flask durante comparación. |
| Usuarios | `GET /api/usuarios`, `GET /api/usuarios/{id}`, `POST /api/usuarios`, `PUT /api/usuarios/{id}`, `DELETE /api/usuarios/{id}`, `GET /api/roles` | CRUD y roles; candidato a C#. Las seis rutas ya están mapeadas en C#. Revisar permisos/contratos antes de enrutar tráfico. |
| Estudiantes | `GET /api/estudiantes`, `GET /api/estudiantes/{id}`, `POST /api/estudiantes`, `PUT /api/estudiantes/{id}`, `DELETE /api/estudiantes/{id}` | CRUD y relaciones académicas; candidato a C#. |
| Docentes | `GET /api/docentes`, `GET /api/docentes/disponibles`, `GET /api/docentes/{id}/asignaciones`, `POST /api/docentes/{id}/asignaciones`, `GET /api/docentes/{id}/grados-grupos`, `GET /api/docente/mis-materias`, `GET /api/docente/mi-horario` | Las consultas GET implementadas están en C#. El POST masivo permanece en Flask y ahora recibe `id_grupo`, valida referencias antes de guardar y marca como inactivas las asignaciones retiradas para preservar horarios históricos. |
| Académico | Grados: `GET/POST /api/grados`, `GET/PUT/DELETE /api/grados/{id}`, `GET /api/grados/{grado_id}/grupos`. Grupos: `GET/POST /api/grupos`, `GET/PUT/DELETE /api/grupos/{id}`, `GET /api/grupos/{id}/estudiantes`. Materias: `GET/POST /api/materias`, `GET/PUT/DELETE /api/materias/{id}`, `GET /api/materias/{materia_id}/docentes-disponibles`. Asignaciones: `POST /api/asignaciones-docente`, `DELETE /api/asignaciones-docente/{id}` | Catálogos y reglas académicas; candidato a C#. Resolver este módulo antes que horarios, calificaciones y asistencia por sus dependencias. |
| Horarios | `GET/POST /api/horarios`, `GET/PUT/DELETE /api/horarios/{id}`, `GET /api/horarios/asignaciones-grupo/{grupo_id}`, `GET /api/horarios/asignaciones-grado/{grado_id}`, `GET /api/niveles`, `POST /api/horarios/exportar-pdf` | CRUD y consultas ya implementados y enrutados a C#. La exportación PDF permanece en Python para conservar su formato. |
| Calificaciones | Documentos/archivos: `POST /api/calificaciones/plantilla/generar`, `GET /api/calificaciones/estructura_carpetas`, `GET /api/calificaciones/estructura_carpetas/public`, `POST /api/calificaciones/sincronizar_carpetas`, `GET /api/calificaciones/generar_planilla`, `GET /api/calificaciones/leer_planilla`, `POST /api/calificaciones/guardar_planilla_web`, `POST /api/calificaciones/subir_planilla`, `GET /api/calificaciones/descargar/institucional`, `GET/POST /api/calificaciones/acuerdo-pedagogico`, `GET /api/calificaciones/acuerdo-pedagogico/ver`, `GET /api/calificaciones/periodos/estructura`, `GET /api/calificaciones/periodos/listar`, `GET /api/calificaciones/periodos/descargar/{ruta_archivo}`, `GET /api/calificaciones/periodos/info`, `GET /api/calificaciones/periodos/{periodo_id}/listar`, `GET /api/calificaciones/periodos/descargar_archivo`, `GET /api/calificaciones/periodos/{periodo_id}/descargar_zip` | Mantener en Python: generan, leen, guardan, sincronizan o sirven Excel/PDF/ZIP y dependen de plantillas, rutas de escritorio/servidor y almacenamiento. No reemplazar formatos en el primer tramo. |
| Calificaciones | Datos: `GET /api/calificaciones/filtros`, `GET /api/calificaciones/grupos/{grado_id}`, `GET /api/calificaciones/materias/{grupo_id}`, `GET /api/calificaciones/tabla`, `POST /api/calificaciones/actividades`, `PUT/DELETE /api/calificaciones/actividades/{id_actividad}`, `POST /api/calificaciones/notas`, `POST /api/calificaciones/notas/lote` | Candidato a C# por responsabilidad de datos. Las rutas `guardar_planilla_web` y `subir_planilla` son mixtas: deben permanecer en Python hasta separar el guardado de notas del manejo Excel y validar el historial/respaldos. |
| Asistencia moderna | `GET /api/asistencia/filtros`, `GET /api/asistencia/grupos/{grado_id}`, `GET /api/asistencia/materias/{grupo_id}`, `GET /api/asistencia/tabla`, `POST /api/asistencia/guardar`, `GET /api/asistencia/resumen` | Operaciones funcionales; candidatas a C# después de resolver dependencia académica y consolidar el legado. |
| Asistencia: justificantes | `POST /api/asistencia/justificante` y `/api/asistencias/justificante`; `GET /api/asistencia/justificantes` y `/api/asistencias/justificantes`; `PUT /api/asistencia/justificantes/{id_justificante}/aprobar` y `/api/asistencias/justificantes/{id_justificante}/aprobar`; `GET /api/asistencia/justificantes/{id_justificante}/archivo` y `/api/asistencias/justificantes/{id_justificante}/archivo` | Crear/aprobar: operaciones mixtas porque vinculan archivo y recalculan consolidado. Descarga de archivo: mantener en Python. Conservar alias existentes mientras haya consumidores. |
| Asistencia: reporte | `GET /api/asistencia/reportes/general`, `GET /api/asistencia/reportes/consolidado` | Mantener en Python: genera Excel a partir de la plantilla institucional. |
| Registros legacy | `GET /api/asistencia`, `POST /api/asistencia` | No migrar todavía. El README lo identifica como legacy y advierte diferencias con el esquema moderno; definir consolidación con asistencia. |
| Periodos | `GET/POST /api/periodos`, `PUT /api/periodos/{id_periodo}`, `PUT /api/periodos/{id_periodo}/estado`, `GET /api/periodos/resumen`, `POST /api/periodos/reset-ciclo` | CRUD/resumen: candidatos a C#. Reset: operación de alto impacto que limpia datos/archivos; mantener en Flask hasta documentar tablas afectadas, respaldos, secuencias y permisos. |
| Comunicados | `GET/POST /api/comunicados`, `PUT/DELETE /api/comunicados/{id}` | CRUD candidato a C#. Preservar reglas de audiencia y roles administrativos. |
| Observador | `GET/POST /api/observador`, `PUT/DELETE /api/observador/{id_observacion}` | Datos: candidato a C#. |
| Observador PDF | `GET /api/observador/formato.pdf`, `GET /api/observador/{id_observacion}/formato.pdf` | Mantener en Python para conservar el formato PDF institucional. |
| Reportes y correo | `GET /api/logs`, `GET /api/reportes/grupos`, `GET /api/reportes/correos-grupo/{id_grupo}`, `POST /api/reportes/enviar-correo`, `POST /api/reportes/enviar-correo-adjunto`, `POST /api/boletines/generar`, `POST /api/boletines/sincronizar-grupo`, `POST /api/boletines/enviar-grupo`, `POST /api/boletines/sincronizar-todo` | Mantener inicialmente en Python: usa plantillas Excel, genera/almacena PDF y envía correo con adjuntos. Logs y consultas simples podrían separarse más adelante. |

## Rutas web y no activas

- Flask sirve páginas web en `/`, `/bienvenida`, `/contacto`, `/login` y
  `/register`, además de `/favicon.ico` y fragmentos bajo
  `/templates/modules html/<filename>`.
- `backend/routes/legacy/` no se registra en `iniciador.py`; sus rutas
  comentadas de Drive no son endpoints activos.
- `/static` se sirve desde el frontend configurado en Flask, no desde un
  blueprint de negocio.

## Consumidores encontrados en el frontend

El cliente común está en `frontend/static/js/api.js`; las solicitudes directas
de módulos están en `frontend/static/js/modules/`. Las URLs se llaman como
rutas relativas (`/api/...`), así que actualmente el navegador las envía al
mismo host que sirve Flask. Esto favorece mantener Flask como puerta de entrada
durante la convivencia.

| Módulo frontend | Archivos consumidores | Operaciones observadas |
|---|---|---|
| Autenticación/panel | `static/js/auth.js`, `static/js/panel.js` | Login, registro, check, perfil, cambio de contraseña y logout. Mantener estos flujos juntos hasta resolver una única identidad de sesión. |
| Usuarios, estudiantes, grados/grupos, materias y docentes | `static/js/api.js`, `modules/usuarios.js`, `modules/estudiantes.js`, `modules/grados.js`, `modules/materias.js`, `modules/docentes.js` | CRUD y consultas usan el wrapper `API`; las vistas cargan fragmentos HTML desde `/templates/modules html/...`. |
| Horarios | `static/js/api.js`, `modules/horarios.js`, `modules/horarios-gestion.js`, `modules/mi-horario.js` | CRUD/consultas vía `API`; exportación PDF llama directamente a Flask con `fetch`. |
| Periodos | `static/js/api.js`, `modules/periodos.js` | CRUD y resumen mediante `API`; `reset-ciclo` usa `fetch` directo. |
| Calificaciones | `modules/calificaciones.js` | Filtros, grupos, materias, tabla, actividades y notas llaman las APIs de datos. Acuerdos, sincronización, generación/descarga Excel y subida de planilla llaman Flask directamente o usan `API.sincronizarBoletinesTodo()`. |
| Asistencia | `modules/asistencia.js` | Filtros, tabla, guardado y resumen por `API.request`; reporte Excel, carga/descarga y aprobación de justificantes con `fetch`/`API.request`. |
| Observador | `static/js/api.js`, `modules/observador.js` | CRUD vía `API`; PDF se abre desde una URL servida por Flask. |
| Comunicados | `static/js/api.js`, `modules/comunicados.js` | CRUD mediante `API`. |
| Reportes y boletines | `static/js/api.js`, `modules/reportes.js`, `modules/estudiantes.js`, `modules/calificaciones.js` | Correos y sincronización de boletines; generación de boletines desde la vista de estudiantes. Se mantiene en Python en el primer tramo por generación/adjuntos/correo. |
| Logs | `static/js/api.js`, `modules/logs.js` | Consulta de `/api/logs`. |

### Hallazgos que afectan el plan

1. **La sincronización de planillas actual no sube automáticamente los Excel del
   escritorio del usuario.** `POST /api/calificaciones/sincronizar_carpetas`
   recorre periodos/grupos/materias en PostgreSQL y genera o regenera archivos
   bajo `ESCRITORIO`, que se calcula desde el directorio del usuario que ejecuta
   Flask. En producción eso corresponde al usuario/máquina del proceso Flask,
   no al escritorio de cada coordinadora.
2. **Sí existe una ruta de carga manual.** `POST
   /api/calificaciones/subir_planilla` recibe `archivo_excel` como multipart,
   guarda una copia en el directorio del servidor, conserva una copia anterior
   en historial y procesa notas hacia PostgreSQL. Es un flujo de archivo
   individual, no un observador automático de carpetas.
3. **La respuesta de sincronización y el mensaje del frontend no coinciden.**
   Flask devuelve `archivos_creados` y `errores`; `modules/calificaciones.js`
   lee `created_files` y `errors`. La interfaz puede mostrar cero archivos y
   cero errores aunque el backend haya devuelto otros contadores.
4. **Hay funciones antiguas en el wrapper sin consumidores encontrados.**
   `API.getCalificaciones()` llama `/api/calificaciones`, `API.getActividades()`
   llama `/api/actividades` y `API.getAsistencia()`/`registrarAsistencia()` usan
   el endpoint legacy `/api/asistencia`. La búsqueda del frontend no encontró
   llamadas a esas funciones; la vista actual de calificaciones usa las rutas
   `/api/calificaciones/...` y asistencia usa `/api/asistencia/...` (con sufijos).
   Confirmar carga dinámica antes de retirar o corregir esos helpers.
5. La ruta `GET /api/calificaciones/estructura_carpetas/public` se describe en
   su módulo como pública, pero Flask aplica primero la comprobación global de
   sesión a todas las rutas `/api/` que no estén en `RUTAS_PUBLICAS`. Esa URL no
   figura en el conjunto público inspeccionado; probar su acceso sin sesión y
   decidir si el comentario o la política deben cambiar.

Para la sincronización escritorio-servidor habrá que acordar cómo llega el
archivo al servidor (carga web, agente de escritorio o carpeta compartida), qué
ubicación del servidor es la fuente oficial y cómo preservar conflictos e
historial. El navegador no puede leer automáticamente una carpeta arbitraria
del escritorio del usuario mediante este endpoint actual.

## Estado C# verificado en el repositorio

`backend-csharp/Program.cs` mapea actualmente:

- `GET /` y `GET /api/health`.
- CRUD de usuarios y `GET /api/roles`.
- Login, registro, check, logout, perfil y cambio de contraseña.

Las consultas y modelos viven en `Modules/Auth/`, `Modules/Usuarios/`,
`Modules/Academico/`, `Modules/Estudiantes/`, `Modules/Docentes/` y
`Modules/Horarios/`; la conexión está en
`Data/PostgresConnectionFactory.cs`. Académico, Estudiantes y las consultas de
Docentes y Horarios están mapeados en C#. Flask sigue siendo la entrada del
frontend y conserva los blueprints Python. No hay todavía módulos C# de
calificaciones, asistencia, periodos, comunicados, observador ni reportes.

La autenticación C# usa la cookie `proyecto_grado_auth`; Flask usa su sesión
propia. Además, Flask declara rutas públicas en `backend/utils/constants.py` y
su `before_request` protege las demás rutas `/api/`. Por tanto, la convivencia
requiere resolver explícitamente la identidad y los roles para las llamadas a
C# sin exponer un bypass de autorización.

## Secuencia propuesta de trabajo

1. Cerrar el contrato de usuarios/auth y definir el paso seguro de identidad
   Flask -> C#; conservar las rutas públicas actuales.
2. Migrar y comparar estudiantes y académico, que son dependencias de los demás
   módulos.
3. Migrar docentes y las operaciones de horarios; mantener la exportación PDF
   en Python.
4. Separar operaciones de datos de calificaciones de las rutas Excel/PDF y de
   sincronización de archivos. Python conserva documentos y sincronización.
5. Consolidar `registros` con asistencia moderna; migrar luego las operaciones
   de datos y conservar justificantes/archivos/reportes documentales en Python.
6. Migrar comunicados, observador (CRUD), y consultas sencillas de reportes.
   Mantener PDFs, boletines, adjuntos y correo en Python.
7. Tratar el reset de periodos y cualquier operación destructiva aparte, con
   alcance de tablas, archivos y recuperación documentados antes de moverla.

Cada etapa conserva la URL pública y contrasta respuesta, permisos, datos y
efectos sobre archivos antes de cambiar el destino interno de una ruta.

## Criterio acordado para el avance híbrido

La migración se planifica por responsabilidad de cada operación, de modo que un
módulo puede quedar repartido entre C# y Python:

| Responsabilidad | Destino previsto |
|---|---|
| Consultar y modificar datos de negocio, validar reglas y persistir en PostgreSQL | C# cuando el módulo y sus dependencias estén migrados y comparados |
| Generar o procesar PDF/Excel, aplicar plantillas, guardar adjuntos y producir reportes institucionales | Python, conservando los formatos y flujos existentes |
| Recibir solicitudes del frontend y conservar URLs y sesión durante la transición | Flask como puerta de entrada |

Aplicación por módulo:

- **Observador:** CRUD de observaciones puede pasar a C#; generación y descarga
  de formatos PDF permanecen en Python.
- **Asistencia:** consulta y registro de datos pueden pasar a C# tras consolidar
  el contrato con `registros`; justificantes con archivo y reportes Excel
  permanecen inicialmente en Python.
- **Calificaciones:** filtros, actividades y notas pueden pasar a C#; planillas,
  sincronización, acuerdos y archivos Excel/PDF permanecen inicialmente en
  Python.
- **Horarios:** CRUD y consultas funcionales pueden pasar a C#; exportación PDF
  permanece en Python.
- **Reportes y boletines:** consultas simples se pueden evaluar para C#; la
  generación de documentos, adjuntos y correo permanece inicialmente en Python.

Estas asignaciones describen el destino de la arquitectura, no afirman que cada
ruta ya esté migrada o activada. Para cada operación se conserva la ruta Python
hasta comprobar el contrato del frontend, roles, validaciones, persistencia y
salida documental. La activación del proxy se realiza por rutas y métodos
explícitos; las operaciones mixtas de un mismo módulo pueden continuar en
Python.

## Activación gradual del proxy de módulos funcionales

Para usar Estudiantes, Académico, Docentes y/o Horarios en C# detrás de
las mismas URLs, configura
en ambos procesos:

- `CSHARP_PROXY_MODULES=estudiantes,academico` (o solo el módulo que quieras
  activar).
- El mismo valor privado para `CSHARP_PROXY_SECRET`.
- En Flask, `CSHARP_API_URL=http://127.0.0.1:5124` (ajustar según el entorno).

C# solo acepta el proxy para los módulos incluidos en su propia lista
`CSHARP_PROXY_MODULES`, valida el secreto en tiempo constante y construye la
identidad autenticada con los datos de sesión que Flask reenvía. Reinicia Flask
y ASP.NET Core después de configurar las variables. Si se vacía el módulo en
Flask, el blueprint Python vuelve a atender las rutas; el código Python no se
elimina. `/api/periodos` no se incluye en el proxy académico y sigue en Flask.
En Docentes, el proxy respeta el método: GET va a C# y el POST masivo de
asignaciones permanece atendido por Python; el formulario envía grado, grupo y
materia, y el guardado conserva como inactivas las asignaciones retiradas. En Horarios, el CRUD y las consultas
van a C#, salvo `/api/horarios/exportar-pdf`, que sigue en Flask.
Si C# no responde mientras el proxy está activo, Flask devuelve 502 para evitar
escrituras divergentes entre implementaciones.

Este primer tramo aún requiere comparar respuestas, roles y efectos de auditoría
en desarrollo antes de activarlo en producción.

## Datos todavía por confirmar antes de extender el proxy

- Puerto/URL de C# por entorno y si Flask/C# corren en el mismo host o contenedor.
- Qué vistas y scripts del frontend llaman a cada ruta, especialmente las de
  calificaciones.
- Contrato de archivos de escritorio-servidor: carpetas locales, carpeta
  objetivo del servidor, política de conflictos/versiones y comportamiento
  cuando el equipo está desconectado.
- Roles que pueden ejecutar cada operación funcional; el control actual de Flask
  protege la sesión globalmente, pero algunas rutas aplican reglas específicas.
- Si los documentos se guardan como archivos finales, temporales o ambos, y qué
  estructura en `storage/` es la fuente oficial.
