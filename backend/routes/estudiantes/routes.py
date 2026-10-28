# ════════════════════════════════════════════════════════════════════════════════
# BLUEPRINT: ESTUDIANTES — CRUD de estudiantes
# ════════════════════════════════════════════════════════════════════════════════

from flask import Blueprint, jsonify, request, session
from utils.database import get_db
from utils.helpers import (
    _error_interno,
    validar_documento_numerico,
    validar_fecha_no_futura,
    validar_nombre_persona,
    validar_telefono_numerico
)

estudiantes_bp = Blueprint('estudiantes', __name__)


@estudiantes_bp.route('/api/estudiantes', methods=['GET'])
def api_estudiantes():
    """Listar estudiantes"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT e.*, g.codigo_grupo, gr.nombre_grado
            FROM estudiantes e
            JOIN grupos g ON e.id_grupo = g.id_grupo
            JOIN grados gr ON g.id_grado = gr.id_grado
            ORDER BY gr.id_grado, g.codigo_grupo, e.apellido
        """)
        estudiantes = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'estudiantes': estudiantes}), 200
    except Exception as e:
        return _error_interno(e)


@estudiantes_bp.route('/api/estudiantes/<int:id>', methods=['GET'])
def api_estudiante_detalle(id):
    """Detalle de estudiante"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT e.*, g.codigo_grupo, gr.nombre_grado
            FROM estudiantes e
            JOIN grupos g ON e.id_grupo = g.id_grupo
            JOIN grados gr ON g.id_grado = gr.id_grado
            WHERE e.id_estudiante = %s
        """, (id,))
        estudiante = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'estudiante': estudiante}), 200
    except Exception as e:
        return _error_interno(e)


