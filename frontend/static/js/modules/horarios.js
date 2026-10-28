// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO HORARIOS
// Gestión de horarios: grilla semanal editable con filtros por grado/grupo/docente
// ════════════════════════════════════════════════════════════════════════════════

// ── Estado del módulo ───────────────────────────────────────────────────────
let HORARIO_FILTROS = { grado_id: null, grupo_id: null, docente_id: null };
let HORARIO_DATOS   = [];           // bloques cargados
let HORARIO_GRUPOS  = [];           // grupos del grado seleccionado
let HORARIO_ASIGNACIONES_GRUPO = []; // asignaciones activas del grupo
let HORARIO_DOCENTES_MASTER = [];   // lista completa de docentes (cache)

// Tengo que cambiar los tres de rango de hora para poner en la grilita
const DIAS_SEMANA  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HORAS_GRILLA = [];
for (let h = 7; h <= 13; h++) {
    HORAS_GRILLA.push(`${String(h).padStart(2,'0')}:00`);
}

// Paleta de colores para materias (tonos claros y distintos entre sí)
const COLORES_MATERIAS = [
    'rgba(255, 205, 205, 0.42)',  // Rojo pastel
    'rgba(255, 226, 190, 0.42)',  // Naranja pastel
    'rgba(255, 246, 193, 0.42)',  // Amarillo pastel
    'rgba(209, 236, 209, 0.42)',  // Verde pastel
    'rgba(208, 228, 255, 0.42)',  // Azul pastel
    'rgba(231, 214, 244, 0.42)',  // Lila pastel
    'rgba(255, 214, 232, 0.42)',  // Rosa pastel
    'rgba(214, 240, 240, 0.42)',  // Turquesa pastel
    'rgba(233, 233, 205, 0.42)',  // Oliva claro
    'rgba(199, 226, 255, 0.42)',  // Azul cielo pastel
    'rgba(255, 236, 174, 0.42)',  // Miel suave
    'rgba(255, 202, 202, 0.42)',  // Salmón pastel
    'rgba(214, 245, 255, 0.42)',  // Celeste hielo
    'rgba(224, 210, 245, 0.42)',  // Violeta suave
    'rgba(255, 220, 205, 0.42)'   // Durazno suave
];
let _colorIdx = 0;
const _colorMap = {};
function getColorMateria(idMateria) {
    if (!_colorMap[idMateria]) {
        _colorMap[idMateria] = COLORES_MATERIAS[_colorIdx % COLORES_MATERIAS.length];
        _colorIdx++;
    }
    return _colorMap[idMateria];
}

// Convertir hora "HH:MM" a minutos desde medianoche
function timeToMinutes(t) {
    if (!t || typeof t !== 'string') return 0;
    const parts = t.substring(0,5).split(':');
    const hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    return hh * 60 + mm;
}

// (Se eliminó la función de carga de grupos por docente — la selección de grupo fue retirada)

// Calcular minutos programados para una materia en un grupo (excluir idHorario opcional)
async function getScheduledMinutesForMateria(materiaId, grupoId, excludeHorarioId = null) {
    let horarios = [];
    try {
        if (grupoId === null || typeof grupoId === 'undefined') {
            const res = await API.request(`/api/horarios`);
            horarios = res.horarios || [];
        } else if (String(grupoId) === String(HORARIO_FILTROS.grupo_id)) {
            horarios = HORARIO_DATOS.slice();
        } else {
            const res = await API.request(`/api/horarios?grupo_id=${grupoId}`);
            horarios = res.horarios || [];
        }
    } catch (e) {
        return 0;
    }
    const relevantes = horarios.filter(h => String(h.id_materia) === String(materiaId) && String(h.id_horario) !== String(excludeHorarioId));
    const minutos = relevantes.reduce((s, r) => {
        const mi = timeToMinutes((r.hora_inicio || '').substring(0,5));
        const mf = timeToMinutes((r.hora_fin || '').substring(0,5));
        return s + Math.max(0, mf - mi);
    }, 0);
    return minutos;
}
// ── Render principal ────────────────────────────────────────────────────────

