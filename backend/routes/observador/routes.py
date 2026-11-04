from flask import Blueprint, jsonify, request, session, send_file
import io
import os
import textwrap
from datetime import datetime

canvas = None
A4 = (595.27, 841.89)
ImageReader = None

from utils.database import get_db
from utils.helpers import _error_interno, validar_fecha_no_futura

observador_bp = Blueprint('observador', __name__)


def _load_reportlab():
	global canvas, A4, ImageReader
	if canvas is not None:
		return True

	try:
		from reportlab.pdfgen import canvas as reportlab_canvas
		from reportlab.lib.pagesizes import A4 as a4_page_size
		from reportlab.lib.utils import ImageReader as image_reader
	except ModuleNotFoundError as error:
		if error.name == 'reportlab':
			return False
		raise

	canvas = reportlab_canvas
	A4 = a4_page_size
	ImageReader = image_reader
	return True


def _get_observador_columns(cursor):
	cursor.execute(
		"""
		SELECT column_name
		FROM information_schema.columns
		WHERE table_schema = current_schema() AND table_name = %s
		""",
		('observador',)
	)
	return {row['column_name'] for row in cursor.fetchall()}


def _get_usuario_column(cols):
	if 'id_usuario' in cols:
		return 'id_usuario'
	if 'id_registrado_por' in cols:
		return 'id_registrado_por'
	return None


def _validar_fechas_observador(data):
	for campo, etiqueta in (
		('fecha_observacion', 'La fecha y hora de la observación'),
		('fecha', 'La fecha de la observación'),
		('fecha_seguimiento', 'La fecha de seguimiento'),
		('fecha_remision', 'La fecha de remisión'),
		('fecha_notificacion', 'La fecha y hora de notificación')
	):
		error = validar_fecha_no_futura(data.get(campo), etiqueta)
		if error:
			return error
	return None


def _obs_iso(value):
	"""Convierte date/datetime a texto ISO de forma segura."""
	if not value or not hasattr(value, 'isoformat'):
		return value
	try:
		return value.isoformat(sep=' ')
	except TypeError:
		return value.isoformat()


def _normalizar_observacion(row, cols):
	if row is None:
		return row

	if 'tipo_observacion' not in row:
		if 'tipo' in row:
			row['tipo_observacion'] = row.get('tipo')
		else:
			row['tipo_observacion'] = 'Neutra'

	if 'fecha_observacion' not in row:
		if 'fecha' in row:
			row['fecha_observacion'] = row.get('fecha')
		elif 'created_at' in row:
			row['fecha_observacion'] = row.get('created_at')

	if row.get('fecha_observacion') and hasattr(row.get('fecha_observacion'), 'isoformat'):
		row['fecha_observacion'] = _obs_iso(row['fecha_observacion'])

	for key in ('fecha_seguimiento', 'fecha_remision', 'fecha_notificacion'):
		if key in row and row.get(key) and hasattr(row.get(key), 'isoformat'):
			row[key] = _obs_iso(row[key])

	if 'acudiente_notificado' in cols and row.get('acudiente_notificado') is not None:
		row['acudiente_notificado'] = bool(row['acudiente_notificado'])

	return row


def _build_schema(cols):
	return {
		'advanced_protocol': all(k in cols for k in ('protocolo_tipo', 'estado_caso')),
		'has_descargos_estudiante': 'descargos_estudiante' in cols,
		'has_medidas_inmediatas': 'medidas_inmediatas' in cols,
		'has_seguimiento': 'seguimiento' in cols,
		'has_fecha_seguimiento': 'fecha_seguimiento' in cols,
		'has_entidad_remitida': 'entidad_remitida' in cols,
		'has_numero_radicado': 'numero_radicado' in cols,
		'has_fecha_remision': 'fecha_remision' in cols,
		'has_acudiente_notificado': 'acudiente_notificado' in cols,
		'has_fecha_notificacion': 'fecha_notificacion' in cols
	}


def _obs_text(value):
	return str(value or '').strip()


def _obs_fit(value, max_len=64):
	text = _obs_text(value)
	if len(text) <= max_len:
		return text
	return text[: max_len - 3] + '...'


def _obs_date_str(value):
	if value is None:
		return ''
	if hasattr(value, 'strftime'):
		return value.strftime('%Y-%m-%d')
	value = str(value).strip()
	if len(value) >= 10:
		return value[:10]
	return value


