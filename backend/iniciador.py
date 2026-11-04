# ══════════════════════════════════════════════════════════════════════════════
# DOCSTRY - BACKEND FLASK
# ══════════════════════════════════════════════════════════════════════════════
# Sistema de Gestión Académica
# Versión: 4.0 BETA (Blueprints)
# ══════════════════════════════════════════════════════════════════════════════

from flask import Flask, Response, jsonify, request, session, send_from_directory
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import os, logging, sys
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen
from dotenv import load_dotenv
import openpyxl
from openpyxl import *
# Utilidades compartidas
from utils.database import db_config, cleanup_db_connections
from utils.constants import RUTAS_PUBLICAS

CSHARP_PROXY_ROUTES = {
    'estudiantes': (('/api/estudiantes', {'GET', 'POST', 'PUT', 'DELETE'}),),
    'academico': (
        ('/api/grados', {'GET', 'POST', 'PUT', 'DELETE'}),
        ('/api/grupos', {'GET', 'POST', 'PUT', 'DELETE'}),
        ('/api/materias', {'GET', 'POST', 'PUT', 'DELETE'}),
        ('/api/asignaciones-docente', {'POST', 'DELETE'}),
    ),
    'docentes': (
        ('/api/docentes', {'GET'}),
        ('/api/docente/mis-materias', {'GET'}),
        ('/api/docente/mi-horario', {'GET'}),
    ),
    'horarios': (
        ('/api/horarios', {'GET', 'POST', 'PUT', 'DELETE'}),
        ('/api/niveles', {'GET'}),
    ),
}

# Blueprints
from routes.auth.routes import auth_bp
from routes.usuarios.routes import usuarios_bp
from routes.estudiantes.routes import estudiantes_bp
from routes.docentes.routes import docentes_bp
from routes.academico.routes import academico_bp
from routes.registros.routes import registros_bp
from routes.comunicados.routes import comunicados_bp
from routes.reportes.routes import reportes_bp
from routes.horarios.routes import horarios_bp
from routes.calificaciones.routes import calificaciones_bp
from routes.asistencia.routes import asistencia_bp
from routes.periodos.routes import periodos_bp
from routes.observador.routes import observador_bp
# [DESHABILITADO PARA TECNÓLOGO] from routes.servicio_drive import drive_bp


# ══════════════════════════════════════════════════════════════════════════════
# CONFIGURACIÓN
# ══════════════════════════════════════════════════════════════════════════════

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
TEMPLATE_DIR = os.path.join(PROJECT_ROOT, 'frontend', 'templates')
STATIC_DIR = os.path.join(PROJECT_ROOT, 'frontend', 'static')
UPLOAD_DIR = os.path.join(PROJECT_ROOT, 'storage', 'uploads')

app = Flask(
    __name__,
    template_folder=TEMPLATE_DIR,
    static_folder=STATIC_DIR,
    static_url_path='/static'
)

CORS(app, origins=[origin.strip() for origin in os.getenv(
    'CORS_ORIGINS', 'http://127.0.0.1:5000,http://localhost:5000'
).split(',') if origin.strip()], supports_credentials=True)

APP_ENV = os.getenv('APP_ENV', 'development').lower()
secret_key = os.getenv('SECRET_KEY')
if APP_ENV == 'production' and not secret_key:
    raise RuntimeError('SECRET_KEY es obligatorio cuando APP_ENV=production')
app.secret_key = secret_key or 'dev_key_cambiar_en_produccion'
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax',
    SESSION_COOKIE_SECURE=(APP_ENV == 'production'),
)
app.config['UPLOAD_FOLDER'] = UPLOAD_DIR

# Limpieza automatica: cierra conexiones DB que las rutas no cerraron
app.teardown_appcontext(cleanup_db_connections)

# ══════════════════════════════════════════════════════════════════════════════
# REGISTRO DE BLUEPRINTS
# ══════════════════════════════════════════════════════════════════════════════

app.register_blueprint(auth_bp)          # Páginas + Auth + Health + Dashboard
app.register_blueprint(usuarios_bp)      # CRUD Usuarios + Roles
app.register_blueprint(estudiantes_bp)   # CRUD Estudiantes
app.register_blueprint(docentes_bp)      # Docentes admin + Panel docente
app.register_blueprint(academico_bp)     # Grados, Grupos, Materias, Asignaciones, Períodos
app.register_blueprint(horarios_bp)      # CRUD Horarios + Niveles + Asignaciones-grupo
app.register_blueprint(calificaciones_bp)# Módulo Offline First de Calificaciones por Excel
app.register_blueprint(registros_bp)     # Asistencia legacy
app.register_blueprint(comunicados_bp)   # CRUD Comunicados
app.register_blueprint(reportes_bp)      # Reportes + Logs + Envío de correo
app.register_blueprint(asistencia_bp)    # Módulo de Asistencia
app.register_blueprint(periodos_bp)      # Módulo de Períodos
app.register_blueprint(observador_bp)    # Módulo Observador
# [DESHABILITADO PARA TECNÓLOGO] app.register_blueprint(drive_bp)        # Módulo de integración con Google Drive incompleto y por
# implementar en futuras versiones

