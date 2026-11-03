# ════════════════════════════════════════════════════════════════════════════════
# BLUEPRINT: AUTH — Páginas + Autenticación + Health + Dashboard
# ════════════════════════════════════════════════════════════════════════════════

from flask import Blueprint, jsonify, request, render_template, session, redirect, url_for
from datetime import datetime
from utils.database import get_db, db_config
from utils.helpers import _error_interno, hash_password, verify_password, log_action, validar_contrasena

auth_bp = Blueprint('auth', __name__)

# ── Páginas públicas ─────────────────────────────────────────────────────────

@auth_bp.route('/')
def index():
    """Página principal - Panel (requiere login)"""
    if 'user_id' not in session:
        return redirect(url_for('auth.bienvenida'))
    return render_template('panel.html')

@auth_bp.route('/bienvenida')
def bienvenida():
    """Página de bienvenida"""
    return render_template('bienvenida.html')

@auth_bp.route('/contacto')
def contacto():
    """Página de contacto"""
    return render_template('form-contacto.html')    

@auth_bp.route('/login')
def login_page():
    """Página de login"""
    if 'user_id' in session:
        return redirect(url_for('auth.index'))
    return render_template('login.html')

@auth_bp.route('/register')
def register_page():
    """Página de registro"""
    if 'user_id' in session:
        return redirect(url_for('auth.index'))
    return render_template('register.html')

# ── API Auth ─────────────────────────────────────────────────────────────────

@auth_bp.route('/api/auth/login', methods=['POST'])
def api_login():
    """Login de usuario"""
    try:
        data = request.get_json()

        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email y contraseña requeridos'}), 400

        conn = get_db()
        if not conn:
            return jsonify({'error': 'Error de conexión'}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.contrasena_hash, r.nombre_rol
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.correo = %s AND u.is_activo = true
        """, (data['email'],))

        usuario = cursor.fetchone()
        cursor.close()
        conn.close()

        if not usuario:
            return jsonify({'error': 'El email no está registrado o no existe'}), 401

        if not verify_password(data['password'], usuario['contrasena_hash']):
            return jsonify({'error': 'Contraseña incorrecta'}), 401

        # Crear sesión
        session['user_id'] = usuario['id_usuario']
        session['user_name'] = f"{usuario['nombre']} {usuario['apellido']}"
        session['user_email'] = usuario['correo']
        session['user_role'] = usuario['nombre_rol']

        return jsonify({
            'status': 'ok',
            'user_id': usuario['id_usuario'],
            'user_name': session['user_name'],
            'user_role': usuario['nombre_rol']
        }), 200

    except Exception as e:
        return _error_interno(e)

@auth_bp.route('/api/auth/register', methods=['POST'])
def api_register():
    """Registro de nuevo usuario"""
    try:
        data = request.get_json()

        campos = ['nombre', 'apellido', 'email', 'password', 'documento']
        for campo in campos:
            if not data.get(campo):
                return jsonify({'error': f'Campo requerido: {campo}'}), 400

        error_contrasena = validar_contrasena(data['password'])
        if error_contrasena:
            return jsonify({'error': error_contrasena}), 400

        conn = get_db()
        if not conn:
            return jsonify({'error': 'Error de conexión'}), 500

        cursor = conn.cursor(dictionary=True)

        # Verificar email existente
        cursor.execute("SELECT id_usuario FROM usuarios WHERE correo = %s", (data['email'],))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Email ya registrado'}), 400

        # Verificar documento existente
        cursor.execute("SELECT id_usuario FROM usuarios WHERE documento = %s", (data['documento'],))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Documento ya registrado'}), 400

        # Insertar usuario (rol por defecto: Profesor = 4)
        cursor.execute("""
            INSERT INTO usuarios (documento, nombre, apellido, correo, contrasena_hash, id_rol, is_activo)
            VALUES (%s, %s, %s, %s, %s, 4, TRUE)
        """, (
            data['documento'],
            data['nombre'],
            data['apellido'],
            data['email'],
            hash_password(data['password'])
        ))

        conn.commit()
        nuevo_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({
            'status': 'ok',
            'message': 'Usuario registrado',
            'user_id': nuevo_id
        }), 201

    except Exception as e:
        return _error_interno(e)

@auth_bp.route('/api/auth/check', methods=['GET'])
def api_check():
    """Verificar sesión activa"""
    if 'user_id' not in session:
        return jsonify({'authenticated': False}), 401

    return jsonify({
        'authenticated': True,
        'user_id': session.get('user_id'),
        'user_name': session.get('user_name'),
        'user_email': session.get('user_email'),
        'user_role': session.get('user_role')
    }), 200

@auth_bp.route('/api/auth/logout', methods=['POST'])
def api_logout():
    """Cerrar sesión"""
    session.clear()
    return jsonify({'status': 'ok'}), 200

@auth_bp.route('/api/auth/profile', methods=['GET'])
def api_profile():
    """Perfil del usuario"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401

    try:
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Error de conexión'}), 500

        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo,
                   r.nombre_rol, u.is_activo, u.created_at
            FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.id_usuario = %s
        """, (session['user_id'],))

        usuario = cursor.fetchone()
        cursor.close()
        conn.close()

        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404

        return jsonify({'status': 'ok', 'usuario': usuario}), 200

    except Exception as e:
        return _error_interno(e)
    
"""locooooooooooooooooooooooooooooooooo cambiar contraseñas ta acaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa pelotudoooooooo, 
corregir error de cambio de contraseña"""

@auth_bp.route('/api/auth/change-password', methods=['POST'])
def api_change_password():
    """Cambiar contraseña del usuario actual"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401

    try:
        data = request.get_json()
        if not data.get('current_password') or not data.get('new_password'):
            return jsonify({'error': 'Se requieren ambas contraseñas'}), 400

        error_contrasena = validar_contrasena(data['new_password'])
        if error_contrasena:
            return jsonify({'error': error_contrasena}), 400

        conn = get_db()
        if not conn:
            return jsonify({'error': 'Error de conexión'}), 500

        cursor = conn.cursor(dictionary=True)

        # Verificar contraseña actual
        cursor.execute("SELECT contrasena_hash FROM usuarios WHERE id_usuario = %s", (session['user_id'],))
        usuario = cursor.fetchone()
        print(usuario)

        if not usuario or not verify_password(data['current_password'], usuario['contrasena_hash']):
            cursor.close()
            conn.close()
            return jsonify({'error': 'Contraseña actual incorrecta'}), 401

        # Actualizar contraseña
        cursor.execute(
            "UPDATE usuarios SET contrasena_hash = %s WHERE id_usuario = %s",
            (hash_password(data['new_password']), session['user_id'])
        )
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'status': 'ok', 'message': 'Contraseña actualizada'}), 200

    except Exception as e:
        return _error_interno(e)

