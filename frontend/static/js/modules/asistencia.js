// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO ASISTENCIA (CONTROL DE ASISTENCIA)
// Interfaz tipo planilla con botones Presente/Ausente/Tardío + observación
// ════════════════════════════════════════════════════════════════════════════════

let ASIST_GRADOS = [];
let ASIST_GRUPOS = [];
let ASIST_MATERIAS = [];
let ASIST_PERIODOS = [];
let ASIST_ESTUDIANTES = [];
let ASIST_REGISTROS = {};       // { id_estudiante: { asistio, comentario } }
let ASIST_JUSTIFICANTES = [];
let ASIST_FILTROS = { grado: null, grupo: null, materia: null, periodo: null };
let ASIST_FECHA = asistFechaLocalActual();
let ASIST_SESION_EXISTENTE = false;
let ASIST_ID_SESION = null;
let ASIST_VISTA = 'registro'; // 'registro' | 'resumen' | 'justificaciones'

function asistFechaLocalActual() {
    const hoy = new Date();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');
    return `${hoy.getFullYear()}-${mes}-${dia}`;
}

function asistNotificar(mensaje, tipo = 'info') {
    const prev = document.getElementById('asist-toast');
    if (prev) prev.remove();

    const toast = document.createElement('div');
    toast.id = 'asist-toast';
    toast.className = `asist-toast asist-toast-${tipo}`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);

    window.setTimeout(() => toast.classList.add('active'), 10);
    window.setTimeout(() => {
        toast.classList.remove('active');
        window.setTimeout(() => toast.remove(), 250);
    }, 3200);
}

function asistCerrarModalJustificante() {
    const modal = document.getElementById('modal-asist-justificante');
    if (modal) {
        modal.classList.remove('active');
    }
}

function _asistPeriodoSeleccionado() {
    return ASIST_PERIODOS.find(p => String(p.id_periodo) === String(ASIST_FILTROS.periodo));
}

function asistPeriodoCerrado() {
    const periodo = _asistPeriodoSeleccionado();
    return !!periodo && String(periodo.estado || '').toLowerCase() === 'cerrado';
}

function _asistActualizarAvisoPeriodo() {
    const cont = document.getElementById('asist-alerta-periodo');
    if (!cont) return;

    const periodo = _asistPeriodoSeleccionado();
    if (asistPeriodoCerrado()) {
        const nombre = periodo?.nombre_periodo || 'Período seleccionado';
        cont.innerHTML = `
            <div class="asist-aviso-periodo asist-aviso-cerrado">
                <i class="fas fa-lock"></i>
                <div>
                    <strong>${nombre} está cerrado.</strong>
                    <span>Solo el administrador puede modificar asistencias en este período. Puedes consultar la información en modo lectura.</span>
                </div>
            </div>
        `;
    } else {
        cont.innerHTML = '';
    }
}

// ═══════════════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

async function renderAsistencia() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const res = await API.request('/api/asistencia/filtros');
        ASIST_GRADOS = res.grados || [];
        ASIST_PERIODOS = res.periodos || [];

        const periodoAbierto = ASIST_PERIODOS.find(p => p.estado === 'Abierto');
        ASIST_FILTROS.periodo = periodoAbierto ? periodoAbierto.id_periodo : (ASIST_PERIODOS[0]?.id_periodo || null);

        // Fetch the HTML component
        const htmlRes = await fetch('/templates/modules html/asistencia.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de asistencia');
        content.innerHTML = await htmlRes.text();

        // Llenar dinámicamente los campos
        const gradoSelect = document.getElementById('asist-filtro-grado');
        gradoSelect.innerHTML = '<option value="">Seleccionar grado...</option>' + 
            ASIST_GRADOS.map(g => `<option value="${g.id_grado}">${g.nombre_grado || 'Grado ' + g.numero_grado}</option>`).join('');

        const periodoSelect = document.getElementById('asist-filtro-periodo');
        periodoSelect.innerHTML = ASIST_PERIODOS.map(p => 
            `<option value="${p.id_periodo}" ${p.id_periodo === ASIST_FILTROS.periodo ? 'selected' : ''}>${p.nombre_periodo} ${p.estado === 'Abierto' ? '(Activo)' : ''}</option>`
        ).join('');

        const fechaSelect = document.getElementById('asist-filtro-fecha');
        if (fechaSelect) {
            const hoy = asistFechaLocalActual();
            fechaSelect.max = hoy;
            if (ASIST_FECHA > hoy) ASIST_FECHA = hoy;
            fechaSelect.value = ASIST_FECHA;
        }

        _asistActualizarAvisoPeriodo();
    } catch (error) {
        console.error('Error renderAsistencia:', error);
        content.innerHTML = Helpers.error('No se pudieron cargar los filtros.');
    }
}

// ═══════════════════════════════════════════════════════════════════
// FILTROS DINÁMICOS (Grado → Grupo → Materia)
// ═══════════════════════════════════════════════════════════════════