# ══════════════════════════════════════════════════════════════════════════════
# MIDDLEWARE — AUTENTICACIÓN GLOBAL
# ══════════════════════
@app.before_request
def verificar_autenticacion():
    """Verifica que toda petición a /api/ esté autenticada (excepto rutas públicas)."""
    if request.path in RUTAS_PUBLICAS:
        return None
    if request.path.startswith('/static'):
        return None
    if request.path.startswith('/api/') and 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    return None


@app.before_request
def proxy_modulos_a_csharp():
    """Reenvía módulos funcionales permitidos a C# tras validar la sesión Flask."""
    modules = {
        module.strip().lower()
        for module in os.getenv('CSHARP_PROXY_MODULES', '').split(',')
        if module.strip()
    }
    path = request.path
    if path == '/api/horarios/exportar-pdf':
        return None
    route_is_proxied = any(
        request.method in methods and (path == prefix or path.startswith(prefix + '/'))
        for module in modules
        for prefix, methods in CSHARP_PROXY_ROUTES.get(module, ())
    )
    if not route_is_proxied:
        return None

    proxy_secret = os.getenv('CSHARP_PROXY_SECRET', '')
    if not proxy_secret:
        app.logger.error('Proxy C# habilitado, pero falta CSHARP_PROXY_SECRET')
        return jsonify({'error': 'Servicio C# no configurado'}), 503

    api_base = os.getenv('CSHARP_API_URL', 'http://127.0.0.1:5124').rstrip('/')
    query = request.query_string.decode('latin-1')
    target = f'{api_base}{path}' + (f'?{query}' if query else '')
    headers = {
        'Accept': request.headers.get('Accept', 'application/json'),
        'X-Docstry-Proxy-Secret': proxy_secret,
        'X-Authenticated-User-Id': str(session.get('user_id', '')),
        'X-Authenticated-User-Role': str(session.get('user_role', '')),
        'X-Authenticated-User-Name': str(session.get('user_name', '')),
        'X-Authenticated-User-Email': str(session.get('user_email', '')),
        'X-Forwarded-For': request.remote_addr or '',
        'User-Agent': request.headers.get('User-Agent', '')
    }
    if request.content_type:
        headers['Content-Type'] = request.content_type

    upstream_request = UrlRequest(
        target,
        data=request.get_data() if request.method not in {'GET', 'HEAD'} else None,
        headers=headers,
        method=request.method
    )

    try:
        with urlopen(upstream_request, timeout=15) as upstream:
            payload = upstream.read()
            status = upstream.status
            content_type = upstream.headers.get('Content-Type')
    except HTTPError as upstream_error:
        payload = upstream_error.read()
        status = upstream_error.code
        content_type = upstream_error.headers.get('Content-Type')
    except (URLError, TimeoutError, OSError) as error:
        app.logger.error('No se pudo contactar el backend C#: %s', error)
        return jsonify({'error': 'Servicio C# no disponible'}), 502

    response = Response(payload, status=status)
    if content_type:
        response.headers['Content-Type'] = content_type
    return response

@app.errorhandler(404)
def handle_404(e):
    """Archivos o rutas no encontrados — no contaminar logs."""
    return jsonify({'error': 'No encontrado'}), 404

@app.errorhandler(Exception)
def handle_exception(e):
    """Captura excepciones no manejadas — devuelve error genérico al cliente."""
    # No loguear errores HTTP normales (404, 405, etc.)
    if isinstance(e, HTTPException):
        return jsonify({'error': e.description}), e.code
    print(f"[ERROR] Excepcion no manejada: {e}")
    return jsonify({'error': 'Error interno del servidor'}), 500

@app.route('/favicon.ico')
def favicon():
    return send_from_directory(
        os.path.join(STATIC_DIR, 'img'),
        'logo.png', mimetype='image/png'
    )

# ── RUTA PARA SERVIR FRAGMENTOS HTML DE MÓDULOS DEL FRONTEND ──
@app.route('/templates/modules html/<filename>')
def serve_module_html(filename):
    """Devuelve los fragmentos HTML puros sin renderizar todo el layout."""
    import flask
    return flask.render_template(f'modules html/{filename}')

# ══════════════════════════════════════════════════════════════════════════════
# INICIO DEL SERVIDOR
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    # Forzar logs de peticiones visibles en consola
    logging.basicConfig(stream=sys.stderr, level=logging.DEBUG)
    werkzeug_log = logging.getLogger('werkzeug')
    werkzeug_log.setLevel(logging.INFO)
    werkzeug_log.addHandler(logging.StreamHandler(sys.stderr))

    print("\n" + "="*60)
    print("  DOCSTRY - Sistema de Gestión Académica v3.0")
    print("  Arquitectura: Flask Blueprints")
    print("="*60)
    print(f"  URL: http://127.0.0.1:5000/bienvenida")
    print(f"  Base de datos: {db_config['database']}")
    print("="*60 + "\n")
    sys.stdout.flush()

    app.run(debug=True, host='127.0.0.1', port=5000)
