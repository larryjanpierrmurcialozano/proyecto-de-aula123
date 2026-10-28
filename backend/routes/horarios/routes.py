# ════════════════════════════════════════════════════════════════════════════════
# BLUEPRINT: HORARIOS — CRUD de bloques horarios por grupo/docente
# ════════════════════════════════════════════════════════════════════════════════

from datetime import time, timedelta

from flask import Blueprint, jsonify, request, session
from utils.database import get_db
from utils.helpers import _error_interno, log_action

horarios_bp = Blueprint('horarios', __name__)


def _format_time(value):
    if value is None or isinstance(value, str):
        return value
    if isinstance(value, time):
        return value.strftime('%H:%M')
    if isinstance(value, timedelta):
        total = int(value.total_seconds())
        return f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
    raise TypeError(f"Formato de hora no compatible: {type(value).__name__}")


# ── Listar horarios (con filtros opcionales) ─────────────────────────────────

@horarios_bp.route('/api/horarios', methods=['GET'])
def api_horarios():
    """
    Listar horarios con filtros opcionales:
      ?grupo_id=  &grado_id=  &docente_id=
    """
    try:
        grupo_id   = request.args.get('grupo_id')
        grado_id   = request.args.get('grado_id')
        docente_id = request.args.get('docente_id')

        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT h.id_horario, h.id_asignacion, h.id_grupo, h.dia_semana,
                   h.hora_inicio, h.hora_fin, h.numero_bloque, h.aula, h.observaciones,
                   g.codigo_grupo, gr.id_grado, gr.nombre_grado,
                   m.id_materia, m.nombre_materia,
                   u.id_usuario, u.nombre AS docente_nombre, u.apellido AS docente_apellido
            FROM horarios h
            JOIN grupos g         ON h.id_grupo      = g.id_grupo
            JOIN grados gr        ON g.id_grado       = gr.id_grado
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m       ON a.id_materia     = m.id_materia
            JOIN usuarios u       ON a.id_usuario     = u.id_usuario
            WHERE 1=1
        """
        params = []

        if grupo_id:
            query += " AND h.id_grupo = %s"
            params.append(grupo_id)
        if grado_id:
            query += " AND gr.id_grado = %s"
            params.append(grado_id)
        if docente_id:
            query += " AND u.id_usuario = %s"
            params.append(docente_id)

        query += """ ORDER BY CASE h.dia_semana
            WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3
            WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 ELSE 6 END, h.hora_inicio"""
        cursor.execute(query, tuple(params))
        horarios = cursor.fetchall()

        for h in horarios:
            for campo in ('hora_inicio', 'hora_fin'):
                h[campo] = _format_time(h.get(campo))

        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'horarios': horarios}), 200
    except Exception as e:
        return _error_interno(e)


# ── Obtener un horario por id ────────────────────────────────────────────────

@horarios_bp.route('/api/horarios/<int:id>', methods=['GET'])
def api_horario_get(id):
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT h.*, g.codigo_grupo, m.nombre_materia,
                   u.nombre AS docente_nombre, u.apellido AS docente_apellido
            FROM horarios h
            JOIN grupos g         ON h.id_grupo      = g.id_grupo
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m       ON a.id_materia     = m.id_materia
            JOIN usuarios u       ON a.id_usuario     = u.id_usuario
            WHERE h.id_horario = %s
        """, (id,))
        horario = cursor.fetchone()
        cursor.close()
        conn.close()
        if not horario:
            return jsonify({'error': 'Horario no encontrado'}), 404

        for campo in ('hora_inicio', 'hora_fin'):
            horario[campo] = _format_time(horario.get(campo))

        return jsonify({'status': 'ok', 'horario': horario}), 200
    except Exception as e:
        return _error_interno(e)


# ── Crear bloque de horario ──────────────────────────────────────────────────