def _obs_time_str(value):
	if value is None:
		return ''
	if hasattr(value, 'strftime'):
		return value.strftime('%H:%M')
	value = str(value).strip()
	if len(value) >= 5:
		return value[:5]
	return value


def _obs_wrap_text(text, width_chars):
	text = _obs_text(text)
	if not text:
		return []

	lines = []
	for paragraph in text.splitlines() or ['']:
		paragraph = paragraph.strip()
		if not paragraph:
			lines.append('')
			continue
		lines.extend(textwrap.wrap(paragraph, width=max(18, width_chars)))
	return lines


def _obs_draw_lined_block(pdf, x, y_top, w, h, title, body):
	pdf.setFont('Helvetica-Bold', 7.2)
	pdf.drawString(x + 1.5, y_top - 8, _obs_text(title))

	box_top = y_top - 11
	box_h = h - 11
	box_bottom = box_top - box_h
	pdf.rect(x, box_bottom, w, box_h)

	line_step = 10
	line_y = box_top - line_step
	while line_y > box_bottom + 2:
		pdf.line(x + 1, line_y, x + w - 1, line_y)
		line_y -= line_step

	text_lines = _obs_wrap_text(body, int((w - 8) / 3.4))
	pdf.setFont('Helvetica', 7)
	text_y = box_top - 8
	for line in text_lines:
		if text_y < box_bottom + 3:
			break
		pdf.drawString(x + 2, text_y, _obs_fit(line, 170))
		text_y -= line_step


def _obs_draw_meta_table(pdf, x, y_top, w, rows):
	row_h = 12
	table_h = row_h * len(rows)
	bottom = y_top - table_h
	mid_x = x + (w * 0.62)
	left_max = max(28, int((mid_x - x - 6) / 3.4))
	right_max = max(20, int((x + w - mid_x - 6) / 3.4))

	pdf.rect(x, bottom, w, table_h)
	pdf.line(mid_x, bottom, mid_x, y_top)

	for idx in range(1, len(rows)):
		y = y_top - (row_h * idx)
		pdf.line(x, y, x + w, y)

	pdf.setFont('Helvetica', 6.9)
	for idx, row in enumerate(rows):
		y_text = y_top - (row_h * idx) - 8.3
		left = f"{row['left_label']}: {_obs_fit(row['left_value'], left_max)}"
		right = f"{row['right_label']}: {_obs_fit(row['right_value'], right_max)}"
		pdf.drawString(x + 2, y_text, left)
		pdf.drawString(mid_x + 2, y_text, right)

	return table_h


def _obs_draw_single_copy(pdf, x, y_top, w, h, data):
	pdf.rect(x, y_top - h, w, h)
	inner = 6
	left = x + inner
	right = x + w - inner
	usable_w = right - left

	header_h = 46
	current_y = y_top - 2

	logo_path = os.path.abspath(
		os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'frontend', 'static', 'img', 'escudo.png')
	)
	if ImageReader and os.path.exists(logo_path):
		try:
			logo = ImageReader(logo_path)
			pdf.drawImage(logo, left, current_y - 30, width=24, height=24, preserveAspectRatio=True, mask='auto')
		except Exception:
			pass

	pdf.setFont('Helvetica-Bold', 8)
	pdf.drawCentredString(left + (usable_w / 2), current_y - 11, _obs_fit(data.get('institucion'), 88))
	pdf.setFont('Helvetica-Bold', 7.2)
	pdf.drawCentredString(left + (usable_w / 2), current_y - 23, 'REGISTRO ACUMULATIVO DEL PROCESO FORMATIVO INTEGRAL')
	pdf.line(left, current_y - header_h, right, current_y - header_h)
	current_y -= (header_h + 4)

	rows = [
		{'left_label': 'ESTUDIANTE', 'left_value': data.get('estudiante'), 'right_label': 'FECHA', 'right_value': data.get('fecha')},
		{'left_label': 'ACUDIENTE', 'left_value': data.get('acudiente'), 'right_label': 'HORA', 'right_value': data.get('hora')},
		{'left_label': 'PARENTESCO DE ACUDIENTE', 'left_value': data.get('parentesco'), 'right_label': 'CELULAR', 'right_value': data.get('celular')},
		{'left_label': 'GRADO', 'left_value': data.get('grado'), 'right_label': 'DOCENTE', 'right_value': data.get('docente')},
		{'left_label': 'GRUPO', 'left_value': data.get('grupo'), 'right_label': 'ASIGNATURA', 'right_value': data.get('asignatura')}
	]
	table_h = _obs_draw_meta_table(pdf, left, current_y, usable_w, rows)
	current_y -= (table_h + 4)

	sections = [
		('DESCRIPCION Y RESOLUCION', data.get('descripcion_tipificacion'), 100),
		('DESCARGOS DEL ESTUDIANTE', data.get('descargos'), 88),
		('ACCIONES PEDAGOGICAS', data.get('acciones_pedagogicas'), 86),
		('COMPROMISOS Y SEGUIMIENTO', data.get('compromisos_seguimiento'), 86)
	]

	for title, body, height in sections:
		_obs_draw_lined_block(pdf, left, current_y, usable_w, height, title, body)
		current_y -= (height + 4)

	pdf.setFont('Helvetica-Bold', 7)
	pdf.drawString(left, current_y - 2, 'FIRMAS')
	line_y = current_y - 12
	chunk = usable_w / 3
	labels = ['ACUDIENTE', 'ESTUDIANTE', 'DOCENTE']

	for i, label in enumerate(labels):
		lx = left + (chunk * i) + 6
		rx = left + (chunk * (i + 1)) - 6
		pdf.line(lx, line_y, rx, line_y)
		pdf.setFont('Helvetica', 6.8)
		pdf.drawCentredString((lx + rx) / 2, line_y - 9, label)


