# ════════════════════════════════════════════════════════════════════════════════
# BLUEPRINT: DOCENTES — Admin + Panel del docente
# ════════════════════════════════════════════════════════════════════════════════

from flask import Blueprint, jsonify, request, session
import psycopg
import psycopg
from datetime import datetime
from utils.database import get_db
from utils.helpers import _error_interno, log_action, role_required

docentes_bp = Blueprint('docentes', __name__)

# ── Admin de docentes ────────────────────────────────────────────────────────

@docentes_bp.route('/api/docentes', methods=['GET'])
def api_docentes():
    """Listar docentes con sus asignaciones"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
             SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo, u.is_activo,
                 COUNT(DISTINCT a.id_asignacion) as total_asignaciones,
                 COUNT(DISTINCT a.id_grado) as total_grados,
                 STRING_AGG(DISTINCT m.nombre_materia, ', ' ORDER BY m.nombre_materia) AS materias,
                 STRING_AGG(DISTINCT g.nombre_grado, ', ' ORDER BY g.nombre_grado) AS grados
             FROM usuarios u
             LEFT JOIN asignaciones_docente a ON u.id_usuario = a.id_usuario AND a.estado = 'Activa'
             LEFT JOIN materias m ON a.id_materia = m.id_materia
             LEFT JOIN grados g ON a.id_grado = g.id_grado
             WHERE u.id_rol = 4
             GROUP BY u.id_usuario
             ORDER BY u.apellido, u.nombre
        """)
        docentes = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'docentes': docentes}), 200
    except Exception as e:
        return _error_interno(e)


@docentes_bp.route('/api/docentes/disponibles', methods=['GET'])
def api_docentes_disponibles():
    """Lista simple de usuarios con rol Profesor activos para selección"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo, u.is_activo
            FROM usuarios u
            WHERE u.id_rol = 4 AND u.is_activo = TRUE
            ORDER BY u.apellido, u.nombre
        """)
        docentes = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'docentes': docentes}), 200
    except Exception as e:
        return _error_interno(e)