async function renderHorarios() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const [gradosRes, docentesRes] = await Promise.all([
            API.getGrados(),
            API.getDocentes()
        ]);
        const grados   = gradosRes.grados   || [];
        const docentes = docentesRes.docentes || [];
        HORARIO_DOCENTES_MASTER = docentes.slice();

        const opGrados = grados.map(g =>
            `<option value="${g.id_grado}" ${g.id_grado == HORARIO_FILTROS.grado_id ? 'selected' : ''}>${g.nombre_grado}</option>`
        ).join('');

        const opDocentes = docentes.map(d =>
            `<option value="${d.id_usuario}" ${d.id_usuario == HORARIO_FILTROS.docente_id ? 'selected' : ''}>${d.apellido} ${d.nombre}</option>`
        ).join('');

        const htmlRes = await fetch('/templates/modules html/horarios.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de horarios');
        content.innerHTML = await htmlRes.text();

        document.getElementById('filtro-horario-grado').innerHTML += opGrados;
        document.getElementById('filtro-horario-docente').innerHTML += opDocentes;

        // Si ya había filtros seleccionados, recargar
        if (HORARIO_FILTROS.grado_id) {
            await onFiltroGradoChange(true);
        }
    } catch (error) {
        content.innerHTML = Helpers.error('No se pudieron cargar los datos de horarios.');
        console.error(error);
    }
}

function actualizarSelectDocentes() {
    const sel = document.getElementById('filtro-horario-docente');
    if (!sel) return;

    // Si hay un grupo seleccionado, mostrar solo docentes asignados a ese grupo
    if (HORARIO_FILTROS.grupo_id && HORARIO_ASIGNACIONES_GRUPO && HORARIO_ASIGNACIONES_GRUPO.length) {
        const mapa = {};
        HORARIO_ASIGNACIONES_GRUPO.forEach(a => {
            if (a.id_usuario) mapa[String(a.id_usuario)] = (a.docente_apellido || '') + ' ' + (a.docente_nombre || '');
        });
        const opciones = ['<option value="">— Todos los docentes —</option>'];
        Object.keys(mapa).forEach(id => {
            const nombre = mapa[id];
            const selAttr = (String(id) === String(HORARIO_FILTROS.docente_id)) ? ' selected' : '';
            opciones.push(`<option value="${id}"${selAttr}>${nombre}</option>`);
        });
        sel.innerHTML = opciones.join('');
        return;
    }

    // Si no hay grupo, restaurar lista completa
    const opcionesMaster = ['<option value="">— Todos los docentes —</option>'].concat(
        HORARIO_DOCENTES_MASTER.map(d => `<option value="${d.id_usuario}" ${d.id_usuario == HORARIO_FILTROS.docente_id ? 'selected' : ''}>${d.apellido} ${d.nombre}</option>`)
    );
    sel.innerHTML = opcionesMaster.join('');
}

// ── Eventos de filtros ──────────────────────────────────────────────────────

