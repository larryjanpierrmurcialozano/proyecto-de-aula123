// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO GRADOS Y GRUPOS
// CRUD de grados, grupos y visualización de estudiantes por grupo
// ════════════════════════════════════════════════════════════════════════════════

let GRADOS_CACHE = [];
let GRUPOS_CACHE = [];
let NIVELES_CACHE = [
    { id_nivel: 1, nombre: 'Primaria' },
    { id_nivel: 2, nombre: 'Secundaria' }
];

async function renderGrados() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();
    await cargarGrados();
    await cargarGrupos();
    
    try {
        const htmlRes = await fetch('/templates/modules html/grados.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de grados');
        content.innerHTML = await htmlRes.text();

        document.getElementById('contenedor-tabla-grados').innerHTML = dibujarTablaGrados();
        
        const filtroSelect = document.getElementById('filtro-grado-grupo');
        if (filtroSelect) {
            filtroSelect.innerHTML = '<option value="">Todos los grados</option>' +
                GRADOS_CACHE.map(g => `<option value='${g.id_grado}'>${g.nombre_grado}</option>`).join('');
        }

        document.getElementById('contenedor-tabla-grupos').innerHTML = dibujarTablaGrupos();
    } catch (error) {
        console.error('Error renderGrados:', error);
        content.innerHTML = Helpers.error('No se pudo cargar la vista de grados.');
    }
}

async function cargarGrados() {
    const res = await API.getGrados();
    GRADOS_CACHE = res.grados || [];
}

async function cargarGrupos() {
    const res = await API.getGrupos();
    GRUPOS_CACHE = res.grupos || [];
}

