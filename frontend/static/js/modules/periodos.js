// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO PERÍODOS
// Gestión de períodos académicos + resumen por grado y grupo
// ════════════════════════════════════════════════════════════════════════════════

let PERIODOS_DATA = [];
let PERIODOS_RESUMEN = [];
let PERIODO_SELECCIONADO_ID = null;

function _periodosEsAdmin() {
	const userGlobal = (typeof USUARIO !== 'undefined' && USUARIO) ? USUARIO : (window.USUARIO || {});
	const rol = String(userGlobal.rol || '').trim().toLowerCase();
	return rol === 'server_admin' || rol === 'admin_server' || rol === 'admin' || rol === 'rector';
}

function _periodoFechaCorta(fechaIso) {
	if (!fechaIso) return '--/--';
	const d = new Date(`${fechaIso}T12:00:00`);
	if (Number.isNaN(d.getTime())) return '--/--';
	const dd = String(d.getDate()).padStart(2, '0');
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	return `${dd}/${mm}`;
}

function _periodoEscaparHtml(texto) {
	return String(texto || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

async function _periodosRefrescarDatos(periodoIdPreferido = null) {
	const dataPeriodos = await API.getPeriodos();
	PERIODOS_DATA = dataPeriodos.periodos || [];

	const abierto = PERIODOS_DATA.find(p => p.estado === 'Abierto');
	if (periodoIdPreferido && PERIODOS_DATA.some(p => p.id_periodo === Number(periodoIdPreferido))) {
		PERIODO_SELECCIONADO_ID = Number(periodoIdPreferido);
	} else if (PERIODO_SELECCIONADO_ID && PERIODOS_DATA.some(p => p.id_periodo === Number(PERIODO_SELECCIONADO_ID))) {
		PERIODO_SELECCIONADO_ID = Number(PERIODO_SELECCIONADO_ID);
	} else if (abierto) {
		PERIODO_SELECCIONADO_ID = abierto.id_periodo;
	} else {
		PERIODO_SELECCIONADO_ID = PERIODOS_DATA[0] ? PERIODOS_DATA[0].id_periodo : null;
	}

	PERIODOS_RESUMEN = [];
	if (PERIODO_SELECCIONADO_ID) {
		const dataResumen = await API.getResumenPeriodos(PERIODO_SELECCIONADO_ID);
		PERIODOS_RESUMEN = dataResumen.grados || [];
	}
}

function _periodosRenderResumen() {
	if (!PERIODOS_RESUMEN.length) {
		return `
			<div class="helper-sin-datos" style="margin-top: 1rem;">
				<i class="fas fa-inbox fa-3x"></i>
				<p>No hay grados ni grupos para este período.</p>
			</div>
		`;
	}

	return PERIODOS_RESUMEN.map(grado => {
		const nombreGrado = grado.nombre_grado || `Grado ${grado.numero_grado || ''}`.trim();
		const gruposHtml = (grado.grupos || []).map(grupo => {
			const progreso = Number(grupo.progreso || 0);
			return `
				<div class="grupo-row">
					<div class="grupo-info">
						<span class="grupo-codigo">${_periodoEscaparHtml(grupo.codigo_grupo || '-')}</span>
						<span class="grupo-estudiantes">${grupo.total_estudiantes || 0} estudiantes</span>
					</div>
					<div class="grupo-progreso">
						<div class="progreso-bar">
							<div class="progreso-fill" style="width: ${Math.min(100, Math.max(0, progreso))}%;"></div>
						</div>
						<span class="progreso-text">${progreso}% notas registradas</span>
					</div>
					<button class="btn btn-cafe btn-sm" onclick="verDetalleGrupo(${grado.id_grado}, ${grupo.id_grupo})">
						<i class="fas fa-eye"></i> Ver
					</button>
				</div>
			`;
		}).join('');

		return `
			<div class="grado-accordion">
				<div class="grado-header" onclick="toggleGrado(this)">
					<div class="grado-info">
						<i class="fas fa-chevron-right grado-arrow"></i>
						<span class="grado-nombre">${_periodoEscaparHtml(nombreGrado)}</span>
						<span class="grado-grupos-count">${grado.grupos_count || 0} grupos</span>
					</div>
					<div class="grado-stats">
						<span class="stat-completo"><i class="fas fa-check-circle"></i> ${grado.completos || 0} completos</span>
						<span class="stat-pendiente"><i class="fas fa-clock"></i> ${grado.pendientes || 0} pendientes</span>
					</div>
				</div>
				<div class="grado-body">
					${gruposHtml || '<div class="grupo-row"><span class="grupo-estudiantes">Sin grupos</span></div>'}
				</div>
			</div>
		`;
	}).join('');
}

async function _periodosRenderVista() {
	const content = document.getElementById('main-content');

	const miniCards = PERIODOS_DATA.map(periodo => {
		const estaAbierto = periodo.estado === 'Abierto';
		const estadoDestino = estaAbierto ? 'Cerrado' : 'Abierto';
		return `
			<div class="periodo-mini ${estaAbierto ? 'periodo-abierto' : ''}">
				<span class="periodo-nombre">${_periodoEscaparHtml(periodo.nombre_periodo || `Período ${periodo.numero_periodo || ''}`)}</span>
				<span class="periodo-fechas">${_periodoFechaCorta(periodo.fecha_inicio)} - ${_periodoFechaCorta(periodo.fecha_fin)}</span>
				<button class="btn-estado ${estaAbierto ? 'btn-estado-abierto' : 'btn-estado-cerrado'}" onclick="togglePeriodo(${periodo.id_periodo}, '${estadoDestino}')">
					<i class="fas ${estaAbierto ? 'fa-unlock' : 'fa-lock'}"></i> ${_periodoEscaparHtml(periodo.estado || 'Cerrado')}
				</button>
				<button class="btn btn-cafe btn-sm" style="margin-top:0.6rem;" onclick="abrirModalPeriodo(${periodo.id_periodo})">
					<i class="fas fa-pen"></i> Editar
				</button>
			</div>
		`;
	}).join('');

	const opcionesFiltro = PERIODOS_DATA.map(periodo => `
		<option value="${periodo.id_periodo}" ${Number(periodo.id_periodo) === Number(PERIODO_SELECCIONADO_ID) ? 'selected' : ''}>
			${_periodoEscaparHtml(periodo.nombre_periodo || `Período ${periodo.numero_periodo || ''}`)} ${periodo.estado === 'Abierto' ? '(Actual)' : ''}
		</option>
	`).join('');

	const htmlRes = await fetch('/templates/modules html/periodos.html');
	if (!htmlRes.ok) throw new Error('Error cargando la vista de periodos');
	content.innerHTML = await htmlRes.text();

	document.getElementById('periodos-mini-grid').innerHTML = miniCards || '<p style="grid-column:1/-1;opacity:0.85;">No hay períodos creados.</p>';
	
	const filtroSelect = document.getElementById('filtro-periodo-grado');
	if (filtroSelect) filtroSelect.innerHTML = opcionesFiltro;

	const modalContainer = document.getElementById('periodos-modal-container');
	if (modalContainer && !document.getElementById('modal-periodo-inline')) {
		modalContainer.innerHTML = `
			<div class="modal-overlay" id="modal-periodo-inline">
				<div class="modal" style="max-width: 520px;">
					<div class="modal-header">
						<h2><i class="fas fa-calendar-plus"></i> <span id="modal-periodo-titulo">Nuevo Período</span></h2>
						<button class="modal-close" onclick="cerrarModal('modal-periodo-inline')">&times;</button>
					</div>
					<form id="form-periodo-inline" onsubmit="guardarPeriodo(event)">
						<input type="hidden" id="periodo-id-inline">
						<div class="form-row">
							<div class="form-group">
								<label>Nombre del período</label>
								<input type="text" id="periodo-nombre-inline" required maxlength="120" placeholder="Ej: Período 1">
							</div>
							<div class="form-group">
								<label>Número</label>
								<input type="number" id="periodo-numero-inline" required min="1" max="10" placeholder="1">
							</div>
						</div>
						<div class="form-row">
							<div class="form-group">
								<label>Fecha inicio</label>
								<input type="date" id="periodo-fecha-inicio-inline" required>
							</div>
							<div class="form-group">
								<label>Fecha fin</label>
								<input type="date" id="periodo-fecha-fin-inline" required>
							</div>
						</div>
						<div class="form-group">
							<label>Estado</label>
							<select id="periodo-estado-inline">
								<option value="Cerrado">Cerrado</option>
								<option value="Abierto">Abierto</option>
							</select>
						</div>
						<div class="modal-footer">
							<button type="button" class="btn btn-rojo" onclick="cerrarModal('modal-periodo-inline')">
								<i class="fas fa-times"></i> Cancelar
							</button>
							<button type="submit" class="btn btn-verde">
								<i class="fas fa-save"></i> Guardar
							</button>
						</div>
					</form>
				</div>
			</div>
		`;
	}

	const btnContainer = document.getElementById('periodos-header-actions-dynamic');
	if (btnContainer) {
		btnContainer.innerHTML = _periodosEsAdmin() ? `
			<button class="btn btn-rojo" onclick="resetearCicloAcademico()" title="Borrar datos de trabajo docente para nuevo ciclo">
				<i class="fas fa-broom"></i> Resetear Ciclo
			</button>
		` : '';
	}

	document.getElementById('periodos-resumen-container').innerHTML = _periodosRenderResumen();
}

async function renderPeriodos() {
	const content = document.getElementById('main-content');
	content.innerHTML = Helpers.loading();
	try {
		await _periodosRefrescarDatos();
		await _periodosRenderVista();
	} catch (error) {
		console.error('Error en periodos:', error);
		content.innerHTML = Helpers.error('No se pudo cargar el módulo de períodos');
	}
}

async function periodosCambiarFiltro(periodoId) {
	const content = document.getElementById('main-content');
	content.innerHTML = Helpers.loading();
	try {
		await _periodosRefrescarDatos(Number(periodoId));
		await _periodosRenderVista();
	} catch (error) {
		console.error('Error cambiando filtro de períodos:', error);
		content.innerHTML = Helpers.error('No se pudo cambiar el período de consulta');
	}
}

async function togglePeriodo(id, estadoDestino) {
	try {
		const accion = estadoDestino === 'Abierto' ? 'abrir' : 'cerrar';
		const confirmar = confirm(`¿Deseas ${accion} este período?`);
		if (!confirmar) return;

		await API.cambiarEstadoPeriodo(id, estadoDestino);
		mostrarAlerta(`Período ${accion === 'abrir' ? 'abierto' : 'cerrado'} correctamente`, 'success');
		await _periodosRefrescarDatos(PERIODO_SELECCIONADO_ID);
		await _periodosRenderVista();
	} catch (error) {
		mostrarAlerta(error.message || 'No fue posible cambiar el estado del período', 'error');
	}
}

function toggleGrado(header) {
	const accordion = header.parentElement;
	if (accordion) {
		accordion.classList.toggle('active');
	}
}

function verDetalleGrupo(idGrado, idGrupo) {
	mostrarAlerta(`Grado ${idGrado} - Grupo ${idGrupo}: puedes abrir Calificaciones para ver el detalle`, 'info');
}

function abrirModalPeriodo(id = null) {
	const periodo = id ? PERIODOS_DATA.find(p => Number(p.id_periodo) === Number(id)) : null;

	const titulo = document.getElementById('modal-periodo-titulo');
	const idInput = document.getElementById('periodo-id-inline');
	const nombreInput = document.getElementById('periodo-nombre-inline');
	const numeroInput = document.getElementById('periodo-numero-inline');
	const inicioInput = document.getElementById('periodo-fecha-inicio-inline');
	const finInput = document.getElementById('periodo-fecha-fin-inline');
	const estadoInput = document.getElementById('periodo-estado-inline');

	if (!titulo || !idInput || !nombreInput || !numeroInput || !inicioInput || !finInput || !estadoInput) {
		mostrarAlerta('No se pudo abrir el formulario de período', 'error');
		return;
	}

	if (periodo) {
		titulo.textContent = 'Editar Período';
		idInput.value = periodo.id_periodo;
		nombreInput.value = periodo.nombre_periodo || '';
		numeroInput.value = periodo.numero_periodo || '';
		inicioInput.value = periodo.fecha_inicio || '';
		finInput.value = periodo.fecha_fin || '';
		estadoInput.value = periodo.estado || 'Cerrado';
	} else {
		titulo.textContent = 'Nuevo Período';
		idInput.value = '';
		nombreInput.value = '';
		numeroInput.value = '';
		inicioInput.value = '';
		finInput.value = '';
		estadoInput.value = 'Cerrado';
	}

	abrirModal('modal-periodo-inline');
}

async function guardarPeriodo(event) {
	event.preventDefault();

	const id = document.getElementById('periodo-id-inline').value;
	const nombre = document.getElementById('periodo-nombre-inline').value.trim();
	const numero = parseInt(document.getElementById('periodo-numero-inline').value, 10);
	const fechaInicio = document.getElementById('periodo-fecha-inicio-inline').value;
	const fechaFin = document.getElementById('periodo-fecha-fin-inline').value;
	const estado = document.getElementById('periodo-estado-inline').value;

	if (!nombre || !numero || !fechaInicio || !fechaFin) {
		mostrarAlerta('Completa todos los campos del período', 'error');
		return;
	}

	if (fechaInicio > fechaFin) {
		mostrarAlerta('La fecha de inicio no puede ser mayor a la fecha fin', 'error');
		return;
	}

	const payload = {
		nombre_periodo: nombre,
		numero_periodo: numero,
		fecha_inicio: fechaInicio,
		fecha_fin: fechaFin,
		estado
	};

	try {
		if (id) {
			await API.actualizarPeriodo(id, payload);
			if (estado) {
				await API.cambiarEstadoPeriodo(id, estado);
			}
			mostrarAlerta('Período actualizado correctamente', 'success');
		} else {
			await API.crearPeriodo(payload);
			mostrarAlerta('Período creado correctamente', 'success');
		}

		cerrarModal('modal-periodo-inline');
		await _periodosRefrescarDatos(PERIODO_SELECCIONADO_ID);
		_periodosRenderVista();
	} catch (error) {
		mostrarAlerta(error.message || 'No fue posible guardar el período', 'error');
	}
}

async function resetearCicloAcademico() {
	if (!_periodosEsAdmin()) {
		mostrarAlerta('Solo el administrador puede ejecutar este reseteo', 'error');
		return;
	}

	const confirmado1 = confirm(
		'Resetear ciclo eliminará datos de trabajo docente en Calificaciones, Asistencia, Observador, Comunicados y Reportes. ¿Deseas continuar?'
	);
	if (!confirmado1) return;

	const texto = prompt('Escribe RESETEAR para confirmar:');
	if ((texto || '').trim().toUpperCase() !== 'RESETEAR') {
		mostrarAlerta('Confirmación cancelada. No se realizaron cambios.', 'info');
		return;
	}

	try {
		const response = await fetch('/api/periodos/reset-ciclo', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		});

		let data = {};
		try {
			data = await response.json();
		} catch (_) {
			data = {};
		}

		if (!response.ok) {
			throw new Error(data.error || 'No fue posible resetear el ciclo académico');
		}

		mostrarAlerta(
			`Ciclo reseteado. Tablas: ${data.tablas_limpiadas || 0}, registros: ${data.registros_eliminados || 0}, archivos: ${data.archivos_eliminados || 0}.`,
			'success'
		);

		await _periodosRefrescarDatos(PERIODO_SELECCIONADO_ID);
		_periodosRenderVista();
	} catch (error) {
		mostrarAlerta(error.message || 'No fue posible resetear el ciclo académico', 'error');
	}
}
