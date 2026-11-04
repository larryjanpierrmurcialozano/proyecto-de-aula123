# ════════════════════════════════════════════════════════════════════════════════
# BLUEPRINT: COMUNICADOS — CRUD de comunicados de rectoría
# ════════════════════════════════════════════════════════════════════════════════

from flask import Blueprint, jsonify, request, session
from utils.database import get_db
from utils.helpers import _error_interno
from utils.constants import ROLES_ADMIN_COM

comunicados_bp = Blueprint('comunicados', __name__)


@comunicados_bp.route('/api/comunicados', methods=['GET'])
def api_comunicados():
    """Listar comunicados - visible para personal interno"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        user_role = session.get('user_role', '').lower()

        if user_role in [r.lower() for r in ROLES_ADMIN_COM]:
            cursor.execute("""
                SELECT c.*, u.nombre as autor_nombre, u.apellido as autor_apellido
                FROM comunicados_rectoria c
                JOIN usuarios u ON c.id_usuario = u.id_usuario
                ORDER BY c.fecha_publicacion DESC
            """)
        elif user_role in ['profesor', 'docente']:
            cursor.execute("""
                SELECT c.*, u.nombre as autor_nombre, u.apellido as autor_apellido
                FROM comunicados_rectoria c
                JOIN usuarios u ON c.id_usuario = u.id_usuario
                WHERE c.activo = TRUE AND c.audiencia IN ('Todos', 'Docentes')
                ORDER BY c.fecha_publicacion DESC
            """)
        else:
            cursor.execute("""
                SELECT c.*, u.nombre as autor_nombre, u.apellido as autor_apellido
                FROM comunicados_rectoria c
                JOIN usuarios u ON c.id_usuario = u.id_usuario
                WHERE c.activo = TRUE
                ORDER BY c.fecha_publicacion DESC
            """)

        comunicados = cursor.fetchall()
        for com in comunicados:
            for key in ['fecha_publicacion', 'created_at', 'updated_at']:
                if com.get(key) and hasattr(com[key], 'isoformat'):
                    com[key] = com[key].isoformat()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'comunicados': comunicados}), 200
    except Exception as e:
        return _error_interno(e)


@comunicados_bp.route('/api/comunicados', methods=['POST'])
def api_comunicado_crear():
    """Crear comunicado - solo admins"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    user_role = session.get('user_role', '').lower()
    if user_role not in [r.lower() for r in ROLES_ADMIN_COM]:
        return jsonify({'error': 'No tienes permisos para crear comunicados'}), 403
    try:
        data = request.get_json()
        if not data.get('titulo') or not data.get('contenido'):
            return jsonify({'error': 'Título y contenido son obligatorios'}), 400
        audiencia = data.get('audiencia', 'Todos')
        if audiencia == 'General':
            audiencia = 'Todos'
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO comunicados_rectoria
            (id_usuario, titulo, contenido, tipo_comunicado, audiencia, prioridad, fecha_publicacion, activo)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), TRUE)
        """, (
            session['user_id'],
            data['titulo'],
            data['contenido'],
            data.get('tipo_comunicado', 'Información'),
            audiencia,
            data.get('prioridad', 'Media')
        ))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'id_comunicado': new_id, 'mensaje': 'Comunicado creado exitosamente'}), 201
    except Exception as e:
        return _error_interno(e)


@comunicados_bp.route('/api/comunicados/<int:id>', methods=['PUT'])
def api_comunicado_editar(id):
    """Editar comunicado - solo admins"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    user_role = session.get('user_role', '').lower()
    if user_role not in [r.lower() for r in ROLES_ADMIN_COM]:
        return jsonify({'error': 'No tienes permisos para editar comunicados'}), 403
    try:
        data = request.get_json()
        if not data.get('titulo') or not data.get('contenido'):
            return jsonify({'error': 'Título y contenido son obligatorios'}), 400
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_comunicado FROM comunicados_rectoria WHERE id_comunicado = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Comunicado no encontrado'}), 404
        audiencia = data.get('audiencia', 'Todos')
        if audiencia == 'General':
            audiencia = 'Todos'
        cursor.execute("""
            UPDATE comunicados_rectoria
            SET titulo = %s, contenido = %s, tipo_comunicado = %s, audiencia = %s, prioridad = %s
            WHERE id_comunicado = %s
        """, (
            data['titulo'],
            data['contenido'],
            data.get('tipo_comunicado', 'Información'),
            audiencia,
            data.get('prioridad', 'Media'),
            id
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'mensaje': 'Comunicado actualizado'}), 200
    except Exception as e:
        return _error_interno(e)


@comunicados_bp.route('/api/comunicados/<int:id>', methods=['DELETE'])
def api_comunicado_eliminar(id):
    """Eliminar comunicado - solo admins"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401
    user_role = session.get('user_role', '').lower()
    if user_role not in [r.lower() for r in ROLES_ADMIN_COM]:
        return jsonify({'error': 'No tienes permisos para eliminar comunicados'}), 403
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM comunicados_rectoria WHERE id_comunicado = %s", (id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        if affected == 0:
            return jsonify({'error': 'Comunicado no encontrado'}), 404
        return jsonify({'status': 'ok', 'mensaje': 'Comunicado eliminado'}), 200
    except Exception as e:
        return _error_interno(e)
