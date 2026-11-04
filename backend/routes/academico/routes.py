# ════════════════════════════════════════════════════════════════════════════════
# BLUEPRINT: ACADÉMICO — Grados, Grupos, Materias, Asignaciones, Períodos,
#                      Calificaciones  (Horarios → routes/horarios.py)
# ════════════════════════════════════════════════════════════════════════════════

from flask import Blueprint, jsonify, request
import psycopg
from datetime import datetime
from utils.database import get_db
from utils.helpers import _error_interno

academico_bp = Blueprint('academico', __name__)

# ── Grados ───────────────────────────────────────────────────────────────────

@academico_bp.route('/api/grados', methods=['GET'])
def api_grados():
    """Listar grados con sus grupos"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT g.id_grado, g.nombre_grado, g.numero_grado, n.nombre_nivel as nivel,
                   COUNT(DISTINCT gr.id_grupo) as total_grupos,
                   COUNT(DISTINCT e.id_estudiante) as total_estudiantes
            FROM grados g
            LEFT JOIN niveles n ON g.id_nivel = n.id_nivel
            LEFT JOIN grupos gr ON g.id_grado = gr.id_grado
            LEFT JOIN estudiantes e ON gr.id_grupo = e.id_grupo AND e.estado = 'Activo'
            GROUP BY g.id_grado, n.nombre_nivel
            ORDER BY g.numero_grado
        """)
        grados = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'grados': grados}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grados', methods=['POST'])
