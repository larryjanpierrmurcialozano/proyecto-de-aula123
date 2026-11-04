# Usuarios

- Python: `routes.py`
- Responsabilidad: usuarios, roles y permisos.
- Tablas principales: `usuarios`, `roles`, `permisos`, `log_registro`.
- Configuracion: conexion definida en `utils/database.py`.
- PostgreSQL: usa `psycopg`; faltan verificaciones de escrituras y auditoria.
- Pendientes: revisar escrituras, hash de contrasenas y auditoria.