# ── Health y Dashboard ───────────────────────────────────────────────────────

@auth_bp.route('/api/health', methods=['GET'])
def api_health():
    """Estado de la conexión"""
    conn = get_db()
    if conn:
        conn.close()
        return jsonify({
            'status': 'ok',
            'database': db_config['database'],
            'timestamp': datetime.now().isoformat()
        }), 200
    return jsonify({'status': 'error', 'message': 'Sin conexión a BD'}), 500

@auth_bp.route('/api/dashboard/stats', methods=['GET'])
def api_dashboard_stats():
    """Estadísticas generales para el dashboard"""
    try:
        conn = get_db()
        if not conn:
            return jsonify({'error': 'Error de conexión'}), 500

        cursor = conn.cursor(dictionary=True)
        stats = {}

        cursor.execute("SELECT COUNT(*) as total FROM estudiantes WHERE estado = 'Activo'")
        stats['estudiantes'] = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as total FROM usuarios WHERE id_rol = 4 AND is_activo = TRUE")
        stats['docentes'] = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as total FROM grupos")
        stats['grupos'] = cursor.fetchone()['total']

        cursor.execute("SELECT COUNT(*) as total FROM materias WHERE codigo_materia != ''")
        stats['materias'] = cursor.fetchone()['total']

        cursor.execute("SELECT nombre_periodo, estado FROM periodos WHERE estado = 'Abierto' LIMIT 1")
        periodo = cursor.fetchone()
        stats['periodo_activo'] = periodo['nombre_periodo'] if periodo else 'Sin período activo'

        cursor.execute("""
            SELECT ROUND(
                (SUM(CASE WHEN estado = 'Presente' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0), 1
            ) as promedio
            FROM asistencia
            WHERE fecha >= CURRENT_DATE - INTERVAL '30 days'
        """)
        prom = cursor.fetchone()
        stats['asistencia_promedio'] = prom['promedio'] if prom and prom['promedio'] else 0

        cursor.close()
        conn.close()

        return jsonify({'status': 'ok', 'stats': stats}), 200
    except Exception as e:
        return _error_interno(e)