function dibujarTablaGrados() {
    if (!GRADOS_CACHE.length) return `<div>No hay grados registrados</div>`;
    let html = `<table><thead><tr><th>ID</th><th>Número</th><th>Nombre</th><th>Nivel</th><th>Grupos</th><th>Acciones</th></tr></thead><tbody>`;
    for (const g of GRADOS_CACHE) {
        html += `<tr>
            <td>${g.id_grado}</td>
            <td>${g.numero_grado}</td>
            <td>${g.nombre_grado}</td>
            <td><span class="badge badge-cafe">${g.nivel || '-'}</span></td>
            <td>${g.total_grupos || 0} grupos</td>
            <td>
                <div class="acciones-btns">
                    <button class="btn-accion btn-accion-cafe" title="Ver" onclick="verGrado(${g.id_grado})"><i class="fas fa-eye"></i></button>
                    <button class="btn-accion btn-accion-verde" title="Editar" onclick="abrirModalGrado(${g.id_grado})"><i class="fas fa-edit"></i></button>
                    <button class="btn-accion btn-accion-rojo" title="Eliminar" onclick="confirmarEliminarGrado(${g.id_grado})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    return html;
}

function dibujarTablaGrupos() {
    let grupos = GRUPOS_CACHE;
    const filtro = document.getElementById('filtro-grado-grupo')?.value;
    if (filtro) grupos = grupos.filter(g => String(g.id_grado) === String(filtro));
    if (!grupos.length) return `<div>No hay grupos registrados</div>`;
    let html = `<table><thead><tr><th>ID</th><th>Código</th><th>Grado</th><th>Capacidad</th><th>Estudiantes</th><th>Acciones</th></tr></thead><tbody>`;
    for (const g of grupos) {
        html += `<tr>
            <td>${g.id_grupo}</td>
            <td>${g.codigo_grupo}</td>
            <td>${g.nombre_grado}</td>
            <td>${g.capacidad_maxima}</td>
            <td>${g.total_estudiantes || 0}</td>
            <td>
                <div class="acciones-btns">
                    <button class="btn-accion btn-accion-cafe" title="Ver estudiantes" onclick="verGrupo(${g.id_grupo})"><i class="fas fa-users"></i></button>
                    <button class="btn-accion btn-accion-verde" title="Editar" onclick="abrirModalGrupo(${g.id_grupo})"><i class="fas fa-edit"></i></button>
                    <button class="btn-accion btn-accion-rojo" title="Eliminar" onclick="confirmarEliminarGrupo(${g.id_grupo})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }
    html += '</tbody></table>';
    return html;
}

function filtrarGruposPorGrado() {
    renderGrados();
    mostrarTab('grupos');
}

function verGrado(id) {
    document.getElementById('filtro-grado-grupo').value = id;
    mostrarTab('grupos');
}

function verGrupo(id) {
    API.getGrupoEstudiantes(id)
        .then(res => {
            const estudiantes = res.estudiantes || [];
            const list = document.getElementById('modal-grupo-estudiantes-list');
            if (list) {
                if (!estudiantes.length) {
                    list.innerHTML = '<p>No hay estudiantes en este grupo.</p>';
                } else {
                    list.innerHTML = `
                        <div class="grupo-estudiantes-resumen">
                            <div class="grupo-estudiantes-icono"><i class="fas fa-users"></i></div>
                            <div>
                                <h3>${estudiantes.length} estudiante(s) registrados</h3>
                                <p>Listado organizado por nombre completo y documento.</p>
                            </div>
                        </div>
                        <div class="grupo-estudiantes-lista">
                            ${estudiantes.map((e, idx) => `
                                <div class="grupo-estudiante-card">
                                    <div class="grupo-estudiante-numero">${String(idx + 1).padStart(2, '0')}</div>
                                    <div class="grupo-estudiante-info">
                                        <strong>${e.apellido || ''} ${e.nombre || ''}</strong>
                                        <span>${e.documento || 'Sin documento'}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `;
                }
                document.getElementById('modal-grupo-estudiantes-titulo').textContent = `Estudiantes del grupo ${id}`;
                document.getElementById('modal-grupo-estudiantes').classList.add('active');
            } else {
                mostrarAlerta(estudiantes.length + ' estudiantes', 'info');
            }
        })
        .catch(err => {
            mostrarAlerta(err && err.message ? err.message : 'Error al obtener estudiantes', 'error');
        });
}

function abrirModalGrado(id = null) {
    document.getElementById('modal-grado').classList.add('active');
    document.getElementById('form-grado').reset();
    document.getElementById('grado-id').value = id || '';
    poblarSelectNiveles();
    if (id) {
        const g = GRADOS_CACHE.find(x => x.id_grado === id);
        document.getElementById('modal-grado-titulo').textContent = 'Editar Grado';
        document.getElementById('grado-nombre').value = g.nombre_grado;
        document.getElementById('grado-nivel').value = g.id_nivel;
        document.getElementById('grado-orden').value = g.orden || g.numero_grado;
    } else {
        document.getElementById('modal-grado-titulo').textContent = 'Nuevo Grado';
    }
    document.getElementById('form-grado').onsubmit = submitGrado;
}

function poblarSelectNiveles() {
    const select = document.getElementById('grado-nivel');
    select.innerHTML = NIVELES_CACHE.map(n => `<option value="${n.id_nivel}">${n.nombre}</option>`).join('');
}

async function submitGrado(event) {
    event.preventDefault();
    const id = document.getElementById('grado-id').value;
    const payload = {
        nombre_grado: document.getElementById('grado-nombre').value,
        id_nivel: parseInt(document.getElementById('grado-nivel').value),
        orden: parseInt(document.getElementById('grado-orden').value),
        numero_grado: parseInt(document.getElementById('grado-orden').value)
    };
    try {
        if (id) {
            await API.actualizarGrado(id, payload);
        } else {
            await API.crearGrado(payload);
        }
        cerrarModal('modal-grado');
        renderGrados();
    } catch (e) {
        mostrarAlerta(e && e.message ? e.message : 'Error al guardar grado', 'error');
    }
}

function abrirModalGrupo(id = null) {
    document.getElementById('modal-grupo').classList.add('active');
    document.getElementById('form-grupo').reset();
    document.getElementById('grupo-id').value = id || '';
    poblarSelectGrados();
    if (id) {
        const g = GRUPOS_CACHE.find(x => x.id_grupo === id);
        document.getElementById('modal-grupo-titulo').textContent = 'Editar Grupo';
        document.getElementById('grupo-codigo').value = g.codigo_grupo;
        document.getElementById('grupo-grado').value = g.id_grado;
        document.getElementById('grupo-capacidad').value = g.capacidad_maxima;
    } else {
        document.getElementById('modal-grupo-titulo').textContent = 'Nuevo Grupo';
    }
    document.getElementById('form-grupo').onsubmit = submitGrupo;
}

function poblarSelectGrados() {
    const select = document.getElementById('grupo-grado');
    if (!select) return;
    if (!GRADOS_CACHE || !GRADOS_CACHE.length) {
        select.innerHTML = `<option value="">No hay grados</option>`;
        return;
    }
    select.innerHTML = GRADOS_CACHE.map(g => `<option value="${g.id_grado}">${g.nombre_grado}</option>`).join('');
}

async function submitGrupo(event) {
    event.preventDefault();
    const id = document.getElementById('grupo-id').value;
    const payload = {
        codigo_grupo: document.getElementById('grupo-codigo').value,
        id_grado: parseInt(document.getElementById('grupo-grado').value),
        capacidad_maxima: parseInt(document.getElementById('grupo-capacidad').value)
    };
    try {
        if (id) {
            await API.actualizarGrupo(id, payload);
            cerrarModal('modal-grupo');
            mostrarAlerta('Grupo actualizado correctamente', 'success');
        } else {
            await API.crearGrupo(payload);
            cerrarModal('modal-grupo');
            mostrarAlerta('Grupo creado correctamente', 'success');
        }
        renderGrados();
    } catch (e) {
        mostrarAlerta(e && e.message ? e.message : 'Error al guardar grupo', 'error');
    }
}

function confirmarEliminarGrado(id) {
    const texto = document.getElementById('texto-eliminar-gg');
    texto.textContent = '¿Seguro que deseas eliminar este grado? Esta acción no se puede deshacer.';
    const btn = document.getElementById('btn-confirmar-eliminar-gg');
    btn.onclick = async function () {
        try {
            await API.eliminarGrado(id);
            cerrarModal('modal-eliminar-grado-grupo');
            mostrarAlerta('Grado eliminado correctamente', 'success');
            renderGrados();
        } catch (e) {
            mostrarAlerta(e && e.message ? e.message : 'Error al eliminar grado', 'error');
        }
    };
    document.getElementById('modal-eliminar-grado-grupo').classList.add('active');
}

function confirmarEliminarGrupo(id) {
    const texto = document.getElementById('texto-eliminar-gg');
    texto.textContent = '¿Seguro que deseas eliminar este grupo? Esta acción no se puede deshacer.';
    const btn = document.getElementById('btn-confirmar-eliminar-gg');
    btn.onclick = async function () {
        try {
            await API.eliminarGrupo(id);
            cerrarModal('modal-eliminar-grado-grupo');
            mostrarAlerta('Grupo eliminado correctamente', 'success');
            renderGrados();
        } catch (e) {
            mostrarAlerta(e && e.message ? e.message : 'Error al eliminar grupo', 'error');
        }
    };
    document.getElementById('modal-eliminar-grado-grupo').classList.add('active');
}
