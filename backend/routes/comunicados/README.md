# Comunicados

- Python: `routes.py`
- Responsabilidad: comunicados de rectoria.
- Tabla principal: `comunicados_rectoria`.
- Valores de `audiencia`: `Todos`, `Estudiantes`, `Docentes`, `Padres`, `Administrativo`.
- PostgreSQL/C#: conservar validacion de enum y permisos administrativos.
- Estado PostgreSQL: usa la conexion `psycopg`; falta validar lecturas y
  escrituras contra la instancia migrada.