def api_grado_crear():
    """Crear grado"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        numero = data.get('numero_grado') or data.get('orden') or 0
        nombre = data.get('nombre_grado') or None
        cursor.execute("""
            INSERT INTO grados (numero_grado, id_nivel, nombre_grado)
            VALUES (%s, %s, %s)
        """, (int(numero), data.get('id_nivel'), nombre))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 201
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grados/<int:id>', methods=['GET'])
def api_grado_get(id):
    """Obtener grado por id"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT g.*, n.nombre_nivel as nivel
            FROM grados g
            LEFT JOIN niveles n ON g.id_nivel = n.id_nivel
            WHERE g.id_grado = %s
        """, (id,))
        grado = cursor.fetchone()
        cursor.close()
        conn.close()
        if not grado:
            return jsonify({'error': 'No encontrado'}), 404
        return jsonify({'status': 'ok', 'grado': grado}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grados/<int:id>', methods=['PUT'])
def api_grado_update(id):
    """Actualizar grado"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        numero = data.get('numero_grado') or data.get('orden') or 0
        nombre = data.get('nombre_grado') or None
        cursor.execute("""
            UPDATE grados SET numero_grado = %s, id_nivel = %s, nombre_grado = %s
            WHERE id_grado = %s
        """, (int(numero), data.get('id_nivel'), nombre, id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grados/<int:id>', methods=['DELETE'])
def api_grado_delete(id):
    """Eliminar grado"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) as cnt FROM grupos WHERE id_grado = %s", (id,))
        grupos_cnt = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) as cnt FROM asignaciones_docente WHERE id_grado = %s", (id,))
        asign_cnt = cursor.fetchone()[0]
        if grupos_cnt > 0 or asign_cnt > 0:
            cursor.close()
            conn.close()
            msg = []
            if grupos_cnt > 0:
                msg.append(f"{grupos_cnt} grupo(s) relacionados")
            if asign_cnt > 0:
                msg.append(f"{asign_cnt} asignación(es) de docente relacionadas")
            return jsonify({'error': 'No se puede eliminar grado debido a dependencias: ' + ', '.join(msg)}), 400
        cursor.execute("DELETE FROM grados WHERE id_grado = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grados/<int:grado_id>/grupos', methods=['GET'])
def api_grupos_por_grado(grado_id):
    """Obtener grupos de un grado"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id_grupo, codigo_grupo, capacidad_maxima
            FROM grupos WHERE id_grado = %s ORDER BY codigo_grupo
        """, (grado_id,))
        grupos = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'grupos': grupos}), 200
    except Exception as e:
        return _error_interno(e)

# ── Grupos ───────────────────────────────────────────────────────────────────

@academico_bp.route('/api/grupos', methods=['GET'])
def api_grupos():
    """Listar todos los grupos"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT g.id_grupo, g.codigo_grupo, g.capacidad_maxima, gr.nombre_grado, gr.id_grado,
                   COUNT(e.id_estudiante) as total_estudiantes
            FROM grupos g
            JOIN grados gr ON g.id_grado = gr.id_grado
            LEFT JOIN estudiantes e ON g.id_grupo = e.id_grupo AND e.estado = 'Activo'
            GROUP BY g.id_grupo, gr.id_grado, gr.nombre_grado, gr.numero_grado
            ORDER BY gr.numero_grado, g.codigo_grupo
        """)
        grupos = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'grupos': grupos}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grupos', methods=['POST'])
def api_grupo_crear():
    """Crear grupo"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO grupos (codigo_grupo, id_grado, capacidad_maxima)
            VALUES (%s, %s, %s)
        """, (data.get('codigo_grupo', ''), data.get('id_grado'), data.get('capacidad_maxima', 0)))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 201
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grupos/<int:id>', methods=['GET'])
def api_grupo_get(id):
    """Obtener un grupo por id"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT g.id_grupo, g.codigo_grupo, g.capacidad_maxima, gr.id_grado, gr.nombre_grado,
                   (SELECT COUNT(*) FROM estudiantes e WHERE e.id_grupo = g.id_grupo AND e.estado = 'Activo') as total_estudiantes
            FROM grupos g
            JOIN grados gr ON g.id_grado = gr.id_grado
            WHERE g.id_grupo = %s
        """, (id,))
        grupo = cursor.fetchone()
        cursor.close()
        conn.close()
        if not grupo:
            return jsonify({'error': 'No encontrado'}), 404
        return jsonify({'status': 'ok', 'grupo': grupo}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grupos/<int:id>', methods=['PUT'])
def api_grupo_update(id):
    """Actualizar grupo"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE grupos SET codigo_grupo = %s, id_grado = %s, capacidad_maxima = %s
            WHERE id_grupo = %s
        """, (data.get('codigo_grupo', ''), data.get('id_grado'), data.get('capacidad_maxima', 0), id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grupos/<int:id>', methods=['DELETE'])
def api_grupo_delete(id):
    """Eliminar grupo"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM grupos WHERE id_grupo = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except psycopg.IntegrityError as e:
        if 'fk_estudiantes_grupo' in str(e) or 'violates foreign key' in str(e).lower():
            return jsonify({'error': 'No se puede eliminar sin antes verificar que no hayan estudiantes dentro de este grupo'}), 400
        return _error_interno(e)
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/grupos/<int:id>/estudiantes', methods=['GET'])
def api_grupo_estudiantes(id):
    """Estudiantes de un grupo"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT e.* FROM estudiantes e
            WHERE e.id_grupo = %s AND e.estado = 'Activo'
            ORDER BY e.apellido, e.nombre
        """, (id,))
        estudiantes = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'estudiantes': estudiantes}), 200
    except Exception as e:
        return _error_interno(e)

# ── Materias ─────────────────────────────────────────────────────────────────

@academico_bp.route('/api/materias', methods=['GET'])
def api_materias():
    """Listar materias con grados asociados"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT m.*,
                   COUNT(DISTINCT a.id_usuario) as total_docentes,
                   STRING_AGG(DISTINCT g.id_grado::text, ',' ORDER BY g.id_grado::text) as grados_ids,
                   STRING_AGG(DISTINCT g.nombre_grado, ', ' ORDER BY g.nombre_grado) as grados_nombres
            FROM materias m
            LEFT JOIN asignaciones_docente a ON m.id_materia = a.id_materia AND a.estado = 'Activa'
            LEFT JOIN grados g ON a.id_grado = g.id_grado
            WHERE m.codigo_materia != ''
            GROUP BY m.id_materia
            ORDER BY m.nombre_materia
        """)
        materias = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'materias': materias}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/materias', methods=['POST'])
