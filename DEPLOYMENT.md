# Preparación de despliegue

El contenedor sirve tanto Flask como el frontend; las llamadas `/api/...` siguen siendo del mismo origen. La base PostgreSQL se configura como servicio externo para que el despliegue no cree una base vacía por accidente. Los archivos subidos se guardan en el volumen Docker `app_uploads`.

## Preparar configuración

1. Copia `.env.production.example` como `.env.production` en el host de despliegue.
2. Configura una base PostgreSQL ya migrada y accesible desde Docker. Usa credenciales propias del despliegue y genera un `SECRET_KEY` aleatorio y privado.
3. Mantén `DB_SSLMODE=require` cuando el proveedor de PostgreSQL requiera TLS.
4. Configura TLS HTTPS en el proxy o plataforma que publique el puerto `8000`. La app marca las cookies de sesión como seguras en producción.

## Construir y arrancar

Desde la raíz del proyecto, en el host:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
```

Para ver registros:

```sh
docker compose --env-file .env.production -f docker-compose.production.yml logs -f app
```

La ruta `/api/health` permite comprobar que Flask responde. Antes de publicar, restaura o migra la base de datos y confirma el trigger de borrado de estudiantes en la instancia de destino. No apuntes el despliegue a la base local de desarrollo.

## Migrar contraseñas de prueba

El script `scripts/database/migrate_test_passwords.py` busca cuentas cuyo hash bcrypt corresponda a la contraseña de prueba que indiques. Desde la raíz del proyecto y con las variables de conexión PostgreSQL configuradas, primero ejecuta:

```sh
python scripts/database/migrate_test_passwords.py
```

Ingresa la contraseña actual cuando el script la solicite; por defecto solo informa cuántas cuentas coinciden y no modifica datos. Después de revisar el resultado y contar con un respaldo, repite el comando con `--apply` e ingresa la nueva contraseña para las cuentas encontradas dos veces. El script valida que cumpla la regla de letras y números, genera un hash bcrypt diferente por cuenta y solo actualiza filas que sigan teniendo el hash detectado.

## Datos persistentes

El volumen `app_uploads` conserva los justificantes y otros archivos cargados entre recreaciones del contenedor. Inclúyelo en el plan de respaldos junto con PostgreSQL. La imagen omite los archivos que estén en `storage/uploads` durante el build.