@horarios_bp.route('/api/horarios', methods=['POST'])
def api_horario_crear():
    """
    Crear un bloque de horario.
    Body: { id_asignacion, id_grupo, dia_semana, hora_inicio, hora_fin, aula?, observaciones? }
    """
    try:
        data = request.get_json()

        requeridos = ['id_asignacion', 'id_grupo', 'dia_semana', 'hora_inicio', 'hora_fin']
        faltantes  = [c for c in requeridos if not data.get(c)]
        if faltantes:
            return jsonify({'error': f'Campos requeridos faltantes: {", ".join(faltantes)}'}), 400

        dia = data['dia_semana']
        if dia not in ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'):
            return jsonify({'error': 'Día de semana inválido'}), 400

        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        # Validar que la asignación existe y está activa
        cursor.execute("""
            SELECT id_asignacion, id_grupo FROM asignaciones_docente
            WHERE id_asignacion = %s AND estado = 'Activa'
        """, (data['id_asignacion'],))
        asig = cursor.fetchone()
        if not asig:
            cursor.close(); conn.close()
            return jsonify({'error': 'Asignación no encontrada o inactiva'}), 404

        # Validar que el grupo existe
        cursor.execute("SELECT id_grupo FROM grupos WHERE id_grupo = %s", (data['id_grupo'],))
        if not cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({'error': 'Grupo no encontrado'}), 404

        # Buscar choque de horario en el mismo grupo, mismo día y rango superpuesto
        cursor.execute("""
            SELECT h.id_horario, m.nombre_materia
            FROM horarios h
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m ON a.id_materia = m.id_materia
            WHERE h.id_grupo = %s AND h.dia_semana = %s
              AND h.hora_inicio < %s AND h.hora_fin > %s
        """, (data['id_grupo'], dia, data['hora_fin'], data['hora_inicio']))
        choque = cursor.fetchone()
        if choque:
            cursor.close(); conn.close()
            return jsonify({
                'error': f'Choque de horario: ya existe "{choque["nombre_materia"]}" en ese rango de horas'
            }), 400

        # Buscar choque del docente (mismo docente, mismo día, horario superpuesto en OTRO grupo)
        cursor.execute("""
            SELECT a2.id_usuario FROM asignaciones_docente a2
            WHERE a2.id_asignacion = %s
        """, (data['id_asignacion'],))
        docente_row = cursor.fetchone()
        if docente_row:
            cursor.execute("""
                SELECT h.id_horario, g.codigo_grupo, m.nombre_materia
                FROM horarios h
                JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
                JOIN materias m ON a.id_materia = m.id_materia
                JOIN grupos g ON h.id_grupo = g.id_grupo
                WHERE a.id_usuario = %s AND h.dia_semana = %s
                  AND h.hora_inicio < %s AND h.hora_fin > %s
            """, (docente_row['id_usuario'], dia, data['hora_fin'], data['hora_inicio']))
            choque_docente = cursor.fetchone()
            if choque_docente:
                cursor.close(); conn.close()
                return jsonify({
                    'error': f'El docente ya tiene clase de "{choque_docente["nombre_materia"]}" en {choque_docente["codigo_grupo"]} a esa hora'
                }), 400

        cursor.execute("""
            INSERT INTO horarios (id_asignacion, id_grupo, dia_semana, hora_inicio, hora_fin, aula, observaciones)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            data['id_asignacion'], data['id_grupo'], dia,
            data['hora_inicio'], data['hora_fin'],
            data.get('aula', ''), data.get('observaciones', '')
        ))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'CREATE',
                f"Horario creado (grupo={data['id_grupo']}, dia={dia}, {data['hora_inicio']}-{data['hora_fin']})",
                tabla_afectada='horarios',
                registro_id=int(new_id),
                exito=True
            )
        return jsonify({'status': 'ok', 'id_horario': new_id}), 201
    except Exception as e:
        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'Error',
                'Fallo al crear horario',
                tabla_afectada='horarios',
                exito=False
            )
        return _error_interno(e)


# ── Actualizar bloque ────────────────────────────────────────────────────────

@horarios_bp.route('/api/horarios/<int:id>', methods=['PUT'])
def api_horario_update(id):
    try:
        data = request.get_json()
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT * FROM horarios WHERE id_horario = %s", (id,))
        existente = cursor.fetchone()
        if not existente:
            cursor.close(); conn.close()
            return jsonify({'error': 'Horario no encontrado'}), 404

        dia        = data.get('dia_semana',    existente['dia_semana'])
        h_inicio   = data.get('hora_inicio',   existente['hora_inicio'])
        h_fin      = data.get('hora_fin',      existente['hora_fin'])
        id_asig    = data.get('id_asignacion', existente['id_asignacion'])
        id_grupo   = data.get('id_grupo',      existente['id_grupo'])
        aula       = data.get('aula',          existente.get('aula', ''))
        obs        = data.get('observaciones', existente.get('observaciones', ''))

        h_inicio = _format_time(h_inicio)
        h_fin = _format_time(h_fin)

        # Choque de grupo (excluir este registro)
        cursor.execute("""
            SELECT h.id_horario, m.nombre_materia
            FROM horarios h
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m ON a.id_materia = m.id_materia
            WHERE h.id_grupo = %s AND h.dia_semana = %s
              AND h.hora_inicio < %s AND h.hora_fin > %s
              AND h.id_horario != %s
        """, (id_grupo, dia, h_fin, h_inicio, id))
        choque = cursor.fetchone()
        if choque:
            cursor.close(); conn.close()
            return jsonify({'error': f'Choque: ya existe "{choque["nombre_materia"]}" en ese rango'}), 400

        cursor.execute("""
            UPDATE horarios
            SET id_asignacion = %s, id_grupo = %s, dia_semana = %s,
                hora_inicio = %s, hora_fin = %s, aula = %s, observaciones = %s
            WHERE id_horario = %s
        """, (id_asig, id_grupo, dia, h_inicio, h_fin, aula, obs, id))
        conn.commit()
        cursor.close()
        conn.close()

        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'UPDATE',
                f"Horario actualizado (grupo={id_grupo}, dia={dia}, {h_inicio}-{h_fin})",
                tabla_afectada='horarios',
                registro_id=int(id),
                exito=True
            )
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'Error',
                'Fallo al actualizar horario',
                tabla_afectada='horarios',
                registro_id=int(id),
                exito=False
            )
        return _error_interno(e)


# ── Eliminar bloque ──────────────────────────────────────────────────────────

@horarios_bp.route('/api/horarios/<int:id>', methods=['DELETE'])
def api_horario_delete(id):
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id_horario FROM horarios WHERE id_horario = %s", (id,))
        if not cursor.fetchone():
            cursor.close(); conn.close()
            return jsonify({'error': 'Horario no encontrado'}), 404
        cursor.execute("DELETE FROM horarios WHERE id_horario = %s", (id,))
        conn.commit()
        cursor.close()
        conn.close()

        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'DELETE',
                'Horario eliminado',
                tabla_afectada='horarios',
                registro_id=int(id),
                exito=True
            )
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'Error',
                'Fallo al eliminar horario',
                tabla_afectada='horarios',
                registro_id=int(id),
                exito=False
            )
        return _error_interno(e)


# ── Asignaciones activas de un grupo (para poblar selects) ───────────────────

@horarios_bp.route('/api/horarios/asignaciones-grupo/<int:grupo_id>', methods=['GET'])
def api_asignaciones_grupo(grupo_id):
    """
    Devuelve las asignaciones activas de un grupo
    (materia + docente) para llenar el select al crear un bloque.
    """
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT a.id_asignacion, a.id_materia, m.nombre_materia,
                   a.id_usuario, u.nombre AS docente_nombre, u.apellido AS docente_apellido
            FROM asignaciones_docente a
            JOIN materias m  ON a.id_materia = m.id_materia
            JOIN usuarios u  ON a.id_usuario = u.id_usuario
            WHERE a.id_grupo = %s AND a.estado = 'Activa'
            ORDER BY m.nombre_materia
        """, (grupo_id,))
        asignaciones = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'asignaciones': asignaciones}), 200
    except Exception as e:
        return _error_interno(e)


