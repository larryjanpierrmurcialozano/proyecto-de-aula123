# Migracion de MySQL a PostgreSQL

La configuracion activa del backend usa PostgreSQL con `psycopg 3`. Este
documento conserva los pasos para migrar los datos historicos desde MySQL y
describe las comprobaciones que aun deben hacerse contra la instancia destino.

El backup PostgreSQL disponible en `storage/backups/` contiene 27 tablas,
relaciones foraneas, datos iniciales y secuencias. No hay un dump MySQL en el
repositorio para comparar ambas bases. El dump PostgreSQL no incluye el trigger
de auditoria de estudiantes; su definicion esta en
`scripts/database/trigger_delete_estudiante.sql` y debe instalarse aparte.
El archivo SQL de MySQL no debe
ejecutarse directamente en PostgreSQL: contiene sintaxis propia de MySQL como
`AUTO_INCREMENT`, `ENUM`, backticks, `ON DUPLICATE KEY`, `INSERT IGNORE` y
`DELIMITER`.

## Estrategia recomendada

Para instalaciones pendientes, usar `pgloader` en la primera transferencia
de estructura y datos y corregir los tipos, restricciones y triggers que
dependan de la semantica de MySQL.

Orden de migracion de datos (para instalaciones que aun no la hayan completado):

1. Crear PostgreSQL y un usuario de aplicacion.
2. Ejecutar `pgloader` con una configuracion local que no se versiona.
3. Revisar tablas, claves, secuencias y conteos.
4. Crear las restricciones y triggers PostgreSQL.
5. Configurar el backend con los valores `DB_*` o `POSTGRES_*`.
6. Validar cada modulo y sus tablas contra la instancia PostgreSQL migrada.

## Requisitos

- PostgreSQL 16 o superior.
- `pgloader` ejecutable desde WSL, Linux o Docker.
- MySQL activo durante la transferencia.
- Una copia del backup actual en `storage/backups/`.

En Windows, una alternativa practica es ejecutar `pgloader` desde WSL o
Docker. No se recomienda exponer la contrasena real en el archivo `.load`.

## Levantar PostgreSQL en Docker

La infraestructura base esta definida en
`docker-compose.postgres.yml`. Crea primero un archivo `.env` local a partir
de `.env.postgres.example` y cambia la contrasena:

```powershell
Copy-Item .env.postgres.example .env.postgres
docker compose --env-file .env.postgres -f docker-compose.postgres.yml up -d
```

En Windows también puedes ejecutar el script del proyecto:

```powershell
.\scripts\start_postgres.ps1
```

El script crea `.env.docker` si no existe, genera una contraseña segura cuando
no se ha definido una, inicia PostgreSQL en el puerto `5432` y conserva los
datos en el volumen `postgres_data`. Para indicar una contraseña y un puerto
distintos:

```powershell
.\scripts\start_postgres.ps1 -Password "UnaContraseñaSegura" -Port 5433
```

El puerto del computador anfitrión puede cambiarse; dentro del contenedor
PostgreSQL siempre escucha en el puerto `5432`.

El script utiliza `scripts/database/initial_schema.dump`, un respaldo de
PostgreSQL en formato personalizado, para restaurar automáticamente la
estructura de la base de datos. Se usa `pg_restore --schema-only`, por lo que
se crean las tablas, secuencias, índices y restricciones, pero no se cargan
los registros del respaldo. La restauración se ejecuta una sola vez por
volumen; los siguientes arranques conservan la estructura y los datos nuevos.

Comprobar el estado:

```powershell
docker compose --env-file .env.postgres -f docker-compose.postgres.yml ps
```

La conexion local queda disponible en `localhost:5432`. El volumen
`postgres_data` conserva los datos aunque el contenedor se reinicie. Para
detener el servicio sin borrar datos:

```powershell
docker compose --env-file .env.postgres -f docker-compose.postgres.yml stop
```

No uses `docker compose down -v` salvo que quieras borrar completamente la
base del volumen.

## Crear servidor y base destino

Ejecutar en `psql` como administrador de PostgreSQL:

```sql
CREATE ROLE docstry_app LOGIN PASSWORD 'CAMBIAR_ESTA_CLAVE';
CREATE DATABASE anexo_de_datos OWNER docstry_app
    ENCODING 'UTF8' TEMPLATE template0;
```

Despues, conectar a la base y dejar el esquema por defecto:

```sql
\c anexo_de_datos
ALTER SCHEMA public OWNER TO docstry_app;
GRANT USAGE, CREATE ON SCHEMA public TO docstry_app;
```

## Ejecutar transferencia

La configuracion de `pgloader` debe usar la base MySQL existente como origen y
PostgreSQL como destino. No hay un archivo `.load` versionado en este
repositorio; crea uno local y no incluyas credenciales reales en Git:

