# Seguimiento de migracion PostgreSQL y C#

Este archivo registra el avance por modulo. La regla es terminar y probar un
bloque Python antes de reconstruirlo en C#.

## Estados

- `pendiente`: aun no revisado.
- `sintaxis PostgreSQL`: no se encontraron construcciones MySQL en la ruta activa;
  requiere validacion contra el esquema real.
- `revisar instancia`: quedan consultas o DDL por contrastar con la base migrada.
- `postgres`: SQL principal compatible.
- `validado`: probado contra el contenedor PostgreSQL.
- `csharp`: reconstruido en .NET.

## Modulos

| Modulo | Python | PostgreSQL | C# | Referencia |
|---|---|---|---|---|
| Conexion | `utils/database.py` | validado | pendiente | `utils/database.py` |
| Auth | `routes/auth/` | sintaxis PostgreSQL | en progreso | `routes/auth/README.md`, `backend-csharp/Modules/Auth/` |
| Usuarios | `routes/usuarios/` | sintaxis PostgreSQL | en progreso | `routes/usuarios/README.md`, `backend-csharp/Modules/Usuarios/` |
| Estudiantes | `routes/estudiantes/` | sintaxis PostgreSQL | en progreso | `routes/estudiantes/README.md`, `backend-csharp/Modules/Estudiantes/` |
| Academico | `routes/academico/` | sintaxis PostgreSQL | en progreso | `routes/academico/README.md`, `backend-csharp/Modules/Academico/` |
| Comunicados | `routes/comunicados/` | sintaxis PostgreSQL | pendiente | `routes/comunicados/README.md` |
| Logs y reportes | `routes/reportes/` | revisar instancia | pendiente | `routes/reportes/README.md` |
| Asistencia | `routes/asistencia/` | sintaxis PostgreSQL | pendiente | `routes/asistencia/README.md` |
| Horarios | `routes/horarios/` | sintaxis PostgreSQL | pendiente | `routes/horarios/README.md` |
| Calificaciones | `routes/calificaciones/` | revisar instancia | pendiente | `routes/calificaciones/README.md` |
| Periodos | `routes/periodos/` | sintaxis PostgreSQL | pendiente | `routes/periodos/README.md` |
| Observador | `routes/observador/` | sintaxis PostgreSQL | pendiente | `routes/observador/README.md` |
| Legacy | `routes/legacy/` | excluido | excluido | `routes/legacy/README.md` |

## Regla de migracion SQL

- `ON DUPLICATE KEY UPDATE` -> `ON CONFLICT (...) DO UPDATE`
- `VALUES(columna)` -> `EXCLUDED.columna`
- `INSERT IGNORE` -> `ON CONFLICT DO NOTHING`
- `AUTO_INCREMENT` -> identity o secuencia
- `SHOW TABLES` -> `information_schema`
- `mysql.connector.Error` -> errores de `psycopg`

## Criterio para marcar un modulo como validado

1. No contiene SQL exclusivo de MySQL en su ruta activa.
2. Sus lecturas y escrituras pasan contra PostgreSQL.
3. Sus tablas y claves coinciden con la base migrada.
4. Tiene una prueba reproducible.
5. Su comportamiento queda documentado para reconstruirlo en C#.

## Orden de trabajo

1. Conexion y configuracion.
2. Auth y usuarios.
3. Estudiantes y academico.
4. Comunicados y logs.
5. Asistencia.
6. Periodos y horarios.
7. Calificaciones.
8. Reportes y observador.

`registros` se mantiene como legacy hasta definir si se consolida con
`asistencia`.

## Primer slice C#

Se creó `backend-csharp/ProyectoGrado.Api.csproj` como API paralela. El slice
implementa health, lectura y CRUD de usuarios/roles, login, registro, cookie de
sesión, perfil, logout y cambio de contraseña. Los hashes BCrypt existentes se
verifican sin reemplazarlos. Flask continúa siendo la aplicación activa hasta
completar pruebas comparativas y autorización administrativa.
