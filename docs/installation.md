# Instalacion y dependencias

Este documento describe como ejecutar el instalador y como instalar LibreOffice.

## Ejecutar el instalador de imports

Si quieres permisos elevados, abre PowerShell como Administrador y ejecuta:

```powershell
C:\python314\python.exe "C:\Users\Larry\OneDrive\Escritorio\sexoooooo\proyecto de grado\backend\instalador_imports.py"
```

Opciones utiles:

```powershell
# Forzar upgrade/reinstalacion
C:\python314\python.exe "C:\Users\Larry\OneDrive\Escritorio\sexoooooo\proyecto de grado\backend\instalador_imports.py" --force

# Omitir LibreOffice
C:\python314\python.exe "C:\Users\Larry\OneDrive\Escritorio\sexoooooo\proyecto de grado\backend\instalador_imports.py" --no-libreoffice
```

Si usas VS Code con Run, no se elevan permisos automaticamente.

## Instalar LibreOffice

### Opcion A: Chocolatey (requiere Admin)

Abrir PowerShell como Administrador y ejecutar:

```powershell
choco install libreoffice -y
```

Si aparece un error de permisos o lock file en `C:\ProgramData\chocolatey\lib`, cierra procesos de choco y reintenta.

### Opcion B: Manual

1. Descargar desde: https://www.libreoffice.org/download/
2. Instalar LibreOffice.
3. Verificar con:

```powershell
soffice --version
```

Si `soffice` no aparece en PATH, agrega esta ruta al PATH del sistema:

```
C:\Program Files\LibreOffice\program

---

# Respaldo y restauracion historica de MySQL

La aplicacion activa usa PostgreSQL. Estas instrucciones solo aplican para
exportar o restaurar una base MySQL/MariaDB antigua antes de migrarla.

## 1) Exportar la base de datos (equipo actual)

```powershell
python scripts/database/db_backup.py export --out storage/backups/db_dump.sql
```

## 2) Importar la base de datos (equipo nuevo)

```powershell
python scripts/database/db_backup.py import --in storage/backups/db_dump.sql
```

## 3) Importar solo si la base NO existe

```powershell
python scripts/database/db_backup.py import-if-missing --in storage/backups/db_dump.sql
```

## Notas

- El script usa las credenciales definidas en `backend/.env` (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
- Requiere que el cliente `mysqldump` y `mysql` esten en el PATH.
- El respaldo incluye `CREATE DATABASE` y `USE`, por lo que se requiere permiso para crear la base.
```
