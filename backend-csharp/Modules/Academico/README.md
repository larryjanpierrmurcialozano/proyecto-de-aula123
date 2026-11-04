# Módulo Académico en C#

Implementación paralela de las rutas académicas Flask de
`backend/routes/academico/routes.py`. Incluye grados, grupos, materias,
docentes disponibles y asignaciones de docente.

## Archivos

- `AcademicoEndpoints.cs`: registra las rutas HTTP bajo `/api` y conserva las
  claves JSON que consume el frontend actual.
- `AcademicoModels.cs`: solicitudes JSON con nombres de campos compatibles con
  Flask (`id_grado`, `nombre_materia`, etc.).
- `AcademicoQueries.cs`: consultas PostgreSQL y reglas de dependencia/validación.

## Estado de transición

- El módulo se ejecuta en el proyecto ASP.NET Core y usa la conexión PostgreSQL
  compartida configurada en `ConnectionStrings:Postgres`.
- Todas sus rutas exigen autenticación de C# cuando se llaman directamente.
- El frontend sigue llamando a Flask; no hay proxy ni cambio de blueprint.
- Los archivos Python permanecen como implementación activa y referencia de
  comportamiento hasta completar comparación de respuestas y permisos.
- Antes de enrutar tráfico desde Flask, definir cómo se transmiten de forma
  segura la identidad y el rol de la sesión Flask.

## Rutas

- Grados: `GET/POST /api/grados`, `GET/PUT/DELETE /api/grados/{id}` y
  `GET /api/grados/{gradoId}/grupos`.
- Grupos: `GET/POST /api/grupos`, `GET/PUT/DELETE /api/grupos/{id}` y
  `GET /api/grupos/{id}/estudiantes`.
- Materias: `GET/POST /api/materias`, `GET/PUT/DELETE /api/materias/{id}` y
  `GET /api/materias/{materiaId}/docentes-disponibles`.
- Asignaciones: `POST /api/asignaciones-docente` y
  `DELETE /api/asignaciones-docente/{id}`.
