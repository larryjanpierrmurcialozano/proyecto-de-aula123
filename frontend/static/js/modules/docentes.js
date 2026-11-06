// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO DOCENTES
// Gestión de docentes y asignaciones de materias
// ════════════════════════════════════════════════════════════════════════════════

let ASIGNACIONES_DOCENTE_TEMP = [];
let DOCENTE_SELECCIONADO = null;
let GRUPOS_DOCENTE_DISPONIBLES = [];

async function renderDocentes() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const data = await API.getDocentes();
        const docentes = data.docentes || [];

        const filas = docentes.length ? docentes.map(d => {
            const materias = d.materias ? d.materias.split(',').map(m => `<span class="badge badge-cafe">${m.trim()}</span>`).join(' ') : '<span class="badge badge-cafe">Sin asignaciones</span>';
            return `
                <tr>
                    <td>${d.id_usuario}</td>
                    <td>${d.documento || '-'}</td>
                    <td>${Helpers.celdaUsuario(d.nombre, d.apellido)}</td>
                    <td>${d.correo || '-'}</td>
                    <td>${materias}</td>
                    <td>${Helpers.badgeEstado(d.is_activo)}</td>
                    <td>
                        <div class="acciones-btns">
                            <button class="btn-accion btn-accion-verde" title="Editar asignaciones" onclick="abrirModalDocente(${d.id_usuario})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-accion ${d.is_activo ? 'btn-accion-rojo' : 'btn-accion-verde'}"
                                title="${d.is_activo ? 'Desactivar usuario' : 'Activar usuario'}"
                                aria-label="${d.is_activo ? 'Desactivar usuario' : 'Activar usuario'}"
                                onclick="cambiarEstadoDocente(${d.id_usuario}, ${!d.is_activo})">
                                <i class="fas ${d.is_activo ? 'fa-user-slash' : 'fa-user-check'}"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('') : '<tr><td colspan="7">' + Helpers.sinDatos('No hay docentes registrados') + '</td></tr>';

        const htmlRes = await fetch('/templates/modules html/docentes.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de docentes');
        content.innerHTML = await htmlRes.text();

        const tbody = document.getElementById('tbody-docentes');
        tbody.innerHTML = filas;

    } catch (error) {
        content.innerHTML = Helpers.error('No se pudieron cargar los docentes.');
    }
}

async function cambiarEstadoDocente(docenteId, nuevoEstado) {
    const accion = nuevoEstado ? 'activar' : 'desactivar';
    if (!confirm(`¿Deseas ${accion} esta cuenta de docente?`)) return;
    try {
        await API.actualizarEstadoDocente(docenteId, nuevoEstado);
        mostrarAlerta(`Cuenta del docente ${nuevoEstado ? 'activada' : 'desactivada'}`, 'success');
        await renderDocentes();
    } catch (error) {
        mostrarAlerta(error.message || 'No se pudo cambiar el estado del docente', 'error');
    }
}

async function abrirModalDocente(docenteId = null) {
    const overlay = document.getElementById('modal-asignar-docente');
    const body = document.getElementById('asignar-docente-body');
    overlay.classList.add('active');
    body.innerHTML = Helpers.loading();

    try {
        const [docentesRes, gradosRes, materiasRes, gruposRes] = await Promise.all([
            API.getDocentesDisponibles(),
            API.getGrados(),
            API.getMaterias(),
            API.getGrupos()
        ]);

        const docentes = docentesRes.docentes || [];
        const grados = gradosRes.grados || [];
        const materias = materiasRes.materias || [];
        GRUPOS_DOCENTE_DISPONIBLES = gruposRes.grupos || [];

        if (!docentes.length) {
            body.innerHTML = `
                <div style="text-align:center; padding:2rem; color: var(--cafe);">
                    <i class="fas fa-exclamation-circle" style="font-size:2rem; margin-bottom:0.5rem;"></i>
                    <p>No hay docentes activos con rol Profesor disponibles para asignar.</p>
                    <p style="color: var(--cafe-claro); font-size:0.9rem;">Crea un usuario con rol Profesor en el módulo Usuarios.</p>
                    <button class="btn btn-cafe" onclick="cerrarModal('modal-asignar-docente')">Cerrar</button>
                </div>
            `;
            return;
        }

        ASIGNACIONES_DOCENTE_TEMP = [];
        const docenteEnLista = docenteId && docentes.find(d => String(d.id_usuario) === String(docenteId));
        DOCENTE_SELECCIONADO = docenteEnLista ? docenteEnLista.id_usuario : docentes[0].id_usuario;

        const opcionesDocentes = docentes.map(d => {
            const seleccionado = String(d.id_usuario) === String(DOCENTE_SELECCIONADO) ? 'selected' : '';
            return `<option value="${d.id_usuario}" ${seleccionado}>${d.apellido} ${d.nombre} - ${d.documento}</option>`;
        }).join('');
        const opcionesGrados = grados.map(g => `<option value="${g.id_grado}">${g.nombre_grado}</option>`).join('');
        const opcionesMaterias = materias.map(m => `<option value="${m.id_materia}">${m.nombre_materia}</option>`).join('');
        const gruposIniciales = GRUPOS_DOCENTE_DISPONIBLES.filter(g => String(g.id_grado) === String(grados[0]?.id_grado));
        const opcionesGrupos = gruposIniciales.map(g => `<option value="${g.id_grupo}">${g.codigo_grupo}</option>`).join('');

        body.innerHTML = `
            <form id="form-asignar-docente">
                <div class="asignar-docente-resumen">
                    <div class="asignar-docente-icono">
                        <i class="fas fa-chalkboard-teacher"></i>
                    </div>
                    <div>
                        <h3>${docenteEnLista ? `${docenteEnLista.apellido} ${docenteEnLista.nombre}` : 'Selecciona un docente'}</h3>
                        <p>Asigna materias a los grupos de este docente.</p>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-user"></i> Seleccionar Docente</label>
                    <select id="select-docente" required>${opcionesDocentes}</select>
                </div>
                <div class="asignar-docente-grid">
                    <div class="form-group">
                        <label><i class="fas fa-layer-group"></i> Grado</label>
                        <select id="select-grado">${opcionesGrados}</select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-users"></i> Grupo</label>
                        <select id="select-grupo" required>${opcionesGrupos}</select>
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-book"></i> Materia</label>
                        <select id="select-materia">${opcionesMaterias}</select>
                    </div>
                </div>
                <div class="modal-footer-inline" style="display:flex; visibility:visible; min-height:42px;">
                    <button type="button" class="btn btn-cafe btn-agregar-asignacion" onclick="agregarAsignacionTemp()">
                        <i class="fas fa-plus"></i> Agregar asignación
                    </button>
                </div>
                <div class="asignaciones-temp-header">
                    <h4><i class="fas fa-list"></i> Asignaciones actuales</h4>
                    <span>Quita las asignaciones que ya no correspondan y guarda los cambios</span>
                </div>
                <div id="lista-asignaciones-temp" class="asignaciones-temp-list">
                    ${Helpers.sinDatos('Aún no agregas asignaciones')}
                </div>
            </form>
            <div class="modal-footer">
                <button type="button" class="btn btn-rojo" onclick="cerrarModal('modal-asignar-docente')">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button type="submit" form="form-asignar-docente" class="btn btn-verde">
                    <i class="fas fa-save"></i> Guardar
                </button>
            </div>
        `;

        document.getElementById('select-docente').addEventListener('change', (e) => {
            DOCENTE_SELECCIONADO = e.target.value;
            document.getElementById('select-grado')?.removeAttribute('data-seleccion-modificada');
            cargarAsignacionesDocenteSeleccionado();
        });

        document.getElementById('select-grado').addEventListener('change', () => {
            marcarSeleccionAsignacionModificada();
            actualizarGruposDocente();
        });
        document.getElementById('select-grupo').addEventListener('change', marcarSeleccionAsignacionModificada);
        document.getElementById('select-materia').addEventListener('change', marcarSeleccionAsignacionModificada);

        document.getElementById('form-asignar-docente').addEventListener('submit', guardarAsignacionesDocente);

        await cargarAsignacionesDocenteSeleccionado();

    } catch (error) {
        console.error('Error cargando modal de docente', error);
        body.innerHTML = Helpers.error(error.message || 'No se pudo cargar la información de docentes.');
    }
}

async function cargarAsignacionesDocenteSeleccionado() {
    if (!DOCENTE_SELECCIONADO) {
        ASIGNACIONES_DOCENTE_TEMP = [];
        renderAsignacionesTemp();
        return;
    }
    try {
        const res = await API.getDocenteAsignaciones(DOCENTE_SELECCIONADO);
        ASIGNACIONES_DOCENTE_TEMP = (res.asignaciones || []).filter(a => a.estado === 'Activa').map(a => ({
            id_grado: Number(a.id_grado),
            nombre_grado: a.nombre_grado,
            id_grupo: Number(a.id_grupo),
            codigo_grupo: a.codigo_grupo,
            id_materia: Number(a.id_materia),
            nombre_materia: a.nombre_materia,
            estado: 'Activa'
        }));
        renderAsignacionesTemp();
    } catch (error) {
        console.error('Error cargando asignaciones del docente', error);
        mostrarAlerta('No se pudieron cargar las asignaciones existentes', 'error');
        ASIGNACIONES_DOCENTE_TEMP = [];
        renderAsignacionesTemp();
    }
}

function marcarSeleccionAsignacionModificada() {
    document.getElementById('select-grado')?.setAttribute('data-seleccion-modificada', 'true');
}

function agregarAsignacionTemp() {
    const nuevaAsignacion = obtenerAsignacionSeleccionada();
    if (!nuevaAsignacion) {
        mostrarAlerta('Selecciona grado, grupo y materia', 'error');
        return false;
    }

    const existe = ASIGNACIONES_DOCENTE_TEMP.some(a =>
        a.id_grupo === nuevaAsignacion.id_grupo && a.id_materia === nuevaAsignacion.id_materia
    );
    if (existe) {
        mostrarAlerta('Ya agregaste esa combinación grupo/materia', 'info');
        return false;
    }

    ASIGNACIONES_DOCENTE_TEMP.push(nuevaAsignacion);
    renderAsignacionesTemp();
    return true;
}

function obtenerAsignacionSeleccionada() {
    const gradoSelect = document.getElementById('select-grado');
    const grupoSelect = document.getElementById('select-grupo');
    const materiaSelect = document.getElementById('select-materia');
    if (!gradoSelect || !grupoSelect || !materiaSelect) return null;

    const grado = Number(gradoSelect.value);
    const grupo = Number(grupoSelect.value);
    const materia = Number(materiaSelect.value);

    if (!grado || !grupo || !materia) {
        return null;
    }

    return {
        id_grado: grado,
        nombre_grado: gradoSelect.options[gradoSelect.selectedIndex].text,
        id_grupo: grupo,
        codigo_grupo: grupoSelect.options[grupoSelect.selectedIndex].text,
        id_materia: materia,
        nombre_materia: materiaSelect.options[materiaSelect.selectedIndex].text,
        estado: 'Activa'
    };
}

function renderAsignacionesTemp() {
    const cont = document.getElementById('lista-asignaciones-temp');
    if (!ASIGNACIONES_DOCENTE_TEMP.length) {
        cont.innerHTML = Helpers.sinDatos('Aún no agregas asignaciones');
        return;
    }
    cont.innerHTML = ASIGNACIONES_DOCENTE_TEMP.map((a, idx) => `
        <div class="asignacion-temp-card">
            <div class="asignacion-temp-texto">
                <strong>${a.nombre_grado || ('Grado ' + a.id_grado)} · ${a.codigo_grupo || ('Grupo ' + a.id_grupo)}</strong>
                <span>${a.nombre_materia || ('Materia ' + a.id_materia)}</span>
            </div>
            <div class="asignacion-temp-meta">
                <button type="button" class="btn-quitar-asignacion-temp" onclick="quitarAsignacionTemp(${idx})" aria-label="Quitar asignación">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function actualizarGruposDocente() {
    const gradoSelect = document.getElementById('select-grado');
    const grupoSelect = document.getElementById('select-grupo');
    if (!gradoSelect || !grupoSelect) return;
    const grupos = GRUPOS_DOCENTE_DISPONIBLES.filter(g => String(g.id_grado) === String(gradoSelect.value));
    grupoSelect.innerHTML = grupos.map(g => `<option value="${g.id_grupo}">${g.codigo_grupo}</option>`).join('');
    grupoSelect.disabled = grupos.length === 0;
}

function quitarAsignacionTemp(idx) {
    ASIGNACIONES_DOCENTE_TEMP.splice(idx, 1);
    renderAsignacionesTemp();
}

async function guardarAsignacionesDocente(e) {
    e.preventDefault();
    if (!DOCENTE_SELECCIONADO) {
        mostrarAlerta('Selecciona un docente', 'error');
        return;
    }

    const seleccionActual = document.getElementById('select-grado')?.dataset.seleccionModificada === 'true'
        ? obtenerAsignacionSeleccionada()
        : null;
    if (!seleccionActual && (
        document.getElementById('select-grado')?.value ||
        document.getElementById('select-grupo')?.value ||
        document.getElementById('select-materia')?.value
    )) {
        mostrarAlerta('Completa grado, grupo y materia antes de guardar', 'error');
        return;
    }
    if (seleccionActual && !ASIGNACIONES_DOCENTE_TEMP.some(a =>
        a.id_grupo === seleccionActual.id_grupo && a.id_materia === seleccionActual.id_materia
    )) {
        ASIGNACIONES_DOCENTE_TEMP.push(seleccionActual);
        renderAsignacionesTemp();
    }

    const botonGuardar = e.submitter || document.querySelector('#form-asignar-docente button[type="submit"]');
    const textoOriginal = botonGuardar?.innerHTML;
    if (botonGuardar) {
        botonGuardar.disabled = true;
        botonGuardar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
    }
    try {
        await API.guardarAsignacionesDocente(DOCENTE_SELECCIONADO, ASIGNACIONES_DOCENTE_TEMP);
        mostrarAlerta('Asignaciones guardadas', 'success');
        cerrarModal('modal-asignar-docente');
        await renderDocentes();
    } catch (error) {
        console.error('Error guardando asignaciones del docente', error);
        mostrarAlerta(error.message || 'No se guardaron los cambios. Revisa los datos e inténtalo de nuevo.', 'error');
    } finally {
        if (botonGuardar) {
            botonGuardar.disabled = false;
            botonGuardar.innerHTML = textoOriginal;
        }
    }
}