def api_materia_crear():
    """Crear materia"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO materias (nombre_materia, codigo_materia, intensidad_horaria, descripcion)
            VALUES (%s, %s, %s, %s)
        """, (data['nombre_materia'], data['codigo_materia'],
              data.get('intensidad_horaria', 4), data.get('descripcion', '')))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'id_materia': new_id}), 201
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/materias/<int:id>', methods=['GET'])
def api_materia_detalle(id):
    """Detalle de una materia con docentes asignados"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM materias WHERE id_materia = %s", (id,))
        materia = cursor.fetchone()
        if not materia:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Materia no encontrada'}), 404

        for key in ['created_at', 'updated_at']:
            if materia.get(key):
                materia[key] = materia[key].isoformat()

        cursor.execute("""
            SELECT a.id_asignacion, u.id_usuario, u.nombre, u.apellido, g.nombre_grado,
                   a.estado, a.id_grado, a.id_grupo, gr.codigo_grupo
            FROM asignaciones_docente a
            JOIN usuarios u ON a.id_usuario = u.id_usuario
            JOIN grados g ON a.id_grado = g.id_grado
            JOIN grupos gr ON a.id_grupo = gr.id_grupo
            WHERE a.id_materia = %s AND a.estado = 'Activa'
            ORDER BY g.numero_grado, gr.codigo_grupo, u.apellido, u.nombre
        """, (id,))
        materia['docentes'] = cursor.fetchall()

        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'materia': materia}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/materias/<int:id>', methods=['PUT'])
def api_materia_editar(id):
    """Editar materia"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id_materia FROM materias WHERE id_materia = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Materia no encontrada'}), 404

        cursor.execute("""
            UPDATE materias
            SET nombre_materia = %s, codigo_materia = %s, intensidad_horaria = %s, descripcion = %s
            WHERE id_materia = %s
        """, (data['nombre_materia'], data['codigo_materia'],
              data.get('intensidad_horaria', 4), data.get('descripcion', ''), id))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/materias/<int:id>', methods=['DELETE'])
def api_materia_eliminar(id):
    """Eliminar materia"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id_materia FROM materias WHERE id_materia = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Materia no encontrada'}), 404

        cursor.execute(
            "SELECT COUNT(*) as total FROM asignaciones_docente WHERE id_materia = %s AND estado = 'Activa'", (id,))
        if cursor.fetchone()['total'] > 0:
            cursor.close()
            conn.close()
            return jsonify({'error': 'No se puede eliminar: la materia tiene asignaciones de docentes activas'}), 400

        # Verificar dependencias en actividades y notas (para evitar errores de FK en cascada)
        cursor.execute("SELECT COUNT(*) as total FROM actividades WHERE id_materia = %s", (id,))
        if cursor.fetchone()['total'] > 0:
            cursor.close()
            conn.close()
            return jsonify({'error': 'No se puede eliminar: existen actividades relacionadas a esta materia. Elimine primero las actividades o las notas asociadas.'}), 400

        cursor.execute("SELECT COUNT(*) as total FROM notas n JOIN actividades a ON n.id_actividad = a.id_actividad WHERE a.id_materia = %s", (id,))
        if cursor.fetchone()['total'] > 0:
            cursor.close()
            conn.close()
            return jsonify({'error': 'No se puede eliminar: existen notas asociadas a actividades de esta materia. Elimine primero esas notas.'}), 400

        cursor.execute("DELETE FROM materias WHERE id_materia = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/materias/<int:materia_id>/docentes-disponibles', methods=['GET'])
def api_docentes_disponibles_materia(materia_id):
    """Obtener docentes disponibles para asignar a una materia"""
    try:
        grado_id = request.args.get('grado_id')
        grupo_id = request.args.get('grupo_id')
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT u.id_usuario, CONCAT(u.nombre, ' ', u.apellido) as nombre_completo, r.nombre_rol
            FROM usuarios u
            INNER JOIN roles r ON u.id_rol = r.id_rol
            WHERE r.nombre_rol IN ('Profesor', 'profesor', 'Docente', 'docente')
            ORDER BY u.apellido, u.nombre
        """)
        docentes = cursor.fetchall()

        if grado_id and grupo_id:
            cursor.execute("""
                SELECT a.id_usuario
                FROM asignaciones_docente a
                WHERE a.id_materia = %s AND a.id_grado = %s AND a.id_grupo = %s AND a.estado = 'Activa'
            """, (materia_id, grado_id, grupo_id))
            asignados = [row['id_usuario'] for row in cursor.fetchall()]
            docentes = [d for d in docentes if d['id_usuario'] not in asignados]

        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'docentes': docentes}), 200
    except Exception as e:
        return _error_interno(e)