```text
mysql://USUARIO:CLAVE@HOST/BASE -> postgresql://USUARIO:CLAVE@HOST/BASE
```

Ejemplo desde WSL o Linux:

```bash
pgloader ruta/al/archivo-local.load
```

La carga debe ejecutarse sobre una base PostgreSQL vacia. Para repetirla,
elimina y crea de nuevo la base destino, o utiliza una base de prueba separada.

## Verificacion posterior

En PostgreSQL:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

SELECT COUNT(*) FROM usuarios;
SELECT COUNT(*) FROM estudiantes;
SELECT COUNT(*) FROM log_registro;

SELECT conname
FROM pg_constraint
WHERE contype = 'f'
ORDER BY conname;
```

Los conteos deben compararse con el origen antes de cambiar la aplicacion. El
backup version local disponible fue generado el 30 de septiembre de 2026 y no
confirma por si solo el estado actual de la base en ejecucion.

## Compatibilidad de tipos

| MySQL | PostgreSQL recomendado |
|---|---|
| `INT AUTO_INCREMENT` | `integer GENERATED BY DEFAULT AS IDENTITY` |
| `TINYINT(1)` | `boolean` cuando el campo sea realmente binario; `smallint` si admite otros valores |
| `DATETIME` | `timestamp without time zone` |
| `TIMESTAMP` | `timestamp with time zone` o `timestamp` segun la semantica existente |
| `ENUM` | `text` con `CHECK`, o un tipo `CREATE TYPE` si se desea rigidez |
| `JSON` | `jsonb` |
| `utf8mb4` | `UTF8` nativo de PostgreSQL |
| `ON UPDATE CURRENT_TIMESTAMP` | trigger `set_updated_at()` |

Los valores de `ENUM` deben conservarse, especialmente en campos como
`audiencia`, `estado`, `tipo_accion` y `tipo_comunicado`. No conviene cambiar
sus valores durante esta migracion.

## Cambios necesarios en la aplicacion

Las rutas Flask activas usan `psycopg 3`; las consultas compartidas conservan
`%s` como placeholder, que `psycopg` acepta. Para migrar SQL adicional desde
MySQL, aplica estas conversiones:

- `mysql.connector` por `psycopg`.
- Comillas invertidas de SQL por identificadores normales o comillas dobles.
- `INSERT IGNORE` por `ON CONFLICT DO NOTHING`.
- `ON DUPLICATE KEY UPDATE` por `ON CONFLICT (...) DO UPDATE`.
- `LAST_INSERT_ID()` por `RETURNING id_columna`.
- `SHOW TABLES` por `information_schema` o `pg_catalog`.
- `ALTER TABLE ... AUTO_INCREMENT` por `ALTER SEQUENCE` o reinicio de identity.
- `DELETE FROM tabla WHERE 1` por `DELETE FROM tabla`.
- `VALUES(columna)` dentro de upserts por `EXCLUDED.columna`.
- Triggers MySQL con `DELIMITER` por funciones `plpgsql` y `CREATE TRIGGER`.

La capa `utils/database.py` adapta `dictionary=True` a `dict_row`. El nuevo
código puede usar directamente `conn.cursor(row_factory=dict_row)`.

## Triggers y auditoria

El trigger PostgreSQL `trg_estudiantes_before_delete`, definido en
`scripts/database/trigger_delete_estudiante.sql`, conserva estas
responsabilidades:

1. Contar las relaciones del estudiante eliminado.
2. Insertar una entrada en `log_registro`.
3. Usar los valores transaccionales `app.user_id`, `app.ip`, `app.agent` y
   los conteos previos de `app.student_delete_counts`.
4. Ejecutarse antes del `DELETE`.

No se debe copiar literalmente la sintaxis MySQL del backup.

## Migracion segura de la aplicacion

El backend admite `DB_*` y, como alternativa, las variables `POSTGRES_*`:

```env
POSTGRES_PORT=5432
POSTGRES_DB=anexo_de_datos
POSTGRES_USER=docstry_app
POSTGRES_PASSWORD=replace_with_a_strong_unique_password
```

La conexion de la aplicacion ya apunta a PostgreSQL. La instancia migrada y el
comportamiento funcional de todas las rutas deben validarse antes de retirar
los respaldos historicos de MySQL.

## Criterio de finalizacion

La migracion se considera terminada cuando:

- Las 27 tablas existen en PostgreSQL.
- Los conteos de datos coinciden con el origen.
- Las claves foraneas y secuencias funcionan.
- El trigger de auditoria registra eliminaciones.
- El backend puede iniciar usando solo PostgreSQL.
- Las rutas principales responden igual que antes.
- Se genera y restaura un backup PostgreSQL independiente.
