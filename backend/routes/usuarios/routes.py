# ════════════════════════════════════════════════════════════════════════════════
# BLUEPRINT: USUARIOS — CRUD de usuarios + Roles
# ════════════════════════════════════════════════════════════════════════════════

from flask import Blueprint, jsonify, request, session
import psycopg
from utils.database import get_db
from utils.helpers import (
    _error_interno,
    hash_password,
    log_action,
    role_required,
    validar_documento_numerico,
    validar_nombre_persona
)

usuarios_bp = Blueprint('usuarios', __name__)

# ── CRUD Usuarios ────────────────────────────────────────────────────────────

@usuarios_bp.route('/api/usuarios', methods=['GET'])
def api_usuarios():
    """Listar todos los usuarios"""
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
            ORDER BY u.id_usuario DESC
        """)
        usuarios = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify({'status': 'ok', 'usuarios': usuarios}), 200
    except Exception as e:
        return _error_interno(e)

@usuarios_bp.route('/api/usuarios/<int:id>', methods=['GET'])
def api_usuario_detalle(id):
    """Obtener detalle de un usuario"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.*, r.nombre_rol FROM usuarios u
            JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.id_usuario = %s
        """, (id,))
        usuario = cursor.fetchone()
        cursor.close()
        conn.close()

        if not usuario:
            return jsonify({'error': 'Usuario no encontrado'}), 404
        return jsonify({'status': 'ok', 'usuario': usuario}), 200
    except Exception as e:
        return _error_interno(e)

@usuarios_bp.route('/api/usuarios', methods=['POST'])
def api_usuario_crear():
    """Crear nuevo usuario"""
    try:
        data = request.get_json(silent=True) or {}
        error_documento = validar_documento_numerico(data.get('documento'))
        if error_documento:
            return jsonify({'error': error_documento}), 400
        for campo, etiqueta in (('nombre', 'El nombre'), ('apellido', 'El apellido')):
            error_nombre = validar_nombre_persona(data.get(campo), etiqueta, obligatorio=True)
            if error_nombre:
                return jsonify({'error': error_nombre}), 400
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO usuarios (documento, nombre, apellido, correo, contrasena_hash, id_rol, is_activo)
            VALUES (%s, %s, %s, %s, %s, %s, TRUE)
        """, (data['documento'], data['nombre'], data['apellido'], data['correo'],
              hash_password(data.get('password', '123456')), data['id_rol']))

        conn.commit()
        nuevo_id = cursor.lastrowid
        cursor.close()
        conn.close()

        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'CREATE',
                f"Usuario creado (rol_id={data['id_rol']})",
                tabla_afectada='usuarios',
                registro_id=int(nuevo_id)
            )

        return jsonify({'status': 'ok', 'id': nuevo_id}), 201
    except Exception as e:
        return _error_interno(e)

@usuarios_bp.route('/api/usuarios/<int:id_usuario>', methods=['PUT'])
def api_usuario_actualizar(id_usuario):
    """Actualizar usuario"""
    try:        
        data = request.get_json(silent=True) or {}
        error_documento = validar_documento_numerico(data.get('documento'))
        if error_documento:
            return jsonify({'error': error_documento}), 400
        for campo, etiqueta in (('nombre', 'El nombre'), ('apellido', 'El apellido')):
            error_nombre = validar_nombre_persona(data.get(campo), etiqueta, obligatorio=True)
            if error_nombre:
                return jsonify({'error': error_nombre}), 400
        estado = data.get('is_activo')
        if isinstance(estado, bool):
            estado_activo = estado
        elif estado in (1, '1', 'true', 't', 'Activo'):
            estado_activo = True
        elif estado in (0, '0', 'false', 'f', 'Inactivo'):
            estado_activo = False
        else:
            return jsonify({'error': 'El estado del usuario debe ser Activo o Inactivo'}), 400
        conn = get_db()
        cursor = conn.cursor()

        campos = [
            "nombre=%s",
            "apellido=%s",
            "correo=%s",
            "documento=%s",
            "id_rol=%s",
            "is_activo=%s"
        ]

        valores = [
            data['nombre'],
            data['apellido'],
            data['correo'],
            data['documento'],
            data['id_rol'],
            estado_activo
        ]



        if data.get('password'):
            if len(data['password']) < 6:
                return jsonify({'error': 'Contraseña minimo 6 caracteres.'}), 400
            campos.append('contrasena_hash=%s')
            valores.append(hash_password(data['password']))

        valores.append(id_usuario)

        cursor.execute(f"""
            UPDATE usuarios SET {', '.join(campos)}
            WHERE id_usuario=%s
        """, tuple(valores))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)