def _obs_build_formato_data(cursor, cols, id_observacion=None):
	now = datetime.now()
	data = {
		'institucion': 'INSTITUCION EDUCATIVA INEM JULIAN MOTTA SALAS - NEIVA',
		'estudiante': '',
		'grupo': '',
		'acudiente': '',
		'parentesco': '',
		'celular': '',
		'docente': '',
		'grado': '',
		'asignatura': '',
		'fecha': now.strftime('%Y-%m-%d'),
		'hora': now.strftime('%H:%M'),
		'descripcion_tipificacion': '',
		'descargos': '',
		'acciones_pedagogicas': '',
		'compromisos_seguimiento': ''
	}

	if not id_observacion:
		user_id = session.get('user_id')
		if user_id:
			cursor.execute("SELECT nombre, apellido FROM usuarios WHERE id_usuario = %s LIMIT 1", (user_id,))
			usuario = cursor.fetchone()
			if usuario:
				data['docente'] = f"{_obs_text(usuario.get('nombre'))} {_obs_text(usuario.get('apellido'))}".strip()
		return data

	usuario_col = _get_usuario_column(cols)
	if not usuario_col:
		return None

	has_id_materia = 'id_materia' in cols
	materia_select = ''
	materia_join = ''
	if has_id_materia:
		materia_select = ', m.nombre_materia AS asignatura_nombre'
		materia_join = 'LEFT JOIN materias m ON o.id_materia = m.id_materia'

	cursor.execute(
		f"""
		SELECT
			o.*,
			e.nombre AS estudiante_nombre,
			e.apellido AS estudiante_apellido,
			e.acudiente_nombre,
			e.acudiente_telefono,
			g.codigo_grupo,
			gr.nombre_grado,
			u.nombre AS registrado_nombre,
			u.apellido AS registrado_apellido
			{materia_select}
		FROM observador o
		JOIN estudiantes e ON o.id_estudiante = e.id_estudiante
		JOIN grupos g ON e.id_grupo = g.id_grupo
		LEFT JOIN grados gr ON g.id_grado = gr.id_grado
		LEFT JOIN usuarios u ON o.{usuario_col} = u.id_usuario
		{materia_join}
		WHERE o.id_observacion = %s
		LIMIT 1
		""",
		(id_observacion,)
	)
	row = cursor.fetchone()
	if not row:
		return None

	fecha_obs = row.get('fecha_observacion') or now
	tipo = row.get('tipo_observacion') or row.get('tipo') or ''
	protocolo = row.get('protocolo_tipo') or ''
	estado = row.get('estado_caso') or ''
	descripcion = row.get('descripcion') or ''

	partes_descripcion = []
	if tipo:
		partes_descripcion.append(f'Tipo de observacion: {tipo}')
	if protocolo:
		partes_descripcion.append(f'Protocolo: {protocolo}')
	if estado:
		partes_descripcion.append(f'Estado del caso: {estado}')
	if descripcion:
		partes_descripcion.append(descripcion)

	compromiso = _obs_text(row.get('compromiso'))
	seguimiento = _obs_text(row.get('seguimiento'))
	partes_compromisos = []
	if compromiso:
		partes_compromisos.append(f'Compromisos: {compromiso}')
	if seguimiento:
		partes_compromisos.append(f'Seguimiento: {seguimiento}')

	data.update({
		'estudiante': f"{_obs_text(row.get('estudiante_apellido'))}, {_obs_text(row.get('estudiante_nombre'))}".strip(', '),
		'grupo': _obs_text(row.get('codigo_grupo')),
		'celular': _obs_text(row.get('acudiente_telefono')),
		'docente': f"{_obs_text(row.get('registrado_nombre'))} {_obs_text(row.get('registrado_apellido'))}".strip(),
		'grado': _obs_text(row.get('nombre_grado')),
		'asignatura': _obs_text(row.get('asignatura_nombre') or row.get('asignatura')),
		'fecha': _obs_date_str(fecha_obs),
		'hora': _obs_time_str(fecha_obs),
		'descripcion_tipificacion': '\n\n'.join(partes_descripcion),
		'descargos': _obs_text(row.get('descargos_estudiante')) if 'descargos_estudiante' in cols else '',
		'acciones_pedagogicas': _obs_text(row.get('medidas_inmediatas')),
		'compromisos_seguimiento': '\n\n'.join(partes_compromisos)
	})

	return data