async function asistCambiarGrado(gradoId) {
    ASIST_FILTROS.grado = gradoId || null;
    ASIST_FILTROS.grupo = null;
    ASIST_FILTROS.materia = null;

    const selGrupo = document.getElementById('asist-filtro-grupo');
    const selMateria = document.getElementById('asist-filtro-materia');
    selGrupo.innerHTML = '<option value="">Seleccionar grupo...</option>';
    selMateria.innerHTML = '<option value="">Seleccionar materia...</option>';
    selGrupo.disabled = true;
    selMateria.disabled = true;
    _asistOcultarContenido();

    if (!gradoId) return;

    try {
        const res = await API.request(`/api/asistencia/grupos/${gradoId}`);
        ASIST_GRUPOS = res.grupos || [];
        selGrupo.innerHTML = '<option value="">Seleccionar grupo...</option>' +
            ASIST_GRUPOS.map(g => `<option value="${g.id_grupo}">${g.codigo_grupo}</option>`).join('');
        selGrupo.disabled = false;
    } catch (error) {
        mostrarAlerta('Error al cargar grupos', 'error');
    }
}

async function asistCambiarGrupo(grupoId) {
    ASIST_FILTROS.grupo = grupoId || null;
    ASIST_FILTROS.materia = null;

    const selMateria = document.getElementById('asist-filtro-materia');
    selMateria.innerHTML = '<option value="">Seleccionar materia...</option>';
    selMateria.disabled = true;
    _asistOcultarContenido();

    if (!grupoId) return;

    try {
        const res = await API.request(`/api/asistencia/materias/${grupoId}`);
        ASIST_MATERIAS = res.materias || [];
        selMateria.innerHTML = '<option value="">Seleccionar materia...</option>' +
            ASIST_MATERIAS.map(m => `<option value="${m.id_materia}">${m.nombre_materia}</option>`).join('');
        selMateria.disabled = false;
    } catch (error) {
        mostrarAlerta('Error al cargar materias', 'error');
    }
}

async function asistCambiarMateria(materiaId) {
    ASIST_FILTROS.materia = materiaId || null;
    if (materiaId) {
        _asistCargarVista();
    } else {
        _asistOcultarContenido();
    }
}

function asistCambiarPeriodo(periodoId) {
    ASIST_FILTROS.periodo = periodoId || null;
    _asistActualizarAvisoPeriodo();
    if (ASIST_FILTROS.grupo && ASIST_FILTROS.materia) {
        _asistCargarVista();
    }
}

function asistCambiarFecha(fecha) {
    const hoy = asistFechaLocalActual();
    const fechaSelect = document.getElementById('asist-filtro-fecha');
    if (fecha > hoy) {
        mostrarAlerta('No puedes registrar asistencia en una fecha futura.', 'warning');
        ASIST_FECHA = hoy;
        if (fechaSelect) fechaSelect.value = hoy;
        if (ASIST_FILTROS.grupo && ASIST_FILTROS.materia && ASIST_VISTA === 'registro') {
            asistCargarTabla();
        }
        return;
    }

    ASIST_FECHA = fecha;
    if (ASIST_FILTROS.grupo && ASIST_FILTROS.materia && ASIST_VISTA === 'registro') {
        asistCargarTabla();
    }
}