# ── Exportar horarios a PDF ──────────────────────────────────────────────────

@horarios_bp.route('/api/horarios/exportar-pdf', methods=['POST'])
def api_exportar_horario_pdf():
    """
    Recibe:
      - horarios: array de bloques con: nombre_materia, docente_nombre, docente_apellido, 
                                        dia_semana, hora_inicio, codigo_grupo, nombre_grado
      - titulo: string del título del reporte (ej: "6vo - 6-Aa")
      - tipo: 'grupos' o 'docentes'
    Retorna: PDF descargable
    """
    try:
        data = request.json
        horarios = data.get('horarios', [])
        titulo = data.get('titulo', 'Horario')
        tipo = data.get('tipo', 'grupos')
        
        from fpdf import FPDF
        from datetime import datetime
        
        # Crear PDF
        pdf = FPDF(orientation='L', unit='mm', format='A4')
        pdf.add_page()
        
        # Encabezado
        pdf.set_font('Arial', 'B', 14)
        pdf.ln(3)
        pdf.cell(0, 8, 'INSTITUCIÓN EDUCATIVA INEM JULIÁN MOTTA SALAS', ln=True, align='C')
        pdf.set_font('Arial', 'B', 11)
        pdf.cell(0, 7, f'Horario: {titulo}', ln=True, align='C')
        pdf.set_font('Arial', '', 9)
        pdf.cell(0, 6, f'Generado: {datetime.now().strftime("%d/%m/%Y %H:%M")}', ln=True, align='C')
        pdf.ln(4)
        
        # Crear matriz de horario
        dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes']
        horas = [f'{h:02d}:00' for h in range(7, 14)]
        
        # Mapeo: dia_hora -> lista de materias/docentes
        grilla = {}
        for hora in horas:
            for dia in dias:
                grilla[f'{dia}_{hora}'] = []
        
        for h in horarios:
            dia = h.get('dia_semana', '')
            hora = h.get('hora_inicio', '')[:5]
            materia = h.get('nombre_materia', '')
            
            if tipo == 'grupos':
                docente = f"{h.get('docente_apellido', '')}, {h.get('docente_nombre', '')}".strip() or 'Sin prof.'
                texto = f"{materia}\n{docente}"
            else:
                grupo = h.get('codigo_grupo', '')
                texto = f"{materia}\n{grupo}"
            
            clave = f'{dia}_{hora}'
            if clave in grilla:
                grilla[clave].append(texto)
        
        # Dimensiones
        col_hora = 14
        col_dia = 32
        row_height = 11
        
        # Calcular ancho total para centrar
        ancho_tabla = col_hora + (col_dia * 5)
        x_inicio = (pdf.w - 20 - ancho_tabla) / 2 + 10  # Centrar en la página
        
        # Encabezado de tabla
        pdf.set_xy(x_inicio, pdf.y)
        pdf.set_font('Arial', 'B', 9)
        
        pdf.cell(col_hora, row_height, 'HORA', border=1, align='C')
        for dia in dias:
            pdf.cell(col_dia, row_height, dia, border=1, align='C')
        pdf.ln(row_height)
        
        # Filas de datos
        pdf.set_font('Arial', '', 6.5)
        for hora in horas:
            pdf.set_x(x_inicio)
            y_fila = pdf.y
            
            # Celda de hora
            pdf.cell(col_hora, row_height, hora, border=1, align='C')
            
            # Celdas de días
            for dia in dias:
                clave = f'{dia}_{hora}'
                materias = grilla.get(clave, [])
                
                # Construir texto
                if materias:
                    # Usar máximo 2 líneas (2 materias/horarios en la misma celda)
                    texto = '\n'.join(materias[:2])
                else:
                    # Celda vacía: agregar espacios en blanco para llenar
                    texto = ' \n '
                
                # Posición actual
                x_celda = pdf.x
                
                # Usar multi_cell para llenar toda la altura
                pdf.multi_cell(col_dia, row_height/2, texto, border=1, align='C')
                
                # Asegurar altura uniforme y posición correcta
                pdf.set_xy(x_celda + col_dia, y_fila)
            
            pdf.ln(row_height)
        
        # Generar PDF en memoria
        from io import BytesIO
        from flask import send_file
        
        # fpdf 1.x devuelve str; convertir a bytes para send_file
        pdf_bytes = pdf.output(dest='S').encode('latin-1')
        filename = f"Horario_{titulo.replace(' ', '_').replace('-', '')}.pdf"

        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'Export',
                f"Descarga PDF horario ({titulo})",
                tabla_afectada='horarios',
                exito=True
            )

        return send_file(
            BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        if session.get('user_id'):
            log_action(
                session.get('user_id'),
                'Error',
                'Fallo al exportar PDF de horario',
                tabla_afectada='horarios',
                exito=False
            )
        return _error_interno(e)
    except Exception as e:
        return _error_interno(e)


@horarios_bp.route('/api/horarios/asignaciones-grado/<int:grado_id>', methods=['GET'])
def api_asignaciones_grado(grado_id):
    """
    Devuelve las asignaciones activas para un grado (docente + materia).
    Útil para filtrar docentes cuando sólo se selecciona grado pero no grupo.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT DISTINCT a.id_asignacion, a.id_materia, m.nombre_materia,
                   a.id_usuario, u.nombre AS docente_nombre, u.apellido AS docente_apellido
            FROM asignaciones_docente a
            JOIN materias m ON a.id_materia = m.id_materia
            JOIN usuarios u ON a.id_usuario = u.id_usuario
            WHERE a.id_grado = %s AND a.estado = 'Activa'
            ORDER BY u.apellido, m.nombre_materia
        """, (grado_id,))
        asignaciones = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'asignaciones': asignaciones}), 200
    except Exception as e:
        return _error_interno(e)


# ── Niveles (para filtro de la UI) ───────────────────────────────────────────

@horarios_bp.route('/api/niveles', methods=['GET'])
def api_niveles():
    """Listar niveles académicos"""
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM niveles ORDER BY id_nivel")
        niveles = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'status': 'ok', 'niveles': niveles}), 200
    except Exception as e:
        return _error_interno(e)
