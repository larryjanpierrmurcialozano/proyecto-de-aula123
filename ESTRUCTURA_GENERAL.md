# Estructura general del proyecto

Este documento presenta el plano general del proyecto, tomando como referencia
la estructura fuente actual. La aplicación utiliza Flask como puerta de entrada
del frontend y mantiene un backend ASP.NET Core en C# para la migración
progresiva de módulos. Se muestran los componentes necesarios para entender la
aplicación y se omiten los archivos generados, temporales o sensibles incluidos
en `.gitignore`.

## Plano general

```text
proyecto de aula123/
|
|-- backend/                         Backend Python/Flask
|   |-- iniciador.py                 Punto de entrada y registro de la aplicación
|   |-- instalador_imports.py        Preparación de dependencias/importaciones
|   |-- requirements.txt             Dependencias del backend Python
|   |-- routes/                      Rutas y módulos funcionales de la API
|   |   |-- academico/
|   |   |-- asistencia/
|   |   |-- auth/
|   |   |-- calificaciones/
|   |   |-- comunicados/
|   |   |-- docentes/
|   |   |-- estudiantes/
|   |   |-- horarios/
|   |   |-- legacy/                  Código heredado no registrado por Flask
|   |   |-- observador/
|   |   |-- periodos/
|   |   |-- registros/
|   |   |-- reportes/
|   |   |-- usuarios/
|   |   `-- __init__.py
|   `-- utils/                       Utilidades compartidas
|       |-- constants.py
|       |-- database.py
|       |-- helpers.py
|       `-- __init__.py
|
|-- backend-csharp/                  Backend ASP.NET Core en C#
|   |-- Program.cs                   Configuración y punto de entrada de la API
|   |-- ProyectoGrado.Api.csproj     Proyecto y dependencias .NET
|   |-- ProyectoGrado.Api.http       Solicitudes de prueba para la API
|   |-- appsettings.json             Configuración general
|   |-- appsettings.Development.json Configuración de desarrollo
|   |-- README.md                    Documentación del backend C#
|   |-- Data/
|   |   `-- PostgresConnectionFactory.cs
|   |-- Modules/                     Organización por dominio funcional
|   |   |-- Academico/
|   |   |-- Auth/
|   |   |-- Docentes/
|   |   |-- Estudiantes/
|   |   |-- Horarios/
|   |   `-- Usuarios/
|   `-- Properties/
|
|-- frontend/                       Interfaz web
|   |-- templates/                   Plantillas HTML y archivos de apoyo
|   |   |-- login.html
|   |   |-- bienvenida.html
|   |   |-- panel.html
|   |   |-- form-contacto.html
|   |   |-- register.html
|   |   |-- PlantillaAsistencias_ReporteGeneral.xlsx
|   |   |-- PlantillaBoletínAcademico.xlsx
|   |   `-- PlantillaCalificaciones.xlsx
|   `-- static/                      Recursos estáticos del navegador
|       |-- css/
|       |-- img/
|       `-- js/
|
|-- scripts/                        Scripts auxiliares y de base de datos
|   |-- database/
|   |   |-- initial_schema.dump     Esquema PostgreSQL sin registros
|   |   |-- migrate_test_passwords.py
|   |   `-- trigger_delete_estudiante.sql
|   |-- setup_python_venv.ps1       Creación y preparación del entorno virtual
|   |-- start_postgres.ps1          Inicio de PostgreSQL con contraseña configurable
|   `-- start_servers.sh            Inicio y control de Flask y C#
|
|-- docs/                           Documentación técnica y de instalación
|   |-- architecture.md
|   |-- installation.md
|   |-- email.md
|   |-- periods.md
|   |-- postgresql-migration.md
|   |-- postgres-csharp-migration-tracker.md
|   `-- hybrid-route-inventory.md
|
|-- storage/                        Almacenamiento local no versionado
|   |-- backups/                    Respaldos de bases de datos
|   `-- uploads/                    Archivos subidos por usuarios
|
|-- errores de modulos relevantes/  Registro de incidencias del proyecto
|
|-- .dockerignore                   Exclusiones para la imagen Docker
|-- .env.example                    Plantilla de variables de entorno
|-- .env.docker.example             Plantilla para Docker
|-- .env.postgres.example           Plantilla para PostgreSQL
|-- .env.production.example         Plantilla para producción
|-- .gitignore                      Reglas de exclusión del repositorio
|-- Dockerfile                      Configuración de la imagen de la aplicación
|-- docker-compose.postgres.yml     Servicios con PostgreSQL
|-- docker-compose.production.yml   Servicios de producción
|-- DEPLOYMENT.md                   Instrucciones de despliegue
|-- LICENSE                         Licencia del proyecto
|-- requirements.txt                Dependencias generales/de desarrollo
|-- requirements-deploy.txt         Dependencias de despliegue
`-- requirements-postgres.txt       Dependencias específicas de PostgreSQL
```