function _asistOcultarContenido() {
    document.getElementById('asist-contenido').innerHTML = `
        <div class="asist-placeholder">
            <i class="fas fa-hand-point-up fa-3x"></i>
            <p>Selecciona <strong>Grado → Grupo → Materia</strong> para registrar la asistencia</p>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════
// TABS / VISTAS
// ═══════════════════════════════════════════════════════════════════

function asistCambiarVista(vista) {
    ASIST_VISTA = vista;
    document.querySelectorAll('.asist-tab').forEach(t => t.classList.remove('asist-tab-active'));
    document.getElementById(`tab-${vista}`).classList.add('asist-tab-active');

    // Mostrar/ocultar campo fecha según vista
    const fechaWrap = document.getElementById('asist-filtro-fecha-wrap');
    if (fechaWrap) fechaWrap.style.display = vista === 'registro' ? '' : 'none';

    if (ASIST_FILTROS.grupo && ASIST_FILTROS.materia) {
        _asistCargarVista();
    }
}

function _asistCargarVista() {
    switch (ASIST_VISTA) {
        case 'registro':    asistCargarTabla(); break;
        case 'resumen':     asistCargarResumen(); break;
        case 'justificaciones': asistCargarJustificaciones(); break;
    }
}

// ═══════════════════════════════════════════════════════════════════
// VISTA: REGISTRO DE ASISTENCIA (tabla con botones)
// ═══════════════════════════════════════════════════════════════════

async function asistCargarTabla() {
    const wrapper = document.getElementById('asist-contenido');
    wrapper.innerHTML = Helpers.loading();

    try {
        const res = await API.request(
            `/api/asistencia/tabla?grupo_id=${ASIST_FILTROS.grupo}&materia_id=${ASIST_FILTROS.materia}&periodo_id=${ASIST_FILTROS.periodo}&fecha=${ASIST_FECHA}`
        );

        ASIST_ESTUDIANTES = res.estudiantes || [];
        ASIST_SESION_EXISTENTE = res.sesion_existente;
        ASIST_ID_SESION = res.id_asistencia_diaria;

        // Indexar registros: predeterminar todos como no_registrado
        ASIST_REGISTROS = {};
        ASIST_ESTUDIANTES.forEach(est => {
            const existente = res.registros[est.id_estudiante];
            const idAsistenciaLegacy = res.ids_asistencia_legacy?.[est.id_estudiante] || null;
            ASIST_REGISTROS[est.id_estudiante] = existente || { asistio: 'no_registrado', comentario: '' };
            ASIST_REGISTROS[est.id_estudiante].id_asistencia = idAsistenciaLegacy;
            ASIST_REGISTROS[est.id_estudiante].justificante_id = ASIST_REGISTROS[est.id_estudiante].justificante_id || null;
            ASIST_REGISTROS[est.id_estudiante].justificante_aprobado = !!ASIST_REGISTROS[est.id_estudiante].justificante_aprobado;
        });

        _asistRenderTabla();
    } catch (error) {
        console.error('Error asistCargarTabla:', error);
        wrapper.innerHTML = Helpers.error('No se pudieron cargar los datos de asistencia.');
    }
}

function _asistRenderTabla() {
    const wrapper = document.getElementById('asist-contenido');
    const bloqueado = asistPeriodoCerrado();

    if (!ASIST_ESTUDIANTES.length) {
        wrapper.innerHTML = `
            <div class="asist-placeholder">
                <i class="fas fa-user-slash fa-3x"></i>
                <p>No hay estudiantes activos en este grupo.</p>
            </div>`;
        return;
    }

    const fechaDisplay = new Date(ASIST_FECHA + 'T12:00:00').toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    let html = `
        <div class="asist-registro-header">
            <div class="asist-fecha-display">
                <i class="fas fa-calendar-day"></i>
                <span>${fechaDisplay}</span>
                ${ASIST_SESION_EXISTENTE ? '<span class="asist-badge-editando"><i class="fas fa-edit"></i> Editando registro existente</span>' : '<span class="asist-badge-nuevo"><i class="fas fa-plus-circle"></i> Nuevo registro</span>'}
            </div>
            <div class="asist-acciones-rapidas">
                <button class="btn-asist-rapido btn-asist-todos-presente" onclick="asistMarcarTodos('presente')" ${bloqueado ? 'disabled' : ''}>
                    <i class="fas fa-check-double"></i> Todos Presente
                </button>
                <button class="btn-asist-rapido btn-asist-todos-ausente" onclick="asistMarcarTodos('ausente')" ${bloqueado ? 'disabled' : ''}>
                    <i class="fas fa-times-circle"></i> Todos Ausente
                </button>
            </div>
        </div>

        <div class="asist-tabla-container">
            <table class="asist-tabla">
                <thead>
                    <tr>
                        <th class="asist-th-num">#</th>
                        <th class="asist-th-estudiante">Estudiante</th>
                        <th class="asist-th-estado">Estado</th>
                        <th class="asist-th-obs">Observación</th>
                    </tr>
                </thead>
                <tbody>`;

    ASIST_ESTUDIANTES.forEach((est, idx) => {
        const reg = ASIST_REGISTROS[est.id_estudiante];
        const estado = reg.asistio;
        const justificadoAprobado = !!reg.justificante_aprobado;
        const claseFila = justificadoAprobado
            ? 'asist-row-justificado'
            : (estado !== 'no_registrado' ? 'asist-row-' + estado : '');

        html += `
            <tr id="asist-row-${est.id_estudiante}" class="asist-row ${claseFila}">
                <td class="asist-td-num">${idx + 1}</td>
                <td class="asist-td-estudiante">
                    <div class="asist-estudiante-cell">
                        <div class="avatar">${Helpers.getIniciales(est.nombre, est.apellido)}</div>
                        <span>${est.apellido}, ${est.nombre}</span>
                        ${justificadoAprobado ? '<span class="asist-badge-justificado">Justificado</span>' : ''}
                    </div>
                </td>
                <td class="asist-td-estado">
                    <div class="asist-btns-estado">
                        <button class="asist-btn-estado asist-btn-presente ${estado === 'presente' ? 'asist-btn-activo' : ''}"
                                onclick="asistCambiarEstado(${est.id_estudiante}, 'presente')" title="Presente" ${bloqueado ? 'disabled' : ''}>
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="asist-btn-estado asist-btn-ausente ${estado === 'ausente' ? 'asist-btn-activo' : ''}"
                                onclick="asistCambiarEstado(${est.id_estudiante}, 'ausente')" title="Ausente" ${bloqueado ? 'disabled' : ''}>
                            <i class="fas fa-times"></i>
                        </button>
                        <button class="asist-btn-estado asist-btn-tardio ${estado === 'tardio' ? 'asist-btn-activo' : ''}"
                                onclick="asistCambiarEstado(${est.id_estudiante}, 'tardio')" title="Tardío" ${bloqueado ? 'disabled' : ''}>
                            <i class="fas fa-clock"></i>
                        </button>
                        <button class="asist-btn-estado asist-btn-justificado ${reg.justificante_id ? 'asist-btn-activo' : ''}"
                                onclick="asistAbrirModalJustificante(${est.id_estudiante})" title="Justificar" ${bloqueado ? 'disabled' : ''}>
                            J
                        </button>
                    </div>
                </td>
                <td class="asist-td-obs">
                    <input type="text" class="asist-input-obs" placeholder="Observación..."
                           value="${_asistEscaparHtml(reg.comentario)}"
                           data-estudiante="${est.id_estudiante}"
                           onchange="asistCambiarComentario(${est.id_estudiante}, this.value)" ${bloqueado ? 'disabled' : ''}>
                </td>
            </tr>`;
    });

    html += `
                </tbody>
            </table>
        </div>

        <div class="asist-footer">
            <div class="asist-stats" id="asist-stats"></div>
            <button class="btn btn-verde btn-asist-guardar" id="btn-asist-guardar" onclick="asistGuardar()" ${bloqueado ? 'disabled' : ''}>
                <i class="fas ${bloqueado ? 'fa-lock' : 'fa-save'}"></i> ${bloqueado ? 'Período Cerrado' : 'Guardar Asistencia'}
            </button>
        </div>`;

    wrapper.innerHTML = html;
    _asistActualizarStats();
}

function _asistEscaparHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

// ═══════════════════════════════════════════════════════════════════
// INTERACCIÓN: Botones de estado
// ═══════════════════════════════════════════════════════════════════

function asistCambiarEstado(idEstudiante, nuevoEstado) {
    if (asistPeriodoCerrado()) {
        mostrarAlerta('Período cerrado: no puedes modificar asistencia.', 'warning');
        return;
    }

    const reg = ASIST_REGISTROS[idEstudiante];
    
    // Si el nuevo estado ya está activo, deseleccionar
    if (reg.asistio === nuevoEstado) {
        reg.asistio = 'no_registrado';
    } else {
        // Si hay justificante aprobado y se intenta cambiar a otro estado, desactivar justificante
        if (reg.justificante_aprobado) {
            reg.justificante_aprobado = false;
        }
        reg.asistio = nuevoEstado;
    }

    // Actualizar UI de la fila
    const row = document.getElementById(`asist-row-${idEstudiante}`);
    const claseFila = reg.justificante_aprobado
        ? 'asist-row-justificado'
        : (reg.asistio !== 'no_registrado' ? 'asist-row-' + reg.asistio : '');
    row.className = `asist-row ${claseFila}`;

    // Actualizar botones activos
    row.querySelectorAll('.asist-btn-estado').forEach(btn => btn.classList.remove('asist-btn-activo'));
    if (reg.asistio !== 'no_registrado') {
        row.querySelector(`.asist-btn-${reg.asistio}`).classList.add('asist-btn-activo');
    }

    _asistActualizarStats();
}

function asistCambiarComentario(idEstudiante, valor) {
    if (asistPeriodoCerrado()) {
        mostrarAlerta('Período cerrado: no puedes modificar asistencia.', 'warning');
        return;
    }

    ASIST_REGISTROS[idEstudiante].comentario = valor;
}

function asistMarcarTodos(estado) {
    if (asistPeriodoCerrado()) {
        mostrarAlerta('Período cerrado: no puedes modificar asistencia.', 'warning');
        return;
    }

    ASIST_ESTUDIANTES.forEach(est => {
        ASIST_REGISTROS[est.id_estudiante].asistio = estado;
    });
    _asistRenderTabla();
}

function _asistActualizarStats() {
    const stats = document.getElementById('asist-stats');
    if (!stats) return;

    let presentes = 0, ausentes = 0, tardios = 0, justificados = 0, sinRegistrar = 0;
    Object.values(ASIST_REGISTROS).forEach(r => {
        if (r.justificante_aprobado) {
            justificados++;
        } else if (r.asistio === 'presente') {
            presentes++;
        } else if (r.asistio === 'ausente') {
            ausentes++;
        } else if (r.asistio === 'tardio') {
            tardios++;
        } else if (r.asistio === 'no_registrado') {
            sinRegistrar++;
        }
    });

    stats.innerHTML = `
        <span class="asist-stat-item asist-stat-presente"><i class="fas fa-check"></i> ${presentes} Presentes</span>
        <span class="asist-stat-item asist-stat-ausente"><i class="fas fa-times"></i> ${ausentes} Ausentes</span>
        <span class="asist-stat-item asist-stat-tardio"><i class="fas fa-clock"></i> ${tardios} Tardíos</span>
        <span class="asist-stat-item asist-stat-justificado"><i class="fas fa-file-medical"></i> ${justificados} Justificados</span>
        ${sinRegistrar > 0 ? `<span class="asist-stat-item asist-stat-pendiente"><i class="fas fa-question-circle"></i> ${sinRegistrar} Sin registrar</span>` : ''}
    `;
}

// ═══════════════════════════════════════════════════════════════════
// GUARDAR ASISTENCIA
// ═══════════════════════════════════════════════════════════════════

async function asistGuardar() {
    if (!ASIST_FECHA || ASIST_FECHA > asistFechaLocalActual()) {
        mostrarAlerta('No puedes guardar asistencia en una fecha futura.', 'warning');
        return;
    }

    if (asistPeriodoCerrado()) {
        mostrarAlerta('Período cerrado: solo el administrador puede guardar cambios.', 'warning');
        return;
    }

    const registros = ASIST_ESTUDIANTES.map(est => ({
        id_estudiante: est.id_estudiante,
        asistio: ASIST_REGISTROS[est.id_estudiante].asistio,
        comentario: ASIST_REGISTROS[est.id_estudiante].comentario
    }));

    // Verificar que al menos un estudiante tenga estado
    const registrados = registros.filter(r => r.asistio !== 'no_registrado');
    if (!registrados.length) {
        mostrarAlerta('Debes marcar al menos un estudiante antes de guardar', 'warning');
        return;
    }

    const btn = document.getElementById('btn-asist-guardar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const res = await API.request('/api/asistencia/guardar', {
            method: 'POST',
            body: JSON.stringify({
                grupo_id: parseInt(ASIST_FILTROS.grupo),
                materia_id: parseInt(ASIST_FILTROS.materia),
                periodo_id: parseInt(ASIST_FILTROS.periodo),
                fecha: ASIST_FECHA,
                registros: registros
            })
        });

        ASIST_SESION_EXISTENTE = true;
        ASIST_ID_SESION = res.id_asistencia_diaria;
        ASIST_ESTUDIANTES.forEach(est => {
            const idAsistenciaLegacy = res.ids_asistencia_legacy?.[est.id_estudiante];
            if (idAsistenciaLegacy) {
                ASIST_REGISTROS[est.id_estudiante].id_asistencia = idAsistenciaLegacy;
            }
        });
        mostrarAlerta(`Asistencia guardada correctamente: ${res.guardados} registro(s)`, 'success');

        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Asistencia';

        // Actualizar badge de "Editando"
        const badgeNew = document.querySelector('.asist-badge-nuevo');
        if (badgeNew) {
            badgeNew.className = 'asist-badge-editando';
            badgeNew.innerHTML = '<i class="fas fa-edit"></i> Editando registro existente';
        }
    } catch (error) {
        mostrarAlerta(error.message || 'Error al guardar asistencia', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar Asistencia';
    }
}

// ═══════════════════════════════════════════════════════════════════
// VISTA: RESUMEN POR ESTUDIANTE
// ═══════════════════════════════════════════════════════════════════

async function asistCargarResumen() {
    const wrapper = document.getElementById('asist-contenido');
    wrapper.innerHTML = Helpers.loading();

    try {
        const res = await API.request(
            `/api/asistencia/resumen?grupo_id=${ASIST_FILTROS.grupo}&materia_id=${ASIST_FILTROS.materia}&periodo_id=${ASIST_FILTROS.periodo}`
        );

        const estudiantes = res.estudiantes || [];

        if (!estudiantes.length) {
            wrapper.innerHTML = `
                <div class="asist-placeholder">
                    <i class="fas fa-chart-bar fa-3x"></i>
                    <p>No hay datos de asistencia consolidados para este período.</p>
                </div>`;
            return;
        }

        let html = `
            <div class="asist-resumen-container">
                <div class="asist-resumen-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px;">
                    <h3 style="margin: 0; color: #333; font-size: 14px; font-weight: 600;">Resumen de Asistencia por Estudiante</h3>
                    <button onclick="asistDescargarReporteGeneral()" class="btn btn-primary" style="display: flex; align-items: center; gap: 8px; padding: 8px 15px; background: #0F6B42; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                        <i class="fas fa-download"></i> Descargar Reporte General
                    </button>
                </div>
                <table class="asist-tabla asist-tabla-resumen">
                    <thead>
                        <tr>
                            <th class="asist-th-num">#</th>
                            <th class="asist-th-estudiante">Estudiante</th>
                            <th>Presencias</th>
                            <th>Ausencias</th>
                            <th>Justificantes</th>
                            <th>Tardíos</th>
                            <th>Total Clases</th>
                            <th>% Asistencia</th>
                            <th style="text-align: center;">Estado</th>
                        </tr>
                    </thead>
                    <tbody>`;

        estudiantes.forEach((est, idx) => {
            const pct = est.porcentaje_asistencia || 0;
            const estado = est.estado_asistencia || '—';
            const esCritica = est.es_critica;

            let claseEstado = '';
            if (estado === 'excelente') claseEstado = 'asist-estado-excelente';
            else if (estado === 'bueno') claseEstado = 'asist-estado-bueno';
            else if (estado === 'regular') claseEstado = 'asist-estado-regular';
            else if (estado === 'deficiente') claseEstado = 'asist-estado-deficiente';
            else if (estado === 'critico') claseEstado = 'asist-estado-critico';

            html += `
                <tr class="${esCritica ? 'asist-row-critica' : ''}">
                    <td class="asist-td-num">${idx + 1}</td>
                    <td class="asist-td-estudiante">
                        <div class="asist-estudiante-cell">
                            <div class="avatar">${Helpers.getIniciales(est.nombre, est.apellido)}</div>
                            <span>${est.apellido}, ${est.nombre}</span>
                            ${esCritica ? '<i class="fas fa-exclamation-triangle asist-icono-critica" title="Inasistencia crítica"></i>' : ''}
                        </div>
                    </td>
                    <td class="asist-td-centro">${est.total_presencias || 0}</td>
                    <td class="asist-td-centro ${(est.total_ausencias || 0) > 0 ? 'asist-texto-rojo' : ''}">${est.total_ausencias || 0}</td>
                    <td class="asist-td-centro">${est.total_justificados || 0}</td>
                    <td class="asist-td-centro">${est.total_tardios || 0}</td>
                    <td class="asist-td-centro">${est.total_clases_programadas || 0}</td>
                    <td class="asist-td-centro"><strong>${pct.toFixed(1)}%</strong></td>
                    <td style="text-align: center;"><span class="asist-badge-estado ${claseEstado}">${estado}</span></td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        wrapper.innerHTML = html;
    } catch (error) {
        wrapper.innerHTML = Helpers.error('No se pudo cargar el resumen.');
    }
}

