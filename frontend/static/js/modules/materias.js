let materiasCache = [];
let materiasFiltradas = [];
let matPaginaActual = 1;
const MAT_POR_PAGINA = 9;
let gradosDisponibles = [];
let materiaAsignarId = null;
let gradosParaAsignacion = [];
let materiaIdEliminar = null;

const ICONOS_MATERIA = {
    'MAT': 'fa-calculator', 'ALG': 'fa-superscript', 'GEO': 'fa-shapes',
    'EST': 'fa-chart-bar', 'ESP': 'fa-pen-nib', 'LEN': 'fa-pen-nib',
    'LIT': 'fa-book-reader', 'ING': 'fa-language', 'NAT': 'fa-leaf',
    'BIO': 'fa-dna', 'QUI': 'fa-atom', 'FIS': 'fa-bolt',
    'SOC': 'fa-globe-americas', 'INF': 'fa-laptop-code', 'TEC': 'fa-cogs',
    'FIL': 'fa-brain', 'ETI': 'fa-balance-scale', 'REL': 'fa-church',
    'ART': 'fa-palette', 'EDA': 'fa-palette', 'EDF': 'fa-running',
    'CIE': 'fa-flask'
};

async function renderMaterias() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const htmlRes = await fetch('/templates/modules html/materias.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de materias');
        content.innerHTML = await htmlRes.text();

        document.getElementById('btn-nueva-materia').addEventListener('click', () => abrirModalMateria());
        
        // Add event listeners for filters since oninput/onchange were removed from DOM template
        document.getElementById('mat-buscar')?.addEventListener('input', filtrarMaterias);
        document.getElementById('mat-filtro-intensidad')?.addEventListener('change', filtrarMaterias);
        document.getElementById('mat-filtro-grado')?.addEventListener('change', filtrarMaterias);

        await cargarMaterias();
    } catch (e) {
        content.innerHTML = `<div class="alerta error">${e.message}</div>`;
    }
}

async function cargarMaterias() {
    try {
        const data = await API.getMaterias();
        materiasCache = data.materias || [];
        extraerGradosDisponibles();
        actualizarStatsMaterias();
        filtrarMaterias();
    } catch (err) {
        const grid = document.getElementById('mat-grid');
        if (grid) grid.innerHTML = '<p style="color:#e53935;text-align:center;">Error al cargar materias</p>';
    }
}

function extraerGradosDisponibles() {
    const gradosSet = new Set();
    materiasCache.forEach(m => {
        if (m.grados_ids && m.grados_ids.trim()) {
            m.grados_ids.split(',').forEach(id => gradosSet.add(id));
        }
    });
    gradosDisponibles = Array.from(gradosSet).sort((a, b) => parseInt(a) - parseInt(b));

    const selectGrado = document.getElementById('mat-filtro-grado');
    if (selectGrado) {
        const gradosNombres = {};
        materiasCache.forEach(m => {
            if (m.grados_ids && m.grados_ids.trim() && m.grados_nombres) {
                const ids = m.grados_ids.split(',');
                const nombres = m.grados_nombres.split(', ');
                ids.forEach((id, i) => {
                    if (nombres[i]) gradosNombres[id] = nombres[i];
                });
            }
        });
        let html = '<option value="">Todos los grados</option>';
        gradosDisponibles.forEach(id => {
            html += `<option value="${id}">${gradosNombres[id] || 'Grado ' + id}</option>`;
        });
        selectGrado.innerHTML = html;
    }
}

function actualizarStatsMaterias() {
    document.getElementById('mat-stat-total').textContent = materiasCache.length;
    const conDocentes = materiasCache.filter(m => m.total_docentes > 0).length;
    document.getElementById('mat-stat-docentes').textContent = conDocentes;
    const totalHoras = materiasCache.reduce((s, m) => s + (m.intensidad_horaria || 0), 0);
    document.getElementById('mat-stat-horas').textContent = totalHoras;
}

