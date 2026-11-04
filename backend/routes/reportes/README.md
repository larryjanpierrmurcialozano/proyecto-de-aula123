# Reportes y logs

- Python: `routes.py`
- Responsabilidad: reportes, exportaciones, correo y auditoria.
- Tablas principales: `log_registro`, `reportes_inasistencias`, `usuarios`.
- Configuracion: SMTP en `backend/.env`.
- PostgreSQL/C#: separar reportes, correo y auditoria en servicios independientes.
- Estado PostgreSQL: revisar DDL y escrituras contra el esquema migrado.
