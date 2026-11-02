# Estructura general del proyecto

Este documento presenta el plano general del proyecto, tomando como referencia
la estructura fuente actual. Se muestran los componentes necesarios para
entender la aplicación y se omiten los archivos generados, temporales o
sensibles incluidos en `.gitignore`.

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
|   |   |-- modules html/
|   |   `-- plantillas Excel
|   `-- static/                      Recursos estáticos del navegador
|       |-- css/
|       |-- img/
|       `-- js/
|
|-- scripts/                        Scripts auxiliares y de base de datos
|   |-- database/
|   |   |-- initial_schema.dump     Esquema PostgreSQL sin registros
|   |   `-- trigger_delete_estudiante.sql
|   |-- setup_python_venv.ps1       Creación y preparación del entorno virtual
|   `-- start_postgres.ps1          Inicio de PostgreSQL con contraseña configurable
|
|-- docs/                           Documentación técnica y de instalación
|   |-- architecture.md
|   |-- installation.md
|   |-- email.md
|   |-- periods.md
|   |-- postgresql-migration.md
|   |-- postgres-csharp-migration-tracker.md
|   |-- hybrid-route-inventory.md
|   `-- archive/
|
|-- storage/                        Almacenamiento local de la aplicación
|
|-- errores de modulos relevantes/  Registro de incidencias del proyecto
|
|-- .dockerignore                   Exclusiones para la imagen Docker
|-- .env.example                    Plantilla de variables de entorno
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
2. Las solicitudes llegan al backend seleccionado:
   - `backend/` contiene la implementación Python/Flask.
   - `backend-csharp/` contiene la implementación ASP.NET Core en C#.
3. Las rutas organizadas por módulo procesan cada funcionalidad del sistema.
4. Las utilidades de `backend/utils/` y la capa `backend-csharp/Data/`
   centralizan conexiones, constantes y funciones compartidas.
5. `storage/` se utiliza para archivos generados durante la ejecución local.
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
- Configuración local y secretos: `.env`, `backend/.env`, `credentials.json` y
  `token.json`.
- Tokens almacenados en `backend/tokens/`.
- Cachés de Python: `__pycache__/`, `*.pyc`, `*.pyo` y `*.pyd`.
- Dependencias instaladas de Node.js: `node_modules/`.
- Archivos locales del editor: `.vscode/`.
- Archivos de usuario del sistema: `.DS_Store`.
- Archivos subidos, respaldos y archivos generados dentro de `storage/`.
- Scripts heredados ubicados en `scripts/legacy/`.

Las carpetas `bin/` y `obj/` del backend C# tampoco se representan porque son
salidas de compilación; se generan automáticamente a partir del proyecto
fuente y no describen su arquitectura.
