# Asistencia

- Python: `routes.py`
- Responsabilidad: asistencia diaria, detalle, justificantes y consolidados.
- Tablas principales: `asistencias_diarias`, `detalle_asistencia`, `asistencia`, `asistencias_por_periodo`.
- Archivos: `storage/uploads/justificantes/`.
- Estado PostgreSQL: upserts implementados con `ON CONFLICT`; validar contra
  el esquema migrado.
- Pendientes: validar escrituras y retirar la dependencia legacy.