@docentes_bp.route('/api/docentes/<int:id>/estado', methods=['PATCH'])
@role_required('admin_server')
def api_docente_actualizar_estado(current_user, id):
    """Cambiar el estado de la cuenta de un docente, no el estado de sus asignaciones."""
    conn = None
    cursor = None
    try:
        data = request.get_json(silent=True) or {}
        estado = data.get('is_activo')
        if isinstance(estado, bool):
            estado_activo = estado
        elif estado in (1, '1', 'true', 't', 'Activo'):
            estado_activo = True
        elif estado in (0, '0', 'false', 'f', 'Inactivo'):
            estado_activo = False
        else:
            return jsonify({'error': 'El estado debe ser Activo o Inactivo'}), 400

        conn = get_db()
        if conn is None:
            return jsonify({'error': 'No hay conexión con la base de datos'}), 503
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE usuarios
            SET is_activo = %s
            WHERE id_usuario = %s AND id_rol = 4
            RETURNING is_activo
        """, (estado_activo, id))
        resultado = cursor.fetchone()
        if not resultado:
            conn.rollback()
            return jsonify({'error': 'Docente no encontrado'}), 404

        conn.commit()
        log_action(
            current_user['id_usuario'], 'UPDATE',
            f"Estado del docente {id} cambiado a {'Activo' if estado_activo else 'Inactivo'}.",
            tabla_afectada='usuarios', registro_id=id
        )
        return jsonify({'status': 'ok', 'id_usuario': id, 'is_activo': resultado[0]}), 200
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        return _error_interno(e)
    finally:
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass


@docentes_bp.route('/api/docentes/<int:id>/asignaciones', methods=['GET'])
def api_docente_asignaciones(id):
    """Asignaciones de un docente"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT a.*, m.nombre_materia, g.nombre_grado, gr.codigo_grupo
            FROM asignaciones_docente a
            JOIN materias m ON a.id_materia = m.id_materia
            JOIN grados g ON a.id_grado = g.id_grado
            JOIN grupos gr ON a.id_grupo = gr.id_grupo
            WHERE a.id_usuario = %s AND a.estado = 'Activa'
        """, (id,))
        asignaciones = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'asignaciones': asignaciones}), 200
    except Exception as e:
        return _error_interno(e)


@docentes_bp.route('/api/docentes/<int:id>/asignaciones', methods=['POST'])
def api_docente_guardar_asignaciones(id):
    """Sincroniza asignaciones activas y conserva como inactivas las retiradas."""
    conn = None
    cursor = None
    try:
        data = request.get_json(silent=True) or {}
        asignaciones = data.get('asignaciones')
        if not isinstance(asignaciones, list):
            return jsonify({'error': 'El campo asignaciones debe ser una lista'}), 400

        normalizadas = []
        claves = set()
        for indice, asignacion in enumerate(asignaciones, start=1):
            if not isinstance(asignacion, dict):
                return jsonify({'error': f'La asignación {indice} no es válida'}), 400
            try:
                fila = {
                    'id_materia': int(asignacion['id_materia']),
                    'id_grado': int(asignacion['id_grado']),
                    'id_grupo': int(asignacion['id_grupo']),
                    'año_lectivo': int(asignacion.get('año_lectivo') or datetime.now().year),
                    'estado': 'Activa'
                }
            except (KeyError, TypeError, ValueError):
                return jsonify({'error': f'La asignación {indice} requiere materia, grado y grupo válidos'}), 400
            if min(fila['id_materia'], fila['id_grado'], fila['id_grupo']) < 1:
                return jsonify({'error': f'La asignación {indice} contiene identificadores inválidos'}), 400
            if fila['estado'] not in ('Activa', 'Inactiva'):
                return jsonify({'error': f'El estado de la asignación {indice} no es válido'}), 400
            clave = (fila['id_materia'], fila['id_grado'], fila['id_grupo'])
            if clave in claves:
                return jsonify({'error': f'La asignación {indice} está duplicada'}), 400
            claves.add(clave)
            normalizadas.append(fila)

        conn = get_db()
        if conn is None:
            return jsonify({'error': 'No hay conexión con la base de datos'}), 503
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM usuarios WHERE id_usuario = %s AND id_rol = 4", (id,))
        if not cursor.fetchone():
            conn.rollback()
            return jsonify({'error': 'Docente no encontrado'}), 404

        # Validar las referencias y la unicidad antes de modificar cualquier asignación.
        for fila in normalizadas:
            cursor.execute("""
                SELECT 1
                FROM materias m, grados g, grupos gr
                WHERE m.id_materia = %s AND g.id_grado = %s
                  AND gr.id_grupo = %s AND gr.id_grado = g.id_grado
            """, (fila['id_materia'], fila['id_grado'], fila['id_grupo']))
            if not cursor.fetchone():
                conn.rollback()
                return jsonify({'error': 'Una materia, grado o grupo no existe, o el grupo no corresponde al grado'}), 400
            if fila['estado'] == 'Activa':
                cursor.execute("""
                    SELECT id_usuario FROM asignaciones_docente
                    WHERE id_materia = %s AND id_grado = %s AND id_grupo = %s
                      AND estado = 'Activa' AND id_usuario <> %s
                    LIMIT 1
                """, (fila['id_materia'], fila['id_grado'], fila['id_grupo'], id))
                if cursor.fetchone():
                    conn.rollback()
                    return jsonify({'error': 'Ya hay otro docente activo en esa materia, grado y grupo'}), 409

        cursor.execute("""
            SELECT id_asignacion, id_materia, id_grado, id_grupo
            FROM asignaciones_docente WHERE id_usuario = %s
        """, (id,))
        existentes = cursor.fetchall()
        deseadas = {(f['id_materia'], f['id_grado'], f['id_grupo']): f for f in normalizadas}
        existentes_por_clave = {(r[1], r[2], r[3]): r[0] for r in existentes}

        # Mantener filas históricas; pueden estar referenciadas por horarios.
        for clave, asignacion_id in existentes_por_clave.items():
            if clave not in deseadas:
                cursor.execute("UPDATE asignaciones_docente SET estado = 'Inactiva' WHERE id_asignacion = %s", (asignacion_id,))

        for clave, fila in deseadas.items():
            if clave in existentes_por_clave:
                cursor.execute("""
                    UPDATE asignaciones_docente
                    SET estado = %s, año_lectivo = %s WHERE id_asignacion = %s
                """, (fila['estado'], fila['año_lectivo'], existentes_por_clave[clave]))
            else:
                cursor.execute("""
                    INSERT INTO asignaciones_docente
                        (id_usuario, id_materia, id_grado, id_grupo, año_lectivo, estado)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (id, fila['id_materia'], fila['id_grado'], fila['id_grupo'], fila['año_lectivo'], fila['estado']))

        conn.commit()
        cursor.close()
        conn.close()

        if session.get('user_id'):
            detalle_asignaciones = ', '.join(
                f"materia={fila['id_materia']}/grado={fila['id_grado']}/grupo={fila['id_grupo']}"
                for fila in normalizadas
            ) or 'sin asignaciones activas'
            log_action(
                session.get('user_id'),
                'UPDATE',
                f"Asignaciones del docente {id} actualizadas: {detalle_asignaciones}",
                tabla_afectada='asignaciones_docente',
                registro_id=int(id)
            )

        return jsonify({'status': 'ok'}), 200
    except psycopg.errors.UniqueViolation:
        if conn:
            conn.rollback()
        return jsonify({'error': 'Ya existe esta asignación o el grupo ya tiene docente para esa materia.'}), 409
    except psycopg.errors.ForeignKeyViolation:
        if conn:
            conn.rollback()
        return jsonify({'error': 'No se pudo guardar: verifica que el docente, la materia, el grado y el grupo sigan existiendo.'}), 400
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        if cursor:
            try:
                cursor.close()
            except Exception:
                pass
        if conn:
            try:
                conn.close()
            except Exception:
                pass
        print(f"[ERROR] No se pudieron guardar asignaciones para docente {id}: {e}")
        return jsonify({'error': 'No se guardaron las asignaciones. Verifica los datos y revisa el terminal Flask si el problema continúa.'}), 500