function filtrarMaterias() {
    const buscar = (document.getElementById('mat-buscar')?.value || '').toLowerCase().trim();
    const intensidad = document.getElementById('mat-filtro-intensidad')?.value || '';
    const grado = (document.getElementById('mat-filtro-grado')?.value || '').trim();

    materiasFiltradas = materiasCache.filter(m => {
        if (buscar) {
            const texto = `${m.nombre_materia} ${m.codigo_materia} ${m.descripcion || ''}`.toLowerCase();
            if (!texto.includes(buscar)) return false;
        }
        if (intensidad) {
            const h = m.intensidad_horaria || 0;
            if (intensidad === '1-2' && (h < 1 || h > 2)) return false;
            if (intensidad === '3-4' && (h < 3 || h > 4)) return false;
            if (intensidad === '5+' && h < 5) return false;
        }
        if (grado) {
            if (!m.grados_ids || !m.grados_ids.includes(grado)) return false;
        }
        return true;
    });

    matPaginaActual = 1;
    renderGridMaterias();
}

function renderGridMaterias() {
    const grid = document.getElementById('mat-grid');
    if (!grid) return;

    if (materiasFiltradas.length === 0) {
        grid.innerHTML = `
            <div class="mat-sin-registros" style="grid-column: 1 / -1;">
                <i class="fas fa-book-open"></i>
                <p>No se encontraron materias</p>
            </div>`;
        document.getElementById('mat-paginacion').style.display = 'none';
        return;
    }

    const total = materiasFiltradas.length;
    const totalPags = Math.ceil(total / MAT_POR_PAGINA);
    if (matPaginaActual > totalPags) matPaginaActual = totalPags;
    const inicio = (matPaginaActual - 1) * MAT_POR_PAGINA;
    const fin = Math.min(inicio + MAT_POR_PAGINA, total);
    const pagina = materiasFiltradas.slice(inicio, fin);

    grid.innerHTML = pagina.map(m => {
        const codigoPref = (m.codigo_materia || '').substring(0, 3).toUpperCase();
        const icono = ICONOS_MATERIA[codigoPref] || 'fa-book';
        const desc = m.descripcion || 'Sin descripción';
        const gradosHTML = m.grados_nombres ?
            m.grados_nombres.split(', ').map(g => `<span class="mat-grado-chip">${g}</span>`).join('') :
            '<span style="color:var(--cafe-claro);font-size:0.85rem;">Sin asignar</span>';

        return `
        <div class="mat-card" data-materia-id="${m.id_materia}">
            <div class="mat-card-top">
                <div>
                    <p class="mat-card-titulo"><i class="fas ${icono}" style="margin-right:6px;"></i>${m.nombre_materia}</p>
                </div>
                <span class="mat-card-codigo">${m.codigo_materia || '—'}</span>
            </div>
            <div class="mat-card-body">
                <p class="mat-card-desc">${desc}</p>
                <div class="mat-card-meta">
                    <span class="mat-card-meta-item">
                        <i class="fas fa-clock"></i> ${m.intensidad_horaria} hrs/semana
                    </span>
                    <span class="mat-card-meta-item">
                        <i class="fas fa-chalkboard-teacher"></i> ${m.total_docentes || 0} docente(s)
                    </span>
                </div>
                <div class="mat-card-grados">
                    <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.3px;color:var(--cafe-claro);font-weight:600;">Grados:</span>
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.3rem;">
                        ${gradosHTML}
                    </div>
                </div>
            </div>
            <div class="mat-card-footer">
                <button class="mat-btn-accion mat-btn-ver mat-btn-action" data-action="ver" title="Ver detalle">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="mat-btn-accion mat-btn-editar mat-btn-action" data-action="editar" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="mat-btn-accion mat-btn-eliminar mat-btn-action" data-action="eliminar" title="Eliminar">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');

    // Event delegation para botones de tarjeta
    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.mat-btn-action');
        if (!btn) return;
        const card = btn.closest('.mat-card');
        const materiaId = parseInt(card.dataset.materiaId);
        const action = btn.dataset.action;

        if (action === 'ver') verMateria(materiaId);
        else if (action === 'editar') abrirModalMateria(materiaId);
        else if (action === 'eliminar') eliminarMateria(materiaId);
    });

    // Paginación
    const pag = document.getElementById('mat-paginacion');
    if (totalPags <= 1) {
        pag.style.display = total > 0 ? 'flex' : 'none';
        document.getElementById('mat-pag-info').textContent = `Mostrando ${total} materia(s)`;
        document.getElementById('mat-pag-btns').innerHTML = '';
    } else {
        pag.style.display = 'flex';
        document.getElementById('mat-pag-info').textContent = `Mostrando ${inicio + 1}-${fin} de ${total} materias`;
        let btns = `<button class="btn-pag mat-pag-btn" data-page="${matPaginaActual - 1}" ${matPaginaActual <= 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
        for (let i = 1; i <= totalPags; i++) {
            btns += `<button class="btn-pag mat-pag-btn ${i === matPaginaActual ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        btns += `<button class="btn-pag mat-pag-btn" data-page="${matPaginaActual + 1}" ${matPaginaActual >= totalPags ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;
        document.getElementById('mat-pag-btns').innerHTML = btns;
    }

    // Event delegation para paginación
    document.getElementById('mat-pag-btns').addEventListener('click', (e) => {
        const btn = e.target.closest('.mat-pag-btn');
        if (!btn || btn.disabled) return;
        const page = parseInt(btn.dataset.page);
        if (!isNaN(page) && page > 0) {
            matPaginaActual = page;
            renderGridMaterias();
        }
    });
}

// ═══════════════════════════════════════════════════════════
// GENERACIÓN AUTOMÁTICA DE CÓDIGO DE MATERIA
// ═══════════════════════════════════════════════════════════
function generarCodigoMateria() {
    const tipoSelect = document.getElementById('materia-tipo');
    const prefijo = tipoSelect.value;
    const iconPreview = document.getElementById('materia-codigo-preview-icon');
    const codigoInput = document.getElementById('materia-codigo');

    if (!prefijo) {
        codigoInput.value = '';
        iconPreview.innerHTML = '<i class="fas fa-book"></i>';
        return;
    }

    const iconClass = ICONOS_MATERIA[prefijo] || 'fa-book';
    iconPreview.innerHTML = `<i class="fas ${iconClass}"></i>`;

    const existentes = materiasCache
        .map(m => (m.codigo_materia || '').toUpperCase())
        .filter(c => c.startsWith(prefijo));

    if (existentes.length === 0) {
        codigoInput.value = `${prefijo}-001`;
    } else {
        let maxNum = 0;
        existentes.forEach(c => {
            const match = c.match(new RegExp(`^${prefijo}-(\\d+)$`));
            if (match) {
                const num = parseInt(match[1]);
                if (num > maxNum) maxNum = num;
            } else if (c === prefijo) {
                if (maxNum < 1) maxNum = 0;
            }
        });
        const siguiente = String(maxNum + 1).padStart(3, '0');
        codigoInput.value = `${prefijo}-${siguiente}`;
    }
}

function abrirModalMateria(id = null) {
    document.getElementById('form-materia').reset();
    document.getElementById('materia-id').value = '';
    document.getElementById('materia-tipo').value = '';
    document.getElementById('materia-codigo').value = '';
    document.getElementById('materia-codigo').readOnly = true;
    document.getElementById('materia-codigo-preview-icon').innerHTML = '<i class="fas fa-book"></i>';
    document.getElementById('materia-msg-crear').style.display = 'none';
    document.getElementById('materia-seccion-docentes').style.display = 'none';

    if (id) {
        const m = materiasCache.find(x => x.id_materia === id);
        if (!m) return mostrarAlerta('Materia no encontrada', 'error');
        document.getElementById('modal-materia-titulo').innerHTML = '<i class="fas fa-edit"></i> Editar Materia';
        document.getElementById('materia-id').value = m.id_materia;
        document.getElementById('materia-nombre').value = m.nombre_materia;
        document.getElementById('materia-intensidad').value = m.intensidad_horaria || 4;
        document.getElementById('materia-descripcion').value = m.descripcion || '';

        const codigoActual = (m.codigo_materia || '').toUpperCase();
        const prefijoDetectado = codigoActual.split('-')[0];
        const tipoSelect = document.getElementById('materia-tipo');

        for (let opt of tipoSelect.options) {
            if (opt.value === prefijoDetectado) {
                tipoSelect.value = prefijoDetectado;
                break;
            }
        }

        document.getElementById('materia-codigo').value = m.codigo_materia || '';
        const iconClass = ICONOS_MATERIA[prefijoDetectado] || 'fa-book';
        document.getElementById('materia-codigo-preview-icon').innerHTML = `<i class="fas ${iconClass}"></i>`;

        document.getElementById('materia-seccion-docentes').style.display = 'block';
        cargarDocentesEnModalEditar(id);
    } else {
        document.getElementById('modal-materia-titulo').innerHTML = '<i class="fas fa-plus-circle"></i> Nueva Materia';
        document.getElementById('materia-msg-crear').style.display = 'block';
    }
    abrirModal('modal-materia');
}

// ═══ Cargar docentes dentro del modal de editar ═══
async function cargarDocentesEnModalEditar(materiaId) {
    materiaAsignarId = materiaId;
    const gradoSel = document.getElementById('materia-editar-grado');
    const grupoSel = document.getElementById('materia-editar-grupo');
    const docenteSel = document.getElementById('materia-editar-docente');

    grupoSel.innerHTML = '<option value="">-- Primero selecciona un grado --</option>';
    grupoSel.disabled = true;
    docenteSel.innerHTML = '<option value="">-- Selecciona grado y grupo primero --</option>';
    docenteSel.disabled = true;

    try {
        const data = await API.getGrados();
        if (data.grados) {
            let html = '<option value="">-- Selecciona un grado --</option>';
            data.grados.sort((a, b) => (a.numero_grado || 0) - (b.numero_grado || 0)).forEach(g => {
                html += `<option value="${g.id_grado}">${g.nombre_grado || 'Grado ' + g.id_grado}</option>`;
            });
            gradoSel.innerHTML = html;

            gradoSel.onchange = function () {
                if (this.value) {
                    cargarGruposEnModalEditar(this.value);
                } else {
                    grupoSel.innerHTML = '<option value="">-- Primero selecciona un grado --</option>';
                    grupoSel.disabled = true;
                    docenteSel.innerHTML = '<option value="">-- Selecciona grado y grupo primero --</option>';
                    docenteSel.disabled = true;
                }
            };
        }
    } catch (err) {
        console.error('Error cargando grados:', err);
    }

    await cargarListaDocentesModalEditar(materiaId);
}

async function cargarGruposEnModalEditar(gradoId) {
    const grupoSel = document.getElementById('materia-editar-grupo');
    const docenteSel = document.getElementById('materia-editar-docente');
    try {
        const data = await API.request(`/api/grados/${gradoId}/grupos`);
        if (data.grupos) {
            let html = '<option value="">-- Selecciona un grupo --</option>';
            data.grupos.forEach(g => { html += `<option value="${g.id_grupo}">${g.codigo_grupo}</option>`; });
            grupoSel.innerHTML = html;
            grupoSel.disabled = false;
            grupoSel.onchange = function () {
                if (this.value) {
                    cargarDocentesEnModalEditarSelect(gradoId, this.value);
                } else {
                    docenteSel.innerHTML = '<option value="">-- Selecciona un grupo primero --</option>';
                    docenteSel.disabled = true;
                }
            };
            docenteSel.innerHTML = '<option value="">-- Selecciona un grupo primero --</option>';
            docenteSel.disabled = true;
        }
    } catch (err) {
        console.error('Error cargando grupos:', err);
    }
}

async function cargarDocentesEnModalEditarSelect(gradoId, grupoId) {
    const docenteSel = document.getElementById('materia-editar-docente');
    try {
        const data = await API.request(`/api/materias/${materiaAsignarId}/docentes-disponibles?grado_id=${gradoId}&grupo_id=${grupoId}`);
        if (data.docentes && data.docentes.length > 0) {
            let html = '<option value="">-- Selecciona un docente --</option>';
            data.docentes.forEach(d => { html += `<option value="${d.id_usuario}">${d.nombre_completo}</option>`; });
            docenteSel.innerHTML = html;
            docenteSel.disabled = false;
        } else {
            docenteSel.innerHTML = '<option value="">No hay docentes disponibles</option>';
            docenteSel.disabled = true;
        }
    } catch (err) {
        console.error('Error cargando docentes:', err);
    }
}

async function cargarListaDocentesModalEditar(materiaId) {
    const lista = document.getElementById('materia-editar-lista-docentes');
    try {
        const data = await API.request(`/api/materias/${materiaId}`);
        if (data.materia.docentes && data.materia.docentes.length > 0) {
            lista.innerHTML = data.materia.docentes.map(d => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem;border-bottom:1px solid #ddd;">
                    <div>
                        <span style="font-weight:600;color:var(--cafe-oscuro);font-size:0.9rem;">${d.nombre} ${d.apellido}</span>
                        <div style="font-size:0.75rem;color:var(--cafe-claro);">${d.nombre_grado} - Grupo ${d.codigo_grupo}</div>
                    </div>
                    <button type="button" class="btn-accion btn-accion-rojo" onclick="desasignarDocenteDesdeModal(${d.id_asignacion}, ${materiaId})" title="Desasignar" style="width:28px;height:28px;border:none;background:#ffebee;color:#e53935;border-radius:6px;cursor:pointer;">
                        <i class="fas fa-times"></i>
                    </button>
                </div>`).join('');
        } else {
            lista.innerHTML = '<p style="color:var(--cafe-claro);text-align:center;margin:0.5rem;font-size:0.85rem;">No hay docentes asignados</p>';
        }
    } catch (err) {
        lista.innerHTML = '<p style="color:#e53935;text-align:center;margin:0.5rem;font-size:0.85rem;">Error al cargar</p>';
    }
}

async function asignarDocenteDesdeModal() {
    const gradoId = document.getElementById('materia-editar-grado').value;
    const grupoId = document.getElementById('materia-editar-grupo').value;
    const docenteId = document.getElementById('materia-editar-docente').value;
    if (!gradoId || !grupoId || !docenteId) return mostrarAlerta('Selecciona grado, grupo y docente', 'error');

    try {
        await API.request('/api/asignaciones-docente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_materia: materiaAsignarId, id_usuario: parseInt(docenteId), id_grado: parseInt(gradoId), id_grupo: parseInt(grupoId) })
        });
        mostrarAlerta('Docente asignado correctamente', 'exito');
        await cargarListaDocentesModalEditar(materiaAsignarId);
        document.getElementById('materia-editar-docente').innerHTML = '<option value="">-- Selecciona grado y grupo primero --</option>';
        document.getElementById('materia-editar-docente').disabled = true;
        document.getElementById('materia-editar-grupo').value = '';
        document.getElementById('materia-editar-grupo').disabled = true;
        document.getElementById('materia-editar-grado').value = '';
    } catch (err) {
        mostrarAlerta(err.message || 'Error al asignar', 'error');
    }
}

async function desasignarDocenteDesdeModal(asignacionId, materiaId) {
    try {
        await API.request(`/api/asignaciones-docente/${asignacionId}`, { method: 'DELETE' });
        mostrarAlerta('Docente desasignado', 'exito');
        await cargarListaDocentesModalEditar(materiaId);
    } catch (err) {
        mostrarAlerta(err.message || 'Error al desasignar', 'error');
    }
}

async function guardarMateria(e) {
    e.preventDefault();
    const id = document.getElementById('materia-id').value;
    const payload = {
        nombre_materia: document.getElementById('materia-nombre').value.trim(),
        codigo_materia: document.getElementById('materia-codigo').value.trim(),
        intensidad_horaria: parseInt(document.getElementById('materia-intensidad').value) || 4,
        descripcion: document.getElementById('materia-descripcion').value.trim()
    };

    if (!payload.nombre_materia || !payload.codigo_materia) {
        return mostrarAlerta('Nombre y código son obligatorios', 'error');
    }

    try {
        if (id) {
            await API.request(`/api/materias/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            await API.request('/api/materias', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }
        cerrarModal('modal-materia');
        mostrarAlerta(id ? 'Materia actualizada correctamente' : 'Materia creada correctamente', 'success');
        cargarMaterias();
    } catch (err) {
        mostrarAlerta(err.message || 'Error al guardar materia', 'error');
    }
}

async function verMateria(id) {
    try {
        const mCache = materiasCache.find(x => x.id_materia === id);
        const data = await API.request(`/api/materias/${id}`);
        const m = data.materia;
        document.getElementById('ver-materia-nombre').textContent = m.nombre_materia;

        const gradosHTML = mCache && mCache.grados_nombres ?
            mCache.grados_nombres.split(', ').map(g =>
                `<span class="mat-grado-chip" style="margin-right:0.3rem;margin-bottom:0.3rem;"><i class="fas fa-layer-group" style="margin-right:0.2rem;"></i>${g}</span>`
            ).join('') :
            '<span style="color:var(--cafe-claro);font-size:0.9rem;">Sin grados asignados</span>';

        let docentesHTML = '';
        if (m.docentes && m.docentes.length > 0) {
            docentesHTML = `
                <div class="mat-docentes-list">
                    <h4><i class="fas fa-chalkboard-teacher"></i> Docentes asignados (${m.docentes.length})</h4>
                    <div>${m.docentes.map(d =>
                        `<span class="mat-docente-chip"><i class="fas fa-user"></i> ${d.nombre} ${d.apellido} — ${d.nombre_grado}</span>`
                    ).join('')}</div>
                </div>`;
        } else {
            docentesHTML = `
                <div class="mat-docentes-list">
                    <h4><i class="fas fa-chalkboard-teacher"></i> Docentes asignados</h4>
                    <p style="color:var(--cafe-claro);font-size:0.9rem;">No hay docentes asignados a esta materia.</p>
                </div>`;
        }

        const fechaCreacion = m.created_at ? new Date(m.created_at).toLocaleDateString('es-CO') : '—';

        document.getElementById('ver-materia-body').innerHTML = `
            <div class="mat-detalle-grid">
                <div class="mat-detalle-item">
                    <span class="mat-detalle-label">Código</span>
                    <span class="mat-detalle-valor">${m.codigo_materia || '—'}</span>
                </div>
                <div class="mat-detalle-item">
                    <span class="mat-detalle-label">Intensidad Horaria</span>
                    <span class="mat-detalle-valor">${m.intensidad_horaria} horas/semana</span>
                </div>
                <div class="mat-detalle-item full">
                    <span class="mat-detalle-label">Descripción</span>
                    <span class="mat-detalle-valor">${m.descripcion || 'Sin descripción'}</span>
                </div>
                <div class="mat-detalle-item full">
                    <span class="mat-detalle-label"><i class="fas fa-layer-group"></i> Grados donde se imparte</span>
                    <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.4rem;">
                        ${gradosHTML}
                    </div>
                </div>
                <div class="mat-detalle-item">
                    <span class="mat-detalle-label">Fecha de creación</span>
                    <span class="mat-detalle-valor">${fechaCreacion}</span>
                </div>
                <div class="mat-detalle-item">
                    <span class="mat-detalle-label">ID Materia</span>
                    <span class="mat-detalle-valor">#${m.id_materia}</span>
                </div>
            </div>
            ${docentesHTML}
        `;
        abrirModal('modal-ver-materia');

    } catch (err) {
        mostrarAlerta('Error de conexión al ver materia', 'error');
    }
}

function eliminarMateria(id) {
    materiaIdEliminar = id;
    document.getElementById('btn-confirmar-eliminar-materia').onclick = async () => {
        try {
            await API.request(`/api/materias/${materiaIdEliminar}`, { method: 'DELETE' });
            cerrarModal('modal-eliminar-materia');
            mostrarAlerta('Materia eliminada correctamente', 'success');
            cargarMaterias();
        } catch (err) {
            cerrarModal('modal-eliminar-materia');
            mostrarAlerta(err.message || 'Error al eliminar materia', 'error');
        }
    };
    abrirModal('modal-eliminar-materia');
}

// ═══ Modal independiente de asignar docentes (usado desde otra vista) ═══
async function abrirModalAsignarDocentes(materia_id, materia_nombre) {
    materiaAsignarId = materia_id;
    document.getElementById('asignar-mat-nombre').textContent = materia_nombre;

    document.getElementById('asignar-materia-grupo').innerHTML = '<option value="">-- Primero selecciona un grado --</option>';
    document.getElementById('asignar-materia-grupo').disabled = true;
    document.getElementById('asignar-materia-docente').innerHTML = '<option value="">-- Selecciona grado y grupo primero --</option>';
    document.getElementById('asignar-materia-docente').disabled = true;

    try {
        const gradosData = await API.getGrados();
        if (gradosData.grados) {
            gradosParaAsignacion = gradosData.grados
                .map(g => ({ id: g.id_grado, nombre: g.nombre_grado, numero: g.numero_grado }))
                .sort((a, b) => a.numero - b.numero)
                .map(g => g.id);

            let html = '<option value="">-- Selecciona un grado --</option>';
            gradosData.grados
                .sort((a, b) => (a.numero_grado || 0) - (b.numero_grado || 0))
                .forEach(g => {
                    html += `<option value="${g.id_grado}">${g.nombre_grado || 'Grado ' + g.id_grado}</option>`;
                });
            document.getElementById('asignar-materia-grado').innerHTML = html;

            document.getElementById('asignar-materia-grado').onchange = function () {
                if (this.value) {
                    cargarGruposPorGrado(this.value);
                } else {
                    document.getElementById('asignar-materia-grupo').innerHTML = '<option value="">-- Primero selecciona un grado --</option>';
                    document.getElementById('asignar-materia-grupo').disabled = true;
                    document.getElementById('asignar-materia-docente').innerHTML = '<option value="">-- Selecciona grado y grupo primero --</option>';
                    document.getElementById('asignar-materia-docente').disabled = true;
                }
            };

            await cargarAsignacionesActuales(materia_id);
            abrirModal('modal-asignar-docentes-materia');
        } else {
            mostrarAlerta('No se pudieron cargar los grados disponibles', 'error');
        }
    } catch (err) {
        console.error('Error:', err);
        mostrarAlerta('Error al cargar información de la materia', 'error');
    }
}

async function cargarGruposPorGrado(grado_id) {
    try {
        if (!grado_id) return;
        const data = await API.request(`/api/grados/${grado_id}/grupos`);
        if (data.grupos) {
            let html = '<option value="">-- Selecciona un grupo --</option>';
            data.grupos.forEach(g => {
                html += `<option value="${g.id_grupo}">${g.codigo_grupo}</option>`;
            });
            const grupoSelect = document.getElementById('asignar-materia-grupo');
            grupoSelect.innerHTML = html;
            grupoSelect.disabled = false;
            grupoSelect.onchange = function () {
                if (this.value) {
                    cargarDocentesDisponibles(grado_id, this.value);
                } else {
                    document.getElementById('asignar-materia-docente').innerHTML = '<option value="">-- Selecciona un grupo primero --</option>';
                    document.getElementById('asignar-materia-docente').disabled = true;
                }
            };
            document.getElementById('asignar-materia-docente').innerHTML = '<option value="">-- Selecciona un grupo primero --</option>';
            document.getElementById('asignar-materia-docente').disabled = true;
        } else {
            mostrarAlerta('No hay grupos disponibles para este grado', 'error');
        }
    } catch (err) {
        console.error('Error al cargar grupos:', err);
        mostrarAlerta('Error al cargar grupos', 'error');
    }
}

async function cargarDocentesDisponibles(grado_id, grupo_id) {
    try {
        if (!grado_id || !grupo_id) {
            document.getElementById('asignar-materia-docente').innerHTML = '<option value="">-- Selecciona grado y grupo primero --</option>';
            document.getElementById('asignar-materia-docente').disabled = true;
            return;
        }
        const data = await API.request(`/api/materias/${materiaAsignarId}/docentes-disponibles?grado_id=${grado_id}&grupo_id=${grupo_id}`);
        let html = '<option value="">-- Selecciona un docente --</option>';
        if (data.docentes && data.docentes.length > 0) {
            data.docentes.forEach(d => {
                html += `<option value="${d.id_usuario}">${d.nombre_completo}</option>`;
            });
        } else {
            html = '<option value="">No hay docentes disponibles para este grado y grupo</option>';
        }
        const docenteSelect = document.getElementById('asignar-materia-docente');
        docenteSelect.innerHTML = html;
        docenteSelect.disabled = false;
    } catch (err) {
        console.error('Error al cargar docentes:', err);
        document.getElementById('asignar-materia-docente').innerHTML = '<option value="">Error de conexión</option>';
        mostrarAlerta('Error de conexión al cargar docentes', 'error');
    }
}

async function cargarAsignacionesActuales(materia_id) {
    try {
        const data = await API.request(`/api/materias/${materia_id}`);
        if (data.materia.docentes) {
            const docentes = data.materia.docentes;
            if (docentes.length === 0) {
                document.getElementById('lista-asignaciones-materia').innerHTML =
                    '<p style="color:var(--cafe-claro);text-align:center;margin:0.5rem;font-size:0.9rem;">No hay docentes asignados</p>';
                return;
            }
            let html = '';
            docentes.forEach(d => {
                html += `
                    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem;border-bottom:1px solid #ddd;">
                        <div>
                            <span style="font-weight:600;color:var(--cafe-oscuro);">${d.nombre} ${d.apellido}</span>
                            <div style="font-size:0.8rem;color:var(--cafe-claro);">${d.nombre_grado} - Grupo ${d.codigo_grupo}</div>
                        </div>
                        <button class="btn-accion btn-accion-rojo mat-btn-desasignar" data-asignacion-id="${d.id_asignacion}" title="Desasignar" style="width:32px;height:32px;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>`;
            });
            const lista = document.getElementById('lista-asignaciones-materia');
            lista.innerHTML = html;
            lista.addEventListener('click', (e) => {
                const btn = e.target.closest('.mat-btn-desasignar');
                if (!btn) return;
                const asignacionId = parseInt(btn.dataset.asignacionId);
                desasignarDocente(asignacionId);
            });
        }
    } catch (err) {
        mostrarAlerta('Error al cargar asignaciones', 'error');
    }
}

async function guardarAsignacionDocente() {
    const grado_id = document.getElementById('asignar-materia-grado').value;
    const grupo_id = document.getElementById('asignar-materia-grupo').value;
    const docente_id = document.getElementById('asignar-materia-docente').value;

    if (!grado_id || !grupo_id || !docente_id) {
        return mostrarAlerta('Debes seleccionar grado, grupo y docente', 'error');
    }

    try {
        await API.request('/api/asignaciones-docente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: parseInt(docente_id),
                id_materia: materiaAsignarId,
                id_grado: parseInt(grado_id),
                id_grupo: parseInt(grupo_id),
                año_lectivo: 2026
            })
        });
        mostrarAlerta('Docente asignado correctamente', 'success');
        document.getElementById('asignar-materia-docente').value = '';
        await cargarAsignacionesActuales(materiaAsignarId);
        await cargarDocentesDisponibles(grado_id, grupo_id);
        cargarMaterias();
    } catch (err) {
        mostrarAlerta(err.message || 'Error al asignar docente', 'error');
    }
}

async function desasignarDocente(id_asignacion) {
    if (!confirm('¿Estás seguro de que deseas desasignar este docente?')) return;
    try {
        await API.request(`/api/asignaciones-docente/${id_asignacion}`, { method: 'DELETE' });
        mostrarAlerta('Docente desasignado correctamente', 'success');
        await cargarAsignacionesActuales(materiaAsignarId);
        cargarMaterias();
    } catch (err) {
        mostrarAlerta(err.message || 'Error al desasignar', 'error');
    }
}