def _obs_make_pdf_buffer(data):
	buffer = io.BytesIO()
	pdf = canvas.Canvas(buffer, pagesize=A4)
	page_w, page_h = A4
	margin = 20
	gap = 12
	copy_w = (page_w - (margin * 2) - gap) / 2
	copy_h = page_h - (margin * 2)
	top = page_h - margin

	_obs_draw_single_copy(pdf, margin, top, copy_w, copy_h, data)
	_obs_draw_single_copy(pdf, margin + copy_w + gap, top, copy_w, copy_h, data)

	pdf.showPage()
	pdf.save()
	buffer.seek(0)
	return buffer


@observador_bp.route('/api/observador', methods=['GET'])
def api_observador_listar():
	"""Lista observaciones con datos de estudiante y usuario registrador."""
	try:
		estudiante_id = request.args.get('estudiante_id')

		conn = get_db()
		cursor = conn.cursor(dictionary=True)
		cols = _get_observador_columns(cursor)

		usuario_col = _get_usuario_column(cols)
		if not usuario_col:
			cursor.close()
			conn.close()
			return jsonify({'error': 'La tabla observador no tiene columna de usuario registrador'}), 500

		campos_base = "o.*, e.nombre as estudiante_nombre, e.apellido as estudiante_apellido, g.codigo_grupo, u.nombre as registrado_nombre, u.apellido as registrado_apellido"

		query = f"""
			SELECT {campos_base}
			FROM observador o
			JOIN estudiantes e ON o.id_estudiante = e.id_estudiante
			JOIN grupos g ON e.id_grupo = g.id_grupo
			LEFT JOIN usuarios u ON o.{usuario_col} = u.id_usuario
			WHERE 1=1
		"""
		params = []

		if estudiante_id:
			query += " AND o.id_estudiante = %s"
			params.append(estudiante_id)

		order_col = 'fecha_observacion' if 'fecha_observacion' in cols else ('fecha' if 'fecha' in cols else 'created_at')
		query += f" ORDER BY o.{order_col} DESC, o.id_observacion DESC"

		cursor.execute(query, params)
		observaciones = [_normalizar_observacion(r, cols) for r in cursor.fetchall()]

		cursor.close()
		conn.close()

		return jsonify({
			'status': 'ok',
			'observaciones': observaciones,
			'schema': _build_schema(cols)
		}), 200
	except Exception as e:
		return _error_interno(e)