@estudiantes_bp.route('/api/estudiantes', methods=['POST'])
def api_estudiante_crear():
    """Crear estudiante"""
    try:
        data = request.get_json(silent=True) or {}
        error_documento = validar_documento_numerico(data.get('documento'))
        if error_documento:
            return jsonify({'error': error_documento}), 400
        for campo, etiqueta, obligatorio in (
            ('nombre', 'El nombre', True),
            ('apellido', 'El apellido', True),
            ('acudiente_nombre', 'El nombre del acudiente', False)
        ):
            error_nombre = validar_nombre_persona(data.get(campo), etiqueta, obligatorio)
            if error_nombre:
                return jsonify({'error': error_nombre}), 400
        error_telefono = validar_telefono_numerico(data.get('acudiente_telefono'), 'El teléfono del acudiente')
        if error_telefono:
            return jsonify({'error': error_telefono}), 400
        error_fecha = validar_fecha_no_futura(data.get('fecha_nacimiento'), 'La fecha de nacimiento')
        if error_fecha:
            return jsonify({'error': error_fecha}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO estudiantes (documento, nombre, apellido, fecha_nacimiento, genero,
                id_grupo, acudiente_nombre, acudiente_telefono, correo, direccion, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'Activo')
        """, (
            data['documento'],
            data['nombre'],
            data['apellido'],
            data.get('fecha_nacimiento'),
            data.get('genero', 'M'),
            data['id_grupo'],
            data.get('acudiente_nombre'),
            data.get('acudiente_telefono'),
            data.get('correo'),
            data.get('direccion')
        ))
        conn.commit()
        nuevo_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'id': nuevo_id}), 201
    except Exception as e:
        return _error_interno(e)


@estudiantes_bp.route('/api/estudiantes/<int:id>', methods=['PUT'])
def api_estudiante_actualizar(id):
    """Actualizar estudiante"""
    try:
        data = request.get_json(silent=True) or {}
        error_documento = validar_documento_numerico(data.get('documento'))
        if error_documento:
            return jsonify({'error': error_documento}), 400
        for campo, etiqueta, obligatorio in (
            ('nombre', 'El nombre', True),
            ('apellido', 'El apellido', True),
            ('acudiente_nombre', 'El nombre del acudiente', False)
        ):
            error_nombre = validar_nombre_persona(data.get(campo), etiqueta, obligatorio)
            if error_nombre:
                return jsonify({'error': error_nombre}), 400
        error_telefono = validar_telefono_numerico(data.get('acudiente_telefono'), 'El teléfono del acudiente')
        if error_telefono:
            return jsonify({'error': error_telefono}), 400
        error_fecha = validar_fecha_no_futura(data.get('fecha_nacimiento'), 'La fecha de nacimiento')
        if error_fecha:
            return jsonify({'error': error_fecha}), 400

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE estudiantes SET documento=%s, nombre=%s, apellido=%s, fecha_nacimiento=%s, genero=%s,
                id_grupo=%s, acudiente_nombre=%s, acudiente_telefono=%s, correo=%s, direccion=%s, estado=%s
            WHERE id_estudiante=%s
        """, (
            data['documento'],
            data['nombre'],
            data['apellido'],
            data.get('fecha_nacimiento') or None,
            data.get('genero', 'M'),
            data['id_grupo'],
            data.get('acudiente_nombre'),
            data.get('acudiente_telefono'),
            data.get('correo'),
            data.get('direccion'),
            data.get('estado', 'Activo'),
            id
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)


@estudiantes_bp.route('/api/estudiantes/<int:id>', methods=['DELETE'])
def api_estudiante_eliminar(id):
    """Eliminar estudiante fisicamente y limpiar dependencias relacionadas"""
    try:
        conn = get_db()
        cursor = conn.cursor()

        # Contexto transaccional que consume el trigger PostgreSQL de auditoria.
        cursor.execute("SELECT set_config('app.user_id', %s, true)", (str(session.get('user_id') or ''),))
        cursor.execute("SELECT set_config('app.ip', %s, true)", (request.remote_addr or '',))
        cursor.execute("SELECT set_config('app.agent', %s, true)", (request.headers.get('User-Agent') or '',))

        # Guardar los conteos antes de limpiar las tablas con claves foraneas.
        cursor.execute("""
            SELECT json_build_object(
                'detalle_asistencia', (SELECT COUNT(*) FROM detalle_asistencia WHERE id_estudiante = %s),
                'asistencia', (SELECT COUNT(*) FROM asistencia WHERE id_estudiante = %s),
                'asistencias_por_periodo', (SELECT COUNT(*) FROM asistencias_por_periodo WHERE id_estudiante = %s),
                'justificantes_ausencia', (SELECT COUNT(*) FROM justificantes_ausencia WHERE id_estudiante = %s),
                'reportes_inasistencias', (SELECT COUNT(*) FROM reportes_inasistencias WHERE id_estudiante = %s),
                'observador', (SELECT COUNT(*) FROM observador WHERE id_estudiante = %s),
                'notas', (SELECT COUNT(*) FROM notas WHERE id_estudiante = %s)
            )::text
        """, (id, id, id, id, id, id, id))
        relation_counts = cursor.fetchone()[0]
        cursor.execute(
            "SELECT set_config('app.student_delete_counts', %s, true)",
            (relation_counts,)
        )

        dependencias = [
            "DELETE FROM detalle_asistencia WHERE id_estudiante = %s",
            "DELETE FROM asistencia WHERE id_estudiante = %s",
            "DELETE FROM asistencias_por_periodo WHERE id_estudiante = %s",
            "DELETE FROM justificantes_ausencia WHERE id_estudiante = %s",
            "DELETE FROM reportes_inasistencias WHERE id_estudiante = %s",
            "DELETE FROM observador WHERE id_estudiante = %s",
            "DELETE FROM notas WHERE id_estudiante = %s"
        ]

        for q in dependencias:
            cursor.execute(q, (id,))

        cursor.execute("DELETE FROM estudiantes WHERE id_estudiante = %s", (id,))
        if cursor.rowcount == 0:
            conn.rollback()
            cursor.close()
            conn.close()
            return jsonify({'error': 'Estudiante no encontrado'}), 404

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        return _error_interno(e)