# ── Asignaciones docente ─────────────────────────────────────────────────────

@academico_bp.route('/api/asignaciones-docente', methods=['POST'])
def api_asignacion_crear():
    """Crear asignación docente a materia-grado"""
    try:
        data = request.get_json()
        conn = get_db()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT u.id_usuario FROM usuarios u
            INNER JOIN roles r ON u.id_rol = r.id_rol
            WHERE u.id_usuario = %s AND r.nombre_rol IN ('Profesor', 'profesor', 'Docente', 'docente')
        """, (data['id_usuario'],))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Docente no encontrado o no tiene rol de profesor'}), 400

        cursor.execute("SELECT id_materia FROM materias WHERE id_materia = %s", (data['id_materia'],))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Materia no encontrada'}), 404

        cursor.execute("SELECT id_grado FROM grados WHERE id_grado = %s", (data['id_grado'],))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Grado no encontrado'}), 404

        cursor.execute("""
            SELECT id_grupo FROM grupos
            WHERE id_grupo = %s AND id_grado = %s
        """, (data['id_grupo'], data['id_grado']))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Grupo no encontrado en este grado'}), 404

        cursor.execute("""
            SELECT id_asignacion FROM asignaciones_docente
            WHERE id_usuario = %s AND id_materia = %s AND id_grado = %s AND id_grupo = %s AND estado = 'Activa'
        """, (data['id_usuario'], data['id_materia'], data['id_grado'], data['id_grupo']))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Este docente ya está asignado a esta materia en este grado y grupo'}), 400

        cursor.execute("""
            SELECT id_usuario FROM asignaciones_docente
            WHERE id_materia = %s AND id_grado = %s AND id_grupo = %s AND estado = 'Activa'
        """, (data['id_materia'], data['id_grado'], data['id_grupo']))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Ya existe un docente asignado a esta materia en este grado y grupo. Solo puede haber uno.'}), 400

        año_lectivo = data.get('año_lectivo', 2026)
        cursor.execute("""
            INSERT INTO asignaciones_docente (id_usuario, id_materia, id_grado, id_grupo, año_lectivo, estado)
            VALUES (%s, %s, %s, %s, %s, 'Activa')
            ON CONFLICT (id_usuario, id_materia, id_grado, id_grupo)
            DO UPDATE SET estado = 'Activa', año_lectivo = EXCLUDED.año_lectivo
            RETURNING id_asignacion
        """, (data['id_usuario'], data['id_materia'], data['id_grado'], data['id_grupo'], año_lectivo))
        new_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'id_asignacion': new_id}), 201
    except Exception as e:
        return _error_interno(e)


@academico_bp.route('/api/asignaciones-docente/<int:id>', methods=['DELETE'])
def api_asignacion_eliminar(id):
    """Eliminar asignación docente"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id_asignacion FROM asignaciones_docente WHERE id_asignacion = %s", (id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({'error': 'Asignación no encontrada'}), 404

        cursor.execute("UPDATE asignaciones_docente SET estado = 'Inactiva' WHERE id_asignacion = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return _error_interno(e)