async function onFiltroGradoChange(preserveGrupo = false) {
    const gradoId = document.getElementById('filtro-horario-grado').value;
    const grupoSelect = document.getElementById('filtro-horario-grupo');

    HORARIO_FILTROS.grado_id = gradoId || null;
    if (!preserveGrupo) HORARIO_FILTROS.grupo_id = null;

    if (!gradoId) {
        grupoSelect.innerHTML = '<option value="">— Primero selecciona grado —</option>';
        grupoSelect.disabled = true;
        renderGrillaVacia();
        return;
    }

    try {
        const res = await API.request(`/api/grados/${gradoId}/grupos`);
        HORARIO_GRUPOS = res.grupos || [];
        grupoSelect.disabled = false;
        grupoSelect.innerHTML = '<option value="">— Seleccionar grupo —</option>' +
            HORARIO_GRUPOS.map(g =>
                `<option value="${g.id_grupo}" ${g.id_grupo == HORARIO_FILTROS.grupo_id ? 'selected' : ''}>${g.codigo_grupo}</option>`
            ).join('');
        // Restaurar/actualizar select de docentes (lista completa por defecto)
        actualizarSelectDocentes();

        if (HORARIO_FILTROS.grupo_id) {
            await cargarGrillaHorario();
        } else {
            renderGrillaVacia();
        }
    } catch (e) {
        console.error(e);
        grupoSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function onFiltroGrupoChange() {
    HORARIO_FILTROS.grupo_id = document.getElementById('filtro-horario-grupo').value || null;
    if (HORARIO_FILTROS.grupo_id) {
        await cargarGrillaHorario();
    } else {
        renderGrillaVacia();
    }
}

async function onFiltroDocenteChange() {
    HORARIO_FILTROS.docente_id = document.getElementById('filtro-horario-docente').value || null;
    if (HORARIO_FILTROS.grupo_id) {
        await cargarGrillaHorario();
    }
}

function renderGrillaVacia() {
    document.getElementById('horario-grilla-container').innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--cafe-claro);">
            <i class="fas fa-calendar-alt" style="font-size:3rem;margin-bottom:1rem;display:block;opacity:.4;"></i>
            <p>Selecciona un <strong>grado</strong> y un <strong>grupo</strong> para ver y editar su horario.</p>
        </div>
    `;
}

// ── Cargar y renderizar la grilla ───────────────────────────────────────────

async function cargarGrillaHorario() {
    const container = document.getElementById('horario-grilla-container');
    container.innerHTML = Helpers.loading();

    try {
        const params = new URLSearchParams();
        if (HORARIO_FILTROS.grupo_id)   params.set('grupo_id', HORARIO_FILTROS.grupo_id);
        if (HORARIO_FILTROS.docente_id) params.set('docente_id', HORARIO_FILTROS.docente_id);

        const res = await API.request(`/api/horarios?${params.toString()}`);
        HORARIO_DATOS = res.horarios || [];

        // Cargar asignaciones disponibles del grupo
        const asigRes = await API.request(`/api/horarios/asignaciones-grupo/${HORARIO_FILTROS.grupo_id}`);
        HORARIO_ASIGNACIONES_GRUPO = asigRes.asignaciones || [];

        // Actualizar el select de docentes para mostrar solo docentes asignados
        actualizarSelectDocentes();

        renderGrilla();
    } catch (e) {
        container.innerHTML = Helpers.error('Error al cargar horario.');
        console.error(e);
    }
}

function renderGrilla() {
    const container = document.getElementById('horario-grilla-container');
    const grupoSel  = HORARIO_GRUPOS.find(g => String(g.id_grupo) === String(HORARIO_FILTROS.grupo_id));
    const grupoNom  = grupoSel ? grupoSel.codigo_grupo : '';

    // Construir encabezado
    let html = `
        <div class="horario-header-info" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem;">
            <span style="color:var(--cafe);font-weight:600;">
                <i class="fas fa-calendar-week"></i> Horario del grupo ${grupoNom}
            </span>
            <span style="font-size:.85rem;color:var(--cafe-claro);">
                ${HORARIO_DATOS.length} bloque(s) registrado(s)
            </span>
        </div>
        <div class="horario-scroll" style="overflow-x:auto;">
        <table class="horario-grid">
            <thead>
                <tr>
                    <th class="hora-col">Hora</th>
                    ${DIAS_SEMANA.map(d => `<th>${d}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    //  agrupar bloques por día y hora para facilitar el renderizado de celdas ocupadas y unir lo bloques que caen dentro del rowspan de un grupo existente.
    const gruposPorDia = {};
    DIAS_SEMANA.forEach(d => gruposPorDia[d] = []);

    // Ordenar bloques por hora inicio para procesar correctamente
    const bloquesOrdenados = HORARIO_DATOS.slice().sort((a,b) => timeToMinutes(a.hora_inicio) - timeToMinutes(b.hora_inicio));
    bloquesOrdenados.forEach(b => {
        const dia = b.dia_semana;
        if (!gruposPorDia[dia]) gruposPorDia[dia] = [];
        const biMin = timeToMinutes(b.hora_inicio.substring(0,5));
        const bfMin = timeToMinutes(b.hora_fin.substring(0,5));
        const startRowMin = Math.floor(biMin / 60) * 60;

        // Buscar un grupo existente que abarque la fila de inicio
        let g = gruposPorDia[dia].find(g => g.startRowMin <= startRowMin && g.endMin > startRowMin);
        if (!g) {
            g = { startRowMin: startRowMin, endMin: bfMin, blocks: [b] };
            gruposPorDia[dia].push(g);
        } else {
            g.blocks.push(b);
            if (bfMin > g.endMin) g.endMin = bfMin;
        }
    });

    HORAS_GRILLA.forEach(hora => {
        const horaNum  = parseInt(hora.split(':')[0]);
        const horaFin  = `${String(horaNum + 1).padStart(2,'0')}:00`;

        html += `<tr>`;
        html += `<td class="hora-col"><strong>${hora}</strong><br><span style="font-size:.75rem;color:var(--cafe-claro)">${horaFin}</span></td>`;

        DIAS_SEMANA.forEach(dia => {
            const horaMin = timeToMinutes(hora);
            const grupos = gruposPorDia[dia] || [];

            // ¿Hay un grupo que empiece exactamente en esta fila?
            const grupoInicio = grupos.find(g => g.startRowMin === horaMin);
            if (grupoInicio) {
                const span = Math.max(1, Math.ceil((grupoInicio.endMin - grupoInicio.startRowMin) / 60));
                html += `<td class="horario-celda ocupada" rowspan="${span}" style="background:transparent;padding:0;">`;
                // Renderizar cada bloque dentro del mismo td, apilados
                grupoInicio.blocks.forEach(b => {
                    const color = getColorMateria(b.id_materia);
                    html += `<div class="horario-bloque" style="background:${color};margin:6px;">
                                <strong class="horario-materia">${b.nombre_materia}</strong>
                                <span class="horario-docente">${b.docente_nombre} ${b.docente_apellido}</span>
                                <span class="horario-hora">${b.hora_inicio.substring(0,5)} - ${b.hora_fin.substring(0,5)}</span>
                                ${b.aula ? `<span class="horario-aula"><i class="fas fa-door-open"></i> ${b.aula}</span>` : ''}
                                <div class="horario-acciones">
                                    <button onclick="abrirModalEditarHorario(${b.id_horario})" title="Editar"><i class="fas fa-edit"></i></button>
                                    <button onclick="eliminarBloqueHorario(${b.id_horario})" title="Eliminar"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>`;
                });
                html += `</td>`;
                return; // continuar al siguiente día
            }

            // Si no inicia aquí, comprobar si la fila está cubierta por un grupo anterior
            const cubierto = grupos.some(g => g.startRowMin < horaMin && g.endMin > horaMin);
            if (cubierto) {
                // No agregar celda; queda cubierta por el rowspan de un grupo anterior
                return;
            }

            // Celda vacía — botón para agregar
            html += `<td class="horario-celda vacia" onclick="abrirModalCrearHorario('${dia}','${hora}','${horaFin}')">
                    <button class="horario-btn-agregar" title="Agregar clase">
                        <i class="fas fa-plus"></i>
                    </button>
                </td>`;
        });
        html += `</tr>`;
    });

    html += `</tbody></table></div>`;

    // Leyenda
    if (HORARIO_DATOS.length > 0) {
        const materiasUnicas = [...new Map(HORARIO_DATOS.map(b => [b.id_materia, b.nombre_materia])).entries()];
        html += `<div class="horario-leyenda" style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:.5rem;">`;
        materiasUnicas.forEach(([id, nombre]) => {
            html += `<span class="badge" style="background:${getColorMateria(id)};color:#475569;padding:.25rem .75rem;border-radius:12px;font-size:.8rem;">
                ${nombre}
            </span>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

// ── Modal: Crear bloque ─────────────────────────────────────────────────────

function abrirModalCrearHorario(dia, horaInicio, horaFin) {
    if (!HORARIO_FILTROS.grupo_id) {
        mostrarAlerta('Selecciona un grupo primero', 'error');
        return;
    }
    if (HORARIO_ASIGNACIONES_GRUPO.length === 0) {
        mostrarAlerta('No hay asignaciones de docente activas para este grupo. Asigna materias en el módulo Materias o Docentes.', 'error');
        return;
    }

    const opAsignaciones = HORARIO_ASIGNACIONES_GRUPO.map(a =>
        `<option value="${a.id_asignacion}" data-docente="${a.id_usuario || a.id_docente || ''}" data-materia="${a.id_materia || a.materia_id || ''}">${a.nombre_materia} — ${a.docente_nombre} ${a.docente_apellido}</option>`
    ).join('');

    // Crear un modal dinámico
    let overlay = document.getElementById('modal-horario-bloque');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-horario-bloque';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="modal" style="max-width:500px;">
            <div class="modal-header">
                <h3><i class="fas fa-plus-circle"></i> Agregar Clase</h3>
                <button class="modal-close" onclick="cerrarModal('modal-horario-bloque')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="form-crear-horario">
                    <div class="form-group">
                        <label><i class="fas fa-book"></i> Materia y Docente</label>
                        <select id="horario-asignacion" required>${opAsignaciones}</select>
                    </div>
                    <!-- Grupo (del docente) removido — usamos el grupo filtrado por defecto -->
                    <div class="form-row">
                        <div class="form-group">
                            <label><i class="fas fa-calendar-day"></i> Día</label>
                            <select id="horario-dia" required>
                                ${DIAS_SEMANA.map(d => `<option value="${d}" ${d === dia ? 'selected' : ''}>${d}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label><i class="fas fa-clock"></i> Hora Inicio</label>
                            <input type="time" id="horario-hora-inicio" value="${horaInicio}" required>
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-clock"></i> Hora Fin</label>
                            <input type="time" id="horario-hora-fin" value="${horaFin}" required>
                        </div>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-door-open"></i> Aula (obligatoria)</label>
                        <input type="text" id="horario-aula" placeholder="Ej: Salón 201">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-sticky-note"></i> Observaciones (opcional)</label>
                        <input type="text" id="horario-observaciones" placeholder="Notas adicionales">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-rojo" onclick="cerrarModal('modal-horario-bloque')">
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
    overlay.classList.add('active');
    overlay.style.display = 'flex';

    // Se removió la funcionalidad de selección de grupo por docente.

    document.getElementById('form-crear-horario').addEventListener('submit', async (e) => {
        e.preventDefault();
        await guardarBloqueHorario();
    });
}

async function guardarBloqueHorario() {
    const data = {
        id_asignacion:  document.getElementById('horario-asignacion').value,
        id_grupo:       HORARIO_FILTROS.grupo_id,
        dia_semana:     document.getElementById('horario-dia').value,
        hora_inicio:    document.getElementById('horario-hora-inicio').value,
        hora_fin:       document.getElementById('horario-hora-fin').value,
        aula:           document.getElementById('horario-aula').value,
        observaciones:  document.getElementById('horario-observaciones').value
    };

    if (data.hora_inicio >= data.hora_fin) {
        mostrarAlerta('La hora de inicio debe ser anterior a la hora de fin', 'error');
        return;
    }

    try {
        // Validación: no exceder intensidad horaria semanal de la materia
        const selOpt = document.getElementById('horario-asignacion').options[document.getElementById('horario-asignacion').selectedIndex];
        const materiaId = selOpt?.dataset?.materia;
        if (materiaId) {
            const matRes = await API.request(`/api/materias/${materiaId}`);
            const intensidad = (matRes.materia && matRes.materia.intensidad_horaria) || (matRes.intensidad_horaria) || 0;
            // Validación global: sumar todas las horas programadas de la materia en el sistema
            const minutosExistentes = await getScheduledMinutesForMateria(materiaId, null);
            const nuevosMin = timeToMinutes(data.hora_fin) - timeToMinutes(data.hora_inicio);
            if ((minutosExistentes + nuevosMin) > (intensidad * 60)) {
                mostrarAlerta('No se puede crear: la materia excede su intensidad horaria semanal (alcance global).', 'error');
                return;
            }
        }
        await API.request('/api/horarios', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        mostrarAlerta('Bloque de horario creado', 'success');
        cerrarModal('modal-horario-bloque');
        await cargarGrillaHorario();
    } catch (error) {
        mostrarAlerta(error.message || 'Error al crear el bloque', 'error');
    }
}

// ── Modal: Editar bloque ────────────────────────────────────────────────────

async function abrirModalEditarHorario(idHorario) {
    try {
        const res = await API.request(`/api/horarios/${idHorario}`);
        const h = res.horario;

        // Asegurar que tenemos asignaciones cargadas
        if (HORARIO_ASIGNACIONES_GRUPO.length === 0 && HORARIO_FILTROS.grupo_id) {
            const asigRes = await API.request(`/api/horarios/asignaciones-grupo/${HORARIO_FILTROS.grupo_id}`);
            HORARIO_ASIGNACIONES_GRUPO = asigRes.asignaciones || [];
        }

        const opAsignaciones = HORARIO_ASIGNACIONES_GRUPO.map(a =>
            `<option value="${a.id_asignacion}" data-docente="${a.id_usuario || a.id_docente || ''}" data-materia="${a.id_materia || a.materia_id || ''}" ${a.id_asignacion == h.id_asignacion ? 'selected' : ''}>
                ${a.nombre_materia} — ${a.docente_nombre} ${a.docente_apellido}
            </option>`
        ).join('');

        const hi = typeof h.hora_inicio === 'string' ? h.hora_inicio.substring(0, 5) : '';
        const hf = typeof h.hora_fin === 'string' ? h.hora_fin.substring(0, 5) : '';

        let overlay = document.getElementById('modal-horario-bloque');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'modal-horario-bloque';
            overlay.className = 'modal-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = `
            <div class="modal" style="max-width:500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Editar Bloque</h3>
                    <button class="modal-close" onclick="cerrarModal('modal-horario-bloque')">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="form-editar-horario">
                        <input type="hidden" id="editar-horario-id" value="${h.id_horario}">
                        <div class="form-group">
                            <label><i class="fas fa-book"></i> Materia y Docente</label>
                            <select id="horario-asignacion" required>${opAsignaciones}</select>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label><i class="fas fa-calendar-day"></i> Día</label>
                                <select id="horario-dia" required>
                                    ${DIAS_SEMANA.map(d => `<option value="${d}" ${d === h.dia_semana ? 'selected' : ''}>${d}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <div class="form-row">
                            <div class="form-group">
                                <label><i class="fas fa-clock"></i> Hora Inicio</label>
                                <input type="time" id="horario-hora-inicio" value="${hi}" required>
                            </div>
                            <div class="form-group">
                                <label><i class="fas fa-clock"></i> Hora Fin</label>
                                <input type="time" id="horario-hora-fin" value="${hf}" required>
                            </div>
                        </div>
                        <!-- Grupo (del docente) removido — usamos el grupo filtrado por defecto -->
                        <div class="form-group">
                            <label><i class="fas fa-door-open"></i> Aula</label>
                            <input type="text" id="horario-aula" value="${h.aula || ''}">
                        </div>
                        <div class="form-group">
                            <label><i class="fas fa-sticky-note"></i> Observaciones</label>
                            <input type="text" id="horario-observaciones" value="${h.observaciones || ''}">
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-rojo" onclick="cerrarModal('modal-horario-bloque')">
                                <i class="fas fa-times"></i> Cancelar
                            </button>
                            <button type="submit" class="btn btn-verde">
                                <i class="fas fa-save"></i> Actualizar
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        overlay.classList.add('active');
        overlay.style.display = 'flex';

        // Selector de grupos por docente removido — no se requiere selección adicional

        document.getElementById('form-editar-horario').addEventListener('submit', async (e) => {
            e.preventDefault();
            await actualizarBloqueHorario();
        });

    } catch (error) {
        mostrarAlerta(error.message || 'Error al cargar el bloque', 'error');
    }
}

async function actualizarBloqueHorario() {
    const id = document.getElementById('editar-horario-id').value;
    const data = {
        id_asignacion:  document.getElementById('horario-asignacion').value,
        id_grupo:       HORARIO_FILTROS.grupo_id,
        dia_semana:     document.getElementById('horario-dia').value,
        hora_inicio:    document.getElementById('horario-hora-inicio').value,
        hora_fin:       document.getElementById('horario-hora-fin').value,
        aula:           document.getElementById('horario-aula').value,
        observaciones:  document.getElementById('horario-observaciones').value
    };

    if (data.hora_inicio >= data.hora_fin) {
        mostrarAlerta('La hora de inicio debe ser anterior a la hora de fin', 'error');
        return;
    }

    try {
        // Validación de intensidad horaria (excluir el bloque que se está editando)
        const selOpt = document.getElementById('horario-asignacion').options[document.getElementById('horario-asignacion').selectedIndex];
        const materiaId = selOpt?.dataset?.materia;
        if (materiaId) {
            const matRes = await API.request(`/api/materias/${materiaId}`);
            const intensidad = (matRes.materia && matRes.materia.intensidad_horaria) || (matRes.intensidad_horaria) || 0;
            // Validación global: sumar todas las horas programadas de la materia (excluye el bloque actual)
            const minutosExistentes = await getScheduledMinutesForMateria(materiaId, null, id);
            const nuevosMin = timeToMinutes(data.hora_fin) - timeToMinutes(data.hora_inicio);
            if ((minutosExistentes + nuevosMin) > (intensidad * 60)) {
                mostrarAlerta('No se puede actualizar: la materia excede su intensidad horaria semanal (alcance global).', 'error');
                return;
            }
        }
        await API.request(`/api/horarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        mostrarAlerta('Bloque actualizado', 'success');
        cerrarModal('modal-horario-bloque');
        await cargarGrillaHorario();
    } catch (error) {
        mostrarAlerta(error.message || 'Error al actualizar', 'error');
    }
}

// ── Eliminar bloque ─────────────────────────────────────────────────────────

async function eliminarBloqueHorario(idHorario) {
    if (!confirm('¿Eliminar este bloque de horario?')) return;
    try {
        await API.request(`/api/horarios/${idHorario}`, { method: 'DELETE' });
        mostrarAlerta('Bloque eliminado', 'success');
        await cargarGrillaHorario();
    } catch (error) {
        mostrarAlerta(error.message || 'Error al eliminar', 'error');
    }
}