@docentes_bp.route('/api/docentes/<int:id>/grados-grupos', methods=['GET'])
def api_docente_grados_grupos(id):
    """Obtener grados y grupos donde el docente tiene asignaciones activas"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        # Grados distintos del docente
        cursor.execute("""
            SELECT g.id_grado, g.nombre_grado, g.numero_grado
            FROM grados g
            WHERE g.id_grado IN (
                SELECT DISTINCT a.id_grado
                FROM asignaciones_docente a
                WHERE a.id_usuario = %s AND a.estado = 'Activa'
            )
            ORDER BY g.numero_grado
        """, (id,))
        grados = cursor.fetchall()

        # Grupos distintos del docente (con su grado)
        cursor.execute("""
            SELECT gr.id_grupo, gr.codigo_grupo, gr.id_grado,
                   g.nombre_grado, g.numero_grado
            FROM grupos gr
            JOIN grados g ON gr.id_grado = g.id_grado
            WHERE gr.id_grupo IN (
                SELECT DISTINCT a.id_grupo
                FROM asignaciones_docente a
                WHERE a.id_usuario = %s AND a.estado = 'Activa'
            )
            ORDER BY g.numero_grado, gr.codigo_grupo
        """, (id,))
        grupos = cursor.fetchall()

        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'grados': grados, 'grupos': grupos}), 200
    except Exception as e:
        return _error_interno(e)


# ── Panel del docente (mis-materias, mi-horario) ─────────────────────────────

@docentes_bp.route('/api/docente/mis-materias', methods=['GET'])
def api_docente_mis_materias():
    """Materias del docente actual"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401

    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT DISTINCT m.id_materia, m.nombre_materia, m.codigo_materia, m.intensidad_horaria,
                   STRING_AGG(DISTINCT gr.nombre_grado, ', ' ORDER BY gr.nombre_grado) as grados
            FROM asignaciones_docente a
            JOIN materias m ON a.id_materia = m.id_materia
            JOIN grados gr ON a.id_grado = gr.id_grado
            WHERE a.id_usuario = %s AND a.estado = 'Activa'
            GROUP BY m.id_materia
            ORDER BY m.nombre_materia
        """, (session['user_id'],))
        materias = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'materias': materias}), 200
    except Exception as e:
        return _error_interno(e)


@docentes_bp.route('/api/docente/mi-horario', methods=['GET'])
def api_docente_mi_horario():
    """Horario del docente actual"""
    if 'user_id' not in session:
        return jsonify({'error': 'No autenticado'}), 401

    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT h.*, g.codigo_grupo, m.id_materia, m.nombre_materia, gr.nombre_grado
            FROM horarios h
            JOIN grupos g ON h.id_grupo = g.id_grupo
            JOIN grados gr ON g.id_grado = gr.id_grado
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m ON a.id_materia = m.id_materia
            WHERE a.id_usuario = %s
            ORDER BY CASE h.dia_semana
                WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3
                WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 ELSE 6 END, h.hora_inicio
        """, (session['user_id'],))
        horario = cursor.fetchall()

        # Convertir timedelta a string "HH:MM"
        for h in horario:
            for campo in ('hora_inicio', 'hora_fin'):
                val = h.get(campo)
                if val is not None and not isinstance(val, str):
                    total = int(val.total_seconds())
                    h[campo] = f"{total // 3600:02d}:{(total % 3600) // 60:02d}"

        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'horario': horario}), 200
    except Exception as e:
        return _error_interno(e)
