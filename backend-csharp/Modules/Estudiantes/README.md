# Módulo Estudiantes en C#

Implementación paralela de `backend/routes/estudiantes/routes.py`.

## Rutas

- `GET /api/estudiantes`: lista estudiantes con grupo y grado.
- `GET /api/estudiantes/{id}`: obtiene un estudiante; responde con
  `estudiante: null` si no existe, como el endpoint Flask actual.
- `POST /api/estudiantes`: crea estudiante y devuelve su `id`.
- `PUT /api/estudiantes/{id}`: actualiza los campos editables.
- `DELETE /api/estudiantes/{id}`: elimina el registro y sus relaciones
  dependientes dentro de una transacción.

## Auditoría de eliminación

La operación establece `app.user_id`, `app.ip` y `app.agent` en la transacción,
guarda los conteos de relaciones en `app.student_delete_counts`, limpia las
tablas dependientes y elimina el estudiante. Así el trigger
`trg_estudiantes_before_delete` puede conservar la auditoría esperada.

## Estado de transición

- Todas las rutas requieren la cookie de autenticación de C# al llamarlas
  directamente.
- Flask continúa atendiendo el frontend; su blueprint Python no se ha cambiado.
- La comparación funcional contra la instancia PostgreSQL y la integración
  Flask -> C# siguen pendientes.