@observador_bp.route('/api/observador', methods=['POST'])
def api_observador_crear():
	"""Crea una observación, adaptando campos según columnas existentes."""
	try:
		data = request.get_json() or {}
		id_estudiante = data.get('id_estudiante')
		descripcion = (data.get('descripcion') or '').strip()

		if not id_estudiante:
			return jsonify({'error': 'id_estudiante es obligatorio'}), 400
		if not descripcion:
			return jsonify({'error': 'La descripción es obligatoria'}), 400
		error_fecha = _validar_fechas_observador(data)
		if error_fecha:
			return jsonify({'error': error_fecha}), 400

		conn = get_db()
		cursor = conn.cursor(dictionary=True)
		cols = _get_observador_columns(cursor)
		usuario_col = _get_usuario_column(cols)

		if not usuario_col:
			cursor.close()
			conn.close()
			return jsonify({'error': 'La tabla observador no tiene columna de usuario registrador'}), 500

		payload = {
			'id_estudiante': int(id_estudiante),
			usuario_col: int(session.get('user_id') or 0),
			'descripcion': descripcion
		}

		if 'tipo_observacion' in cols:
			payload['tipo_observacion'] = data.get('tipo_observacion') or data.get('tipo') or 'Neutra'
		elif 'tipo' in cols:
			payload['tipo'] = data.get('tipo_observacion') or data.get('tipo') or 'Neutra'

		if 'fecha_observacion' in cols and data.get('fecha_observacion'):
			payload['fecha_observacion'] = data.get('fecha_observacion')
		elif 'fecha' in cols and (data.get('fecha_observacion') or data.get('fecha')):
			payload['fecha'] = data.get('fecha_observacion') or data.get('fecha')

		optional_fields = [
			'categoria', 'compromiso', 'descargos_estudiante', 'protocolo_tipo', 'estado_caso',
			'medidas_inmediatas', 'seguimiento', 'fecha_seguimiento',
			'entidad_remitida', 'numero_radicado', 'fecha_remision',
			'acudiente_notificado', 'fecha_notificacion',
			'id_materia', 'asignatura'
		]

		for field in optional_fields:
			if field in cols and data.get(field) not in (None, ''):
				if field == 'acudiente_notificado':
					payload[field] = bool(data.get(field))
				elif field == 'id_materia':
					payload[field] = int(data.get(field))
				else:
					payload[field] = data.get(field)

		columnas = list(payload.keys())
		placeholders = ', '.join(['%s'] * len(columnas))
		query = f"INSERT INTO observador ({', '.join(columnas)}) VALUES ({placeholders})"
		cursor.execute(query, tuple(payload[c] for c in columnas))
		conn.commit()

		new_id = cursor.lastrowid
		cursor.execute("SELECT * FROM observador WHERE id_observacion = %s", (new_id,))
		nueva_obs = _normalizar_observacion(cursor.fetchone(), cols)

		cursor.close()
		conn.close()
		return jsonify({'status': 'ok', 'observacion': nueva_obs}), 201
	except Exception as e:
		return _error_interno(e)