## Flujo general

1. El usuario interactúa con las vistas y recursos ubicados en `frontend/`.
2. Flask (`backend/`) sirve el frontend, gestiona la sesión y registra los
   blueprints de cada módulo.
3. Las rutas pueden ejecutarse en Flask o reenviarse de forma opcional a
   `backend-csharp/`, según `CSHARP_PROXY_MODULES`.
4. ASP.NET Core usa `backend-csharp/Data/` y sus módulos para consultar o
   modificar PostgreSQL durante la migración progresiva.
5. `storage/` conserva archivos subidos y respaldos generados durante la
   ejecución local.
6. `docs/`, los archivos de configuración de la raíz y los scripts apoyan la
   instalación, migración, despliegue y mantenimiento del proyecto.

## Preparar el entorno virtual de Python

Desde PowerShell, situado en la raíz del proyecto, ejecuta:

```powershell
.\scripts\setup_python_venv.ps1
```

El script crea `.venv/`, actualiza `pip` e instala las dependencias de
`requirements.txt`. La carpeta `.venv/` está excluida por `.gitignore`.
La instalación de Python se detecta automáticamente mediante el lanzador
`py` o el comando `python` disponible en el equipo.

Para instalar las dependencias específicas del backend Python, ejecuta:

```powershell
.\scripts\setup_python_venv.ps1 -RequirementsPath backend\requirements.txt
```

El script no puede activar el entorno en la consola que lo llamó. Después de
su ejecución, actívalo con:

```powershell
.\.venv\Scripts\Activate.ps1
```

No se debe copiar la carpeta `.venv/` entre computadores, ya que contiene la
ruta de la instalación local de Python. Si el entorno fue copiado desde otro
equipo, el script detecta la ruta inválida, lo recrea automáticamente y vuelve
a instalar las dependencias.

## Elementos excluidos del plano

No se incluyen los siguientes elementos porque están ignorados por `.gitignore`
o son artefactos que no forman parte de la estructura fuente:

- Entornos virtuales: `.venv/`, `backend/.venv/`, `venv/` y `env/`.
- Configuración local y secretos: `.env`, `.env.docker`, `backend/.env`,
  `credentials.json` y `token.json`.
- Tokens almacenados en `backend/tokens/`.
- Cachés de Python: `__pycache__/`, `*.pyc`, `*.pyo` y `*.pyd`.
- Dependencias instaladas de Node.js: `node_modules/`.
- Archivos locales del editor: `.vscode/`.
- Archivos de usuario del sistema: `.DS_Store`.
- Archivos subidos, respaldos, logs y archivos generados dentro de `storage/`.
- Cachés y salidas de compilación de .NET: `bin/` y `obj/`.

El directorio `backend/routes/legacy/` sí aparece en el plano porque forma parte
del código disponible, pero no se registra en `backend/iniciador.py` y no debe
usarse para nuevas funcionalidades.