// ═══════════════════════════════════════════════════════════════════
// DESCARGAR REPORTES
// ═══════════════════════════════════════════════════════════════════

async function asistDescargarReporteGeneral() {
    const grado = ASIST_FILTROS.grado;
    const grupo = ASIST_FILTROS.grupo;
    const materia = ASIST_FILTROS.materia;
    const periodo = ASIST_FILTROS.periodo;
    const anio = new Date().getFullYear();

    if (!grado || !grupo || !materia || !periodo) {
        asistNotificar('Por favor selecciona Grado, Grupo, Materia y Período', 'error');
        return;
    }

    try {
        asistNotificar('Generando reporte consolidado en Excel...', 'info');

        const url = `/api/asistencia/reportes/general?grado_id=${encodeURIComponent(grado)}&grupo_id=${encodeURIComponent(grupo)}&materia_id=${encodeURIComponent(materia)}&periodo_id=${encodeURIComponent(periodo)}&anio=${encodeURIComponent(anio)}`;
        const response = await fetch(url);

        if (!response.ok) {
            let mensaje = 'Error al generar reporte';
            try {
                const error = await response.json();
                mensaje = error.error || error.detalle || mensaje;
            } catch (_) {
                const texto = await response.text();
                if (texto) mensaje = texto.slice(0, 180);
            }
            asistNotificar(mensaje, 'error');
            return;
        }

        const blob = await response.blob();
        if (!blob || blob.size === 0) {
            asistNotificar('El servidor devolvió un archivo Excel vacío.', 'error');
            return;
        }

        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Reporte_Asistencia_P${periodo}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(blobUrl);

        asistNotificar('Reporte Excel descargado exitosamente', 'success');
    } catch (error) {
        console.error('[ERROR] asistDescargarReporteGeneral:', error);
        asistNotificar('Error al generar reporte: ' + error.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════════
// VISTA: JUSTIFICACIONES
// ═══════════════════════════════════════════════════════════════════

async function asistCargarJustificaciones() {
    const wrapper = document.getElementById('asist-contenido');
    wrapper.innerHTML = Helpers.loading();

    try {
        const res = await API.request(
            `/api/asistencias/justificantes?grupo_id=${ASIST_FILTROS.grupo}&materia_id=${ASIST_FILTROS.materia}&periodo_id=${ASIST_FILTROS.periodo}`
        );

        ASIST_JUSTIFICANTES = res.justificantes || [];

        if (!ASIST_JUSTIFICANTES.length) {
            wrapper.innerHTML = `
                <div class="asist-placeholder">
                    <i class="fas fa-file-medical-alt fa-3x"></i>
                    <p>No hay justificantes registrados para este filtro.</p>
                </div>`;
            return;
        }

        let html = `
            <div class="asist-just-container" style="width: 100%; overflow-x: auto;">
                <table class="asist-tabla asist-tabla-justificaciones" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--crema-fondo);">
                            <th class="asist-th-estudiante" style="text-align: left; padding: 0.4rem 0.5rem; font-size: 0.65rem; font-weight: 700; color: var(--cafe-oscuro); text-transform: uppercase; letter-spacing: 0.2px; border-bottom: 1px solid rgba(71, 85, 105, 0.1);">Estudiante</th>
                            <th style="text-align: center; padding: 0.4rem 0.5rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--cafe-oscuro); letter-spacing: 0.2px; border-bottom: 1px solid rgba(71, 85, 105, 0.1);">Fecha del Documento</th>
                            <th style="text-align: center; padding: 0.4rem 0.5rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--cafe-oscuro); letter-spacing: 0.2px; border-bottom: 1px solid rgba(71, 85, 105, 0.1);">Tipo</th>
                            <th style="text-align: center; padding: 0.4rem 0.5rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--cafe-oscuro); letter-spacing: 0.2px; border-bottom: 1px solid rgba(71, 85, 105, 0.1);">Soporte</th>
                            <th style="text-align: center; padding: 0.4rem 0.5rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: var(--cafe-oscuro); letter-spacing: 0.2px; border-bottom: 1px solid rgba(71, 85, 105, 0.1);">Aprobado</th>
                        </tr>
                    </thead>
                    <tbody>`;

        ASIST_JUSTIFICANTES.forEach(j => {
            const fechaDoc = j.fecha_documento ? new Date(`${j.fecha_documento}T12:00:00`).toLocaleDateString('es-CO') : 'Sin fecha';
            html += `
                <tr style="border-bottom: 1px solid var(--border, #f1f5f9);">
                    <td style="padding: 0.55rem 0.75rem; text-align: left;">
                        <div class="asist-estudiante-cell">
                            <div class="avatar">${Helpers.getIniciales(j.nombre, j.apellido)}</div>
                            <span>${j.apellido}, ${j.nombre}</span>
                        </div>
                    </td>
                    <td style="padding: 0.55rem 0.75rem; text-align: center; font-size: 0.85rem;">${fechaDoc}</td>
                    <td style="padding: 0.55rem 0.75rem; text-align: center; font-size: 0.85rem;">${j.tipo_justificante || 'Otro'}</td>
                    <td style="padding: 0.55rem 0.75rem; text-align: center;">
                        ${j.archivo_path ? `
                            <button class="btn-asist-ver-soporte" onclick="asistVerSoporteJustificante(${j.id_justificante})">
                                <i class="fas fa-file-pdf"></i> Ver PDF
                            </button>
                        ` : '<span class="asist-texto-muted">Sin archivo</span>'}
                    </td>
                    <td style="padding: 0.55rem 0.75rem; text-align: center;">
                        <label class="asist-switch" style="margin: 0 auto; display: inline-block;">
                            <input type="checkbox" ${j.aprobado ? 'checked' : ''} onchange="asistActualizarAprobacionJustificante(${j.id_justificante}, this)">
                            <span class="asist-slider"></span>
                        </label>
                    </td>
                </tr>`;
        });

        html += `</tbody></table></div>`;
        wrapper.innerHTML = html;
    } catch (error) {
        wrapper.innerHTML = Helpers.error(error.message || 'No se pudieron cargar las justificaciones.');
    }
}

function asistVerSoporteJustificante(idJustificante) {
    const url = `/api/asistencias/justificantes/${idJustificante}/archivo`;
    window.open(url, '_blank');
}

async function asistActualizarAprobacionJustificante(idJustificante, input) {
    const aprobado = input.checked;
    input.disabled = true;

    try {
        await API.request(`/api/asistencias/justificantes/${idJustificante}/aprobar`, {
            method: 'PUT',
            body: JSON.stringify({ aprobado })
        });

        Object.values(ASIST_REGISTROS).forEach(reg => {
            if (String(reg.justificante_id || '') === String(idJustificante)) {
                reg.justificante_aprobado = aprobado;
            }
        });

        if (ASIST_VISTA === 'registro') {
            _asistRenderTabla();
        }

        asistNotificar(aprobado ? 'Justificante aprobado' : 'Aprobación removida', 'success');
    } catch (error) {
        input.checked = !aprobado;
        asistNotificar(error.message || 'No fue posible actualizar la aprobación', 'error');
    } finally {
        input.disabled = false;
    }
}

function asistAbrirModalJustificante(idEstudiante) {
    if (asistPeriodoCerrado()) {
        asistNotificar('Período cerrado: no puedes crear justificantes.', 'warning');
        return;
    }

    if (!ASIST_ID_SESION) {
        asistNotificar('Primero guarda la asistencia del día para registrar justificantes.', 'warning');
        return;
    }

    const est = ASIST_ESTUDIANTES.find(e => String(e.id_estudiante) === String(idEstudiante));
    if (!est) return;

    const reg = ASIST_REGISTROS[idEstudiante] || {};
    if (!reg.asistio) {
        reg.asistio = 'no_registrado';
        ASIST_REGISTROS[idEstudiante] = reg;
    }

    let modal = document.getElementById('modal-asist-justificante');
    if (!modal) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-asist-justificante" class="modal-overlay">
                <div class="modal-content asist-modal-justificante">
                    <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; padding: 1.25rem; border-bottom: 1px solid #dbeafe;">
                        <h3 style="margin: 0; color: #0f172a; font-size: 1.1rem; font-weight: 700;"><i class="fas fa-file-medical"></i> Registrar Justificante de Ausencia</h3>
                        <button class="modal-close" onclick="asistCerrarModalJustificante()" style="border: none; background: transparent; font-size: 1.4rem; cursor: pointer; color: #475569;">&times;</button>
                    </div>
                    <div class="modal-body" style="padding: 1.5rem;">
                        <form id="form-asist-justificante" class="asist-form-justificante">
                            <input type="hidden" id="asist-just-id-estudiante">
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">Estudiante</label>
                                <input type="text" id="asist-just-estudiante" readonly style="width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #dbeafe; border-radius: 6px; background: #f0f9ff; color: #0f172a; font-size: 0.88rem;">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">Tipo de Justificante <span style="color: #dc2626;">*</span></label>
                                <select id="asist-just-tipo" required style="width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1e293b; font-size: 0.88rem;">
                                    <option value="Médico">Médico</option>
                                    <option value="Familiar">Familiar</option>
                                    <option value="Administrativo">Administrativo</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">Fecha del Documento <span style="color: #dc2626;">*</span></label>
                                <input type="date" id="asist-just-fecha" style="width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1e293b; font-size: 0.88rem;">
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">Documento de Soporte (PDF) <span style="color: #dc2626;">*</span></label>
                                <input type="file" id="asist-just-archivo" accept=".pdf" style="width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1e293b; font-size: 0.88rem;">
                                <small style="display: block; margin-top: 0.4rem; color: #64748b; font-size: 0.75rem;"><i class="fas fa-info-circle" style="color: #D4AF37;"></i> Solo se permiten documentos en formato PDF</small>
                            </div>
                            <div class="form-group">
                                <label style="font-size: 0.8rem; font-weight: 600; color: #475569;">Descripción</label>
                                <textarea id="asist-just-descripcion" placeholder="Ej: Consulta médica, cita importante..." style="width: 100%; padding: 0.45rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #1e293b; font-size: 0.88rem; resize: vertical; min-height: 80px;"></textarea>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer" style="padding: 1rem 1.5rem; border-top: 1px solid #dbeafe; display: flex; justify-content: flex-end; gap: 0.6rem;">
                        <button type="button" onclick="asistCerrarModalJustificante()" style="padding: 0.5rem 1rem; border: 1px solid #cbd5e1; background: #fff; border-radius: 6px; cursor: pointer; color: #475569; font-weight: 600; font-size: 0.9rem;">Cancelar</button>
                        <button type="button" id="btn-guardar-justificante" onclick="asistGuardarJustificante()" style="padding: 0.5rem 1.2rem; border: none; background: #2563eb; color: #fff; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem; display: flex; align-items: center; gap: 0.4rem;"><i class="fas fa-save"></i> Guardar</button>
                    </div>
                </div>
            </div>
        `);
        modal = document.getElementById('modal-asist-justificante');
    }

    document.getElementById('asist-just-id-estudiante').value = idEstudiante;
    document.getElementById('asist-just-estudiante').value = `${est.apellido}, ${est.nombre}`;
    document.getElementById('asist-just-tipo').value = 'Médico';
    const fechaDocumento = document.getElementById('asist-just-fecha');
    fechaDocumento.max = asistFechaLocalActual();
    fechaDocumento.value = ASIST_FECHA;
    document.getElementById('asist-just-archivo').value = '';
    document.getElementById('asist-just-descripcion').value = reg.comentario || '';

    modal.classList.add('active');
}

async function asistGuardarJustificante() {
    const btn = document.getElementById('btn-guardar-justificante');
    const idEstudiante = document.getElementById('asist-just-id-estudiante').value;
    const tipo = document.getElementById('asist-just-tipo').value;
    const fechaDocumento = document.getElementById('asist-just-fecha');
    fechaDocumento.max = asistFechaLocalActual();
    const fechaDoc = fechaDocumento.value;
    const descripcion = document.getElementById('asist-just-descripcion').value.trim();
    const archivoInput = document.getElementById('asist-just-archivo');
    const archivo = archivoInput.files?.[0] || null;
    const reg = ASIST_REGISTROS[idEstudiante] || {};

    if (!ASIST_ID_SESION) {
        asistNotificar('Debes guardar la asistencia antes de crear justificantes.', 'warning');
        return;
    }

    if (fechaDoc && fechaDoc > asistFechaLocalActual()) {
        asistNotificar('La fecha del documento no puede ser futura.', 'error');
        fechaDocumento.focus();
        return;
    }

    if (!archivo) {
        asistNotificar('Debes adjuntar un archivo PDF.', 'warning');
        return;
    }

    if (!archivo.name.toLowerCase().endsWith('.pdf')) {
        asistNotificar('Solo se permiten archivos en formato PDF.', 'error');
        return;
    }

    const formData = new FormData();
    if (reg.id_asistencia) formData.append('id_asistencia', String(reg.id_asistencia));
    formData.append('id_estudiante', String(idEstudiante));
    formData.append('id_asistencia_diaria', String(ASIST_ID_SESION));
    formData.append('periodo_id', String(ASIST_FILTROS.periodo));
    formData.append('tipo_justificante', tipo);
    formData.append('fecha_documento', fechaDoc || '');
    formData.append('descripcion', descripcion);
    formData.append('archivo', archivo);

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

    try {
        const response = await fetch('/api/asistencias/justificante', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'No se pudo guardar el justificante');
        }

        reg.id_asistencia = data.id_asistencia || reg.id_asistencia;
        reg.justificante_id = data.id_justificante;
        reg.justificante_aprobado = !!data.aprobado;
        reg.asistio = 'ausente';
        ASIST_REGISTROS[idEstudiante] = reg;

        asistNotificar('Justificante guardado correctamente', 'success');
        asistCerrarModalJustificante();

        if (ASIST_VISTA === 'registro') {
            _asistRenderTabla();
        }
        if (ASIST_VISTA === 'justificaciones') {
            asistCargarJustificaciones();
        }
    } catch (error) {
        asistNotificar(error.message || 'Error al guardar justificante', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Guardar';
    }
}