@observador_bp.route('/api/observador/<int:id_observacion>', methods=['PUT'])
def api_observador_actualizar(id_observacion):
	"""Actualiza una observación existente."""
	try:
		data = request.get_json() or {}
		error_fecha = _validar_fechas_observador(data)
		if error_fecha:
			return jsonify({'error': error_fecha}), 400

		conn = get_db()
		cursor = conn.cursor(dictionary=True)
		cols = _get_observador_columns(cursor)

		cursor.execute("SELECT id_observacion FROM observador WHERE id_observacion = %s", (id_observacion,))
		if not cursor.fetchone():
			cursor.close()
			conn.close()
			return jsonify({'error': 'Observación no encontrada'}), 404

		updates = {}
		mapping = {
			'id_estudiante': 'id_estudiante',
			'descripcion': 'descripcion',
			'descargos_estudiante': 'descargos_estudiante',
			'categoria': 'categoria',
			'compromiso': 'compromiso',
			'id_materia': 'id_materia',
			'asignatura': 'asignatura',
			'protocolo_tipo': 'protocolo_tipo',
			'estado_caso': 'estado_caso',
			'medidas_inmediatas': 'medidas_inmediatas',
			'seguimiento': 'seguimiento',
			'fecha_seguimiento': 'fecha_seguimiento',
			'entidad_remitida': 'entidad_remitida',
			'numero_radicado': 'numero_radicado',
			'fecha_remision': 'fecha_remision',
			'acudiente_notificado': 'acudiente_notificado',
			'fecha_notificacion': 'fecha_notificacion'
		}

		for payload_key, col_name in mapping.items():
			if col_name in cols and payload_key in data:
				value = data.get(payload_key)
				if col_name == 'acudiente_notificado':
					updates[col_name] = bool(value)
				elif col_name == 'id_materia' and value not in (None, ''):
					updates[col_name] = int(value)
				else:
					updates[col_name] = value

		if 'tipo_observacion' in cols and ('tipo_observacion' in data or 'tipo' in data):
			updates['tipo_observacion'] = data.get('tipo_observacion') or data.get('tipo')
		elif 'tipo' in cols and ('tipo_observacion' in data or 'tipo' in data):
			updates['tipo'] = data.get('tipo_observacion') or data.get('tipo')

		if 'fecha_observacion' in cols and ('fecha_observacion' in data or 'fecha' in data):
			updates['fecha_observacion'] = data.get('fecha_observacion') or data.get('fecha')
		elif 'fecha' in cols and ('fecha_observacion' in data or 'fecha' in data):
			updates['fecha'] = data.get('fecha_observacion') or data.get('fecha')

		if not updates:
			cursor.close()
			conn.close()
			return jsonify({'error': 'No hay campos válidos para actualizar'}), 400

		set_clause = ', '.join([f"{k} = %s" for k in updates.keys()])
		params = list(updates.values()) + [id_observacion]
		cursor.execute(f"UPDATE observador SET {set_clause} WHERE id_observacion = %s", params)
		conn.commit()

		cursor.execute("SELECT * FROM observador WHERE id_observacion = %s", (id_observacion,))
		obs = _normalizar_observacion(cursor.fetchone(), cols)

		cursor.close()
		conn.close()
		return jsonify({'status': 'ok', 'observacion': obs}), 200
	except Exception as e:
		return _error_interno(e)


@observador_bp.route('/api/observador/formato.pdf', methods=['GET'])
def api_observador_formato_pdf_blanco():
	"""Genera formato institucional del observador en PDF (version en blanco)."""
	try:
		if not _load_reportlab():
			return jsonify({'error': 'Exportacion PDF no disponible: instala reportlab'}), 500

		conn = get_db()
		cursor = conn.cursor(dictionary=True)
		cols = _get_observador_columns(cursor)
		data = _obs_build_formato_data(cursor, cols, None)

		cursor.close()
		conn.close()

		pdf_buffer = _obs_make_pdf_buffer(data)
		return send_file(
			pdf_buffer,
			mimetype='application/pdf',
			as_attachment=True,
			download_name='formato_observador_blanco.pdf'
		)
	except Exception as e:
		return _error_interno(e)


@observador_bp.route('/api/observador/<int:id_observacion>/formato.pdf', methods=['GET'])
def api_observador_formato_pdf(id_observacion):
	"""Genera formato institucional del observador en PDF con datos del registro."""
	try:
		if not _load_reportlab():
			return jsonify({'error': 'Exportacion PDF no disponible: instala reportlab'}), 500

		conn = get_db()
		cursor = conn.cursor(dictionary=True)
		cols = _get_observador_columns(cursor)
		data = _obs_build_formato_data(cursor, cols, id_observacion)

		cursor.close()
		conn.close()

		if not data:
			return jsonify({'error': 'Observacion no encontrada'}), 404

		pdf_buffer = _obs_make_pdf_buffer(data)
		return send_file(
			pdf_buffer,
			mimetype='application/pdf',
			as_attachment=True,
			download_name=f'formato_observador_{id_observacion}.pdf'
		)
	except Exception as e:
		return _error_interno(e)


@observador_bp.route('/api/observador/<int:id_observacion>', methods=['DELETE'])
def api_observador_eliminar(id_observacion):
	"""Elimina una observación por id."""
	try:
		conn = get_db()
		cursor = conn.cursor()
		cursor.execute("DELETE FROM observador WHERE id_observacion = %s", (id_observacion,))
		conn.commit()
		deleted = cursor.rowcount
		cursor.close()
		conn.close()

		if deleted == 0:
			return jsonify({'error': 'Observación no encontrada'}), 404
		return jsonify({'status': 'ok'}), 200
	except Exception as e:
		return _error_interno(e)
