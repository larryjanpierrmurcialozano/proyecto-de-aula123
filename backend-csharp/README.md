# ProyectoGrado.Api

Primera base ASP.NET Core para migrar progresivamente las rutas Flask a C#.
Este proyecto funciona en paralelo: no reemplaza todavÃ­a `backend/`.

## Slice implementado

- `GET /api/health`: comprueba la conexiÃ³n al PostgreSQL de Docker.
- `GET /api/usuarios`: lista usuarios con su rol.
- `GET /api/usuarios/{id}`: obtiene el detalle de un usuario.
- `GET /api/roles`: lista roles.
- `GET /api/auth/profile`: obtiene el perfil autenticado.
- `POST /api/auth/login`: inicia sesiÃ³n con cookie HttpOnly.
- `POST /api/auth/register`: registra un usuario con rol Profesor.
- `GET /api/auth/check`: comprueba la cookie de sesiÃ³n.
- `POST /api/auth/change-password`: cambia la contraseÃ±a verificando la actual.
- `POST /api/auth/logout`: elimina la cookie de sesiÃ³n.
- `POST /api/usuarios`: crea un usuario.
- `PUT /api/usuarios/{id}`: actualiza un usuario.
- `DELETE /api/usuarios/{id}`: elimina un usuario.

## MÃ³dulo acadÃ©mico en paralelo

Se agregÃ³ `Modules/Academico/` para grados, grupos, materias y asignaciones de
docentes. Conserva los contratos de las rutas Flask correspondientes y requiere
autenticaciÃ³n mediante la cookie de C# cuando se ejecuta directamente en el
puerto de ASP.NET Core. Flask continÃºa atendiendo las URLs del frontend; sus
blueprints no se han cambiado ni eliminado.

- Grados: `GET/POST /api/grados`, `GET/PUT/DELETE /api/grados/{id}` y
  `GET /api/grados/{gradoId}/grupos`.
- Grupos: `GET/POST /api/grupos`, `GET/PUT/DELETE /api/grupos/{id}` y
  `GET /api/grupos/{id}/estudiantes`.
- Materias: `GET/POST /api/materias`, `GET/PUT/DELETE /api/materias/{id}` y
  `GET /api/materias/{materiaId}/docentes-disponibles`.
- Asignaciones: `POST /api/asignaciones-docente` y
  `DELETE /api/asignaciones-docente/{id}`.

Este es un despliegue paralelo, no un cambio de destino desde Flask. La
integraciÃ³n Flask -> C# queda pendiente hasta acordar el paso seguro de sesiÃ³n
y roles entre servicios.

## MÃ³dulo Estudiantes en paralelo

Se agregÃ³ `Modules/Estudiantes/` para el CRUD que existe en Flask. Mantiene las
cinco rutas `/api/estudiantes` y exige cookie de autenticaciÃ³n C# al llamarlas
directamente. La eliminaciÃ³n ejecuta la limpieza de relaciones dentro de una
transacciÃ³n y pasa usuario, IP, agente y conteos al trigger de auditorÃ­a
PostgreSQL.

## Consultas de Docentes

`Modules/Docentes/` implementa las consultas de administraciÃ³n y del panel del
docente. Lee docente disponibles, asignaciones, grados/grupos, materias propias
y horario, reutilizando el identificador de usuario validado por Flask al
reenviar las solicitudes.

## Horarios

`Modules/Horarios/` contiene consulta con filtros, detalle, altas, ediciÃ³n,
eliminaciÃ³n, asignaciones por grupo/grado y catÃ¡logo de niveles. El alta valida
cruces de horario del grupo y del docente; las operaciones de escritura intentan
registrar la acciÃ³n en `log_registro` sin revertir el cambio si ese registro
auxiliar no estÃ¡ disponible. `POST /api/horarios/exportar-pdf` permanece en
Flask para preservar el formato institucional.

Al ejecutar C# con `dotnet run`, cada solicitud se registra en consola con
mÃ©todo, ruta, cÃ³digo HTTP y duraciÃ³n. No se registran cuerpos de solicitud ni
contraseÃ±as.

Las consultas usan parÃ¡metros PostgreSQL (`$1`) y no interpolan valores
provenientes de la solicitud. Las contraseÃ±as usan BCrypt compatible con los
hashes existentes en la base migrada.

## Ejecutar

Desde la raÃ­z del repositorio:

```powershell
dotnet run --project backend-csharp\ProyectoGrado.Api.csproj
```

La cadena base estÃ¡ en `appsettings.json` sin contraseÃ±a. En desarrollo, la
contraseÃ±a se guarda fuera del repositorio mediante .NET User Secrets:

```powershell
dotnet user-secrets set "ConnectionStrings:Postgres" `
  "Host=localhost;Port=5432;Database=anexo_de_datos;Username=docstry_app;Password=TU_CONTRASENA" `
  --project backend-csharp\ProyectoGrado.Api.csproj
```

Para otros entornos se debe usar la variable de entorno
`ConnectionStrings__Postgres`.

## Estado de migraciÃ³n

Este slice ya puede probarse en paralelo con Flask. La cookie de C# es
independiente de la sesiÃ³n Flask, por lo que todavÃ­a no se debe cambiar el
frontend global ni apagar Flask. Antes del corte se deben validar permisos de
administrador para eliminaciones, comparar respuestas con Flask y configurar
CORS/clave de protecciÃ³n de cookies por entorno.

## IntegraciÃ³n opcional detrÃ¡s de Flask

Los mÃ³dulos Estudiantes, AcadÃ©mico y las consultas GET de Docentes pueden
recibir solicitudes reenviadas por Flask sin cambiar las URLs del frontend. La
opciÃ³n estÃ¡ apagada por defecto y Flask conserva los blueprints como
implementaciÃ³n local cuando no se habilita.

Configura en Flask y ASP.NET Core el mismo secreto privado en
`CSHARP_PROXY_SECRET` y permite `estudiantes` y/o `academico` en
`CSHARP_PROXY_MODULES` de ambos procesos (separados por coma). En Flask,
configura ademÃ¡s `CSHARP_API_URL` con la direcciÃ³n del
servidor C# (por defecto `http://127.0.0.1:5124`). Reinicia ambos procesos para
que lean las variables. C# valida el secreto y solo acepta mÃ³dulos incluidos
en su lista de permitidos. Si C# no estÃ¡ disponible durante el proxy, Flask
responde 502; vaciar `CSHARP_PROXY_MODULES` en Flask restaura el servicio
directo desde Python.

`estudiantes` enruta el CRUD de estudiantes. `academico` enruta grados, grupos,
materias y asignaciones de docente. `docentes` enruta sus consultas GET y
`horarios` enruta CRUD y consultas de datos. `/api/periodos` permanece en Flask
porque no pertenece al conjunto de endpoints acadÃ©micos implementado en C#.

`docentes` enruta por ahora solo consultas GET: lista, disponibles, asignaciones,
grados/grupos y el panel `mis-materias`/`mi-horario`. La escritura
`POST /api/docentes/{id}/asignaciones` se mantiene en Python: reemplaza de forma
masiva las asignaciones y usa un contrato anterior que no incluye grupo.

Antes de habilitarlo para usuarios reales, compara en desarrollo las rutas CRUD,
permisos por rol, efectos de eliminaciÃ³n y auditorÃ­a PostgreSQL.
