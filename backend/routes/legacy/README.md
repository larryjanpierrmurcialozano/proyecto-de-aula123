# Legacy e integraciones experimentales

Contiene `temp.py` y `servicio_drive.py`. No forman parte del registro activo de
blueprints. Conservan consultas antiguas de MySQL y dependen de una tabla
`calificaciones` que no existe en el esquema PostgreSQL migrado. No activar ni
migrar esos módulos hasta definir su contrato y su esquema de destino.