@usuarios_bp.route('/api/usuarios/<int:id_usuario>', methods=['DELETE'])
@role_required('admin_server')
def api_usuario_eliminar(current_user, id_usuario):
    """Eliminar usuario con verificación de dependencias"""
    conn = None
    cursor = None
    try:
        conn = get_db()
        cursor = conn.cursor()

        # Obtener el rol del usuario
        cursor.execute(
            "SELECT r.nombre_rol FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol WHERE u.id_usuario = %s",
            (id_usuario,))
        rol_result = cursor.fetchone()

        if not rol_result:
            return jsonify({'error': 'Usuario no encontrado.'}), 404

        nombre_rol = rol_result[0]

        # --- Verificaciones de dependencias basadas en el rol ---

        if nombre_rol == 'Profesor':
            cursor.execute("SELECT COUNT(*) FROM asignaciones_docente WHERE id_usuario = %s", (id_usuario,))
            if cursor.fetchone()[0] > 0:
                return jsonify({'error': 'El usuario es un docente con asignaciones y no puede ser eliminado.'}), 409

            cursor.execute("SELECT COUNT(*) FROM actividades WHERE id_usuario = %s", (id_usuario,))
            if cursor.fetchone()[0] > 0:
                return jsonify({'error': 'El usuario tiene actividades creadas y no puede ser eliminado.'}), 409

            cursor.execute("""
                SELECT COUNT(*) FROM notas n
                JOIN actividades a ON n.id_actividad = a.id_actividad
                WHERE a.id_usuario = %s
            """, (id_usuario,))
            if cursor.fetchone()[0] > 0:
                return jsonify({'error': 'El usuario tiene notas registradas y no puede ser eliminado.'}), 409

            cursor.execute("SELECT COUNT(*) FROM observador WHERE id_usuario = %s", (id_usuario,))
            if cursor.fetchone()[0] > 0:
                return jsonify({'error': 'El usuario tiene registros en el observador y no puede ser eliminado.'}), 409

        if nombre_rol == 'Estudiante':
            cursor.execute("SELECT COUNT(*) FROM notas WHERE id_estudiante = %s", (id_usuario,))
            if cursor.fetchone()[0] > 0:
                return jsonify({'error': 'El usuario es un estudiante con notas registradas y no puede ser eliminado.'}), 409

            cursor.execute("SELECT COUNT(*) FROM observador WHERE id_estudiante = %s", (id_usuario,))
            if cursor.fetchone()[0] > 0:
                return jsonify({'error': 'El usuario es un estudiante con registros en el observador y no puede ser eliminado.'}), 409

        if nombre_rol == 'Profesor':
            cursor.execute("""
                SELECT COUNT(*) FROM horarios h
                JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
                WHERE a.id_usuario = %s
            """, (id_usuario,))
            if cursor.fetchone()[0] > 0:
                return jsonify({'error': 'El usuario es un docente con horarios asignados y no puede ser eliminado.'}), 409

        cursor.execute("SELECT COUNT(*) FROM comunicados_rectoria WHERE id_usuario = %s", (id_usuario,))
        if cursor.fetchone()[0] > 0:
            return jsonify({'error': 'El usuario ha creado comunicados y no puede ser eliminado.'}), 409

        cursor.execute("SELECT COUNT(*) FROM log_registro WHERE id_usuario = %s", (id_usuario,))
        if cursor.fetchone()[0] > 0:
            return jsonify({'error': 'El usuario tiene registros de actividad y no puede ser eliminado.'}), 409

        # Si pasa todas las verificaciones, proceder a eliminar
        cursor.execute("DELETE FROM usuarios WHERE id_usuario = %s", (id_usuario,))
        conn.commit()

        log_action(current_user['id_usuario'], 'DELETE',
                   f'Usuario con ID {id_usuario} eliminado permanentemente.')

        return jsonify({'message': 'Usuario eliminado permanentemente.'}), 200

    except psycopg.Error:
        if conn:
            conn.rollback()
        return _error_interno(Exception('Error de base de datos al eliminar usuario'))
    except Exception as e:
        if conn:
            conn.rollback()
        return _error_interno(e)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# ── Roles ────────────────────────────────────────────────────────────────────

@usuarios_bp.route('/api/roles', methods=['GET'])
def api_roles():
    """Listar roles"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_rol, nombre_rol, descripcion FROM roles ORDER BY id_rol")
        roles = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'roles': roles}), 200
    except Exception as e:
        return _error_interno(e)
