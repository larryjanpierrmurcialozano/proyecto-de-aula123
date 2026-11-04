// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO COMUNICADOS
// CRUD de comunicados institucionales con filtros y roles
// ════════════════════════════════════════════════════════════════════════════════

let comunicadosCargados = [];

async function renderComunicados() {
    const rol = (USUARIO.rol || '').toLowerCase();
    const esAdmin = ['server_admin', 'rector', 'coordinador'].includes(rol);
    const esProfesor = rol === 'profesor' || rol === 'docente';
    const totalCols = esAdmin ? 7 : (esProfesor ? 6 : 6);
    const content = document.getElementById('main-content');
    
    try {
        content.innerHTML = '<div style="padding:2rem;text-align:center;"><i class="fas fa-spinner fa-spin fa-2x"></i> Cargando módulo...</div>';
        
        // 1. OBTENEMOS EL HTML PURO DESDE FLASK
        const response = await fetch('/templates/modules html/comunicados.html');
        if (!response.ok) throw new Error('Error al cargar la plantilla');
        const fragmentHTML = await response.text();
        
        // 2. INYECTAMOS
        content.innerHTML = fragmentHTML;
        
        // 3. APLICAMOS REGLAS DE ROLES AL HTML INYECTADO
        if (esProfesor) {
            document.getElementById('com-header-title').innerHTML = '<i class="fas fa-bullhorn"></i> Comunicados';
            document.getElementById('com-header-subtitle').innerText = 'Comunicados dirigidos al equipo docente';
            document.getElementById('filtro-audiencia-container').style.display = 'none'; // Profesores no filtran audiencia
            const thAudiencia = document.getElementById('th-audiencia');
            if (thAudiencia) thAudiencia.style.display = 'none'; // Ocultan la columna
            
            const thAcciones = document.getElementById('th-acciones');
            if(thAcciones) thAcciones.innerText = 'Ver';
        } else if (esAdmin) {
            document.getElementById('btn-nuevo-comunicado').style.display = 'inline-block';
        }
        
        // Ocultar columna audiencia si es profesor en el colspan del loading..
        const tdLoading = document.getElementById('com-loading-td');
        if (tdLoading) tdLoading.colSpan = totalCols;

        // 4. CARGAMOS LOS DATOS
        cargarComunicados();

    } catch (error) {
        console.error(error);
        content.innerHTML = '<div style="color:red;padding:20px;">Error al cargar el módulo de comunicados. Contacta soporte.</div>';
    }
}

async function cargarComunicados() {
    const rol = (USUARIO.rol || '').toLowerCase();
    const esAdmin = ['server_admin', 'rector', 'coordinador'].includes(rol);
    let comunicados = [];

    try {
        const data = await API.request('/api/comunicados');
        comunicados = data.comunicados || data || [];
    } catch (e) {
        mostrarAlerta('No se pudieron cargar los comunicados', 'error');
    }

    comunicadosCargados = comunicados;
    renderTablaComunicados(comunicados, esAdmin);
}

function renderTablaComunicados(comunicados, esAdmin) {
    const rol = (USUARIO.rol || '').toLowerCase();
    const esProfesor = rol === 'profesor' || rol === 'docente';
    const totalCols = esAdmin ? 7 : (esProfesor ? 6 : 6);
    const tbody = document.getElementById('com-tbody');

    if (comunicados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align:center;padding:2rem;color:#999;">
            <i class="fas fa-inbox" style="font-size:1.5rem;"></i><br>No hay comunicados
        </td></tr>`;
        return;
    }

    tbody.innerHTML = comunicados.map(c => {
        const prioridadBadge = { 'Urgente': 'badge-rojo', 'Alta': 'badge-naranja', 'Media': 'badge-amarillo', 'Baja': 'badge-verde' }[c.prioridad] || 'badge-gris';
        const estadoBadge = c.activo ? 'badge-verde' : 'badge-gris';
        const estadoTexto = c.activo ? 'Activo' : 'Inactivo';

        return `<tr>
            <td><strong>${c.titulo}</strong></td>
            <td><span class="badge badge-azul">${c.tipo_comunicado}</span></td>
            ${!esProfesor ? `<td><span class="badge badge-gris">${c.audiencia}</span></td>` : ''}
            <td><span class="badge ${prioridadBadge}">${c.prioridad}</span></td>
            <td>${new Date(c.fecha_publicacion).toLocaleDateString('es-ES')}</td>
            <td><span class="badge ${estadoBadge}">${estadoTexto}</span></td>
            ${esAdmin ? `<td class="com-acciones">
                <button class="com-btn-accion com-btn-ver" onclick="verComunicado(${c.id_comunicado})" title="Ver"><i class="fas fa-eye"></i></button>
                <button class="com-btn-accion com-btn-editar" onclick="editarComunicado(${c.id_comunicado})" title="Editar"><i class="fas fa-edit"></i></button>
                <button class="com-btn-accion com-btn-eliminar" onclick="eliminarComunicado(${c.id_comunicado})" title="Eliminar"><i class="fas fa-trash"></i></button>
            </td>` : (esProfesor ? `<td class="com-acciones">
                <button class="com-btn-accion com-btn-ver" onclick="verComunicado(${c.id_comunicado})" title="Ver"><i class="fas fa-eye"></i></button>
            </td>` : '')}
        </tr>`;
    }).join('');
}

function filtrarComunicados() {
    const rol = (USUARIO.rol || '').toLowerCase();
    const esAdmin = ['server_admin', 'rector', 'coordinador'].includes(rol);
    const tipo = document.getElementById('filtro-com-tipo').value;
    const audienciaEl = document.getElementById('filtro-com-audiencia');
    const audiencia = audienciaEl ? audienciaEl.value : '';
    const prioridad = document.getElementById('filtro-com-prioridad').value;

    let filtrados = comunicadosCargados.filter(c => {
        if (tipo && c.tipo_comunicado !== tipo) return false;
        if (audiencia && c.audiencia !== audiencia) return false;
        if (prioridad && c.prioridad !== prioridad) return false;
        return true;
    });

    renderTablaComunicados(filtrados, esAdmin);
}

function limpiarFiltrosCom() {
    document.getElementById('filtro-com-tipo').value = '';
    const audienciaEl = document.getElementById('filtro-com-audiencia');
    if (audienciaEl) audienciaEl.value = '';
    document.getElementById('filtro-com-prioridad').value = '';
    filtrarComunicados();
}

function verComunicado(id) {
    const c = comunicadosCargados.find(x => x.id_comunicado === id);
    if (!c) return mostrarAlerta('Comunicado no encontrado', 'error');

    const prioridadColor = { 'Urgente': '#e53935', 'Alta': '#D4AF37', 'Media': '#D4AF37', 'Baja': '#43a047' }[c.prioridad] || '#888';
    document.getElementById('ver-comunicado-body').innerHTML = `
        <div class="comunicado-resumen">
            <div class="comunicado-resumen-icono"><i class="fas fa-envelope-open-text"></i></div>
            <div class="comunicado-resumen-texto">
                <h3>${c.titulo}</h3>
                <p>${c.audiencia}</p>
            </div>
        </div>
        <div class="comunicado-chips">
            <span class="badge badge-azul">${c.tipo_comunicado}</span>
            <span class="badge badge-gris">${c.audiencia}</span>
            <span class="badge" style="background:${prioridadColor};color:#fff;">${c.prioridad}</span>
            <span class="badge ${c.activo ? 'badge-verde' : 'badge-gris'}">${c.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
        <div class="comunicado-contenido">
            ${c.contenido}
        </div>
        <div class="comunicado-meta">
            <span><i class="fas fa-calendar"></i> Publicado: ${new Date(c.fecha_publicacion).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            ${c.autor_nombre ? `<span><i class="fas fa-user"></i> ${c.autor_nombre} ${c.autor_apellido || ''}</span>` : ''}
        </div>
    `;
    document.getElementById('modal-ver-comunicado').classList.add('active');
}

function abrirModalComunicado(id = null) {
    document.getElementById('com-id').value = '';
    document.getElementById('com-titulo').value = '';
    document.getElementById('com-tipo').value = 'Información';
    document.getElementById('com-audiencia').value = 'Todos';
    document.getElementById('com-prioridad').value = 'Media';
    document.getElementById('com-contenido').value = '';

    if (id) {
        const c = comunicadosCargados.find(x => x.id_comunicado === id);
        if (c) {
            document.getElementById('modal-comunicado-titulo').innerHTML = '<i class="fas fa-edit"></i> Editar Comunicado';
            document.getElementById('com-id').value = c.id_comunicado;
            document.getElementById('com-titulo').value = c.titulo;
            document.getElementById('com-tipo').value = c.tipo_comunicado;
            document.getElementById('com-audiencia').value = c.audiencia;
            document.getElementById('com-prioridad').value = c.prioridad;
            document.getElementById('com-contenido').value = c.contenido;
        }
    } else {
        document.getElementById('modal-comunicado-titulo').innerHTML = '<i class="fas fa-bullhorn"></i> Nuevo Comunicado';
    }
    document.getElementById('modal-comunicado').classList.add('active');
}

function editarComunicado(id) {
    abrirModalComunicado(id);
}

async function guardarComunicado(e) {
    e.preventDefault();
    const id = document.getElementById('com-id').value;
    const datos = {
        titulo: document.getElementById('com-titulo').value.trim(),
        contenido: document.getElementById('com-contenido').value.trim(),
        tipo_comunicado: document.getElementById('com-tipo').value,
        audiencia: document.getElementById('com-audiencia').value,
        prioridad: document.getElementById('com-prioridad').value
    };

    if (!datos.titulo || !datos.contenido) {
        return mostrarAlerta('Título y contenido son obligatorios', 'error');
    }

    try {
        const url = id ? `/api/comunicados/${id}` : '/api/comunicados';
        const method = id ? 'PUT' : 'POST';
        await API.request(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        mostrarAlerta(id ? 'Comunicado actualizado' : 'Comunicado creado', 'success');
        cerrarModal('modal-comunicado');
        cargarComunicados();
    } catch (err) {
        mostrarAlerta(err.message || 'Error al guardar comunicado', 'error');
    }
}

async function eliminarComunicado(id) {
    document.getElementById('btn-confirmar-eliminar-com').onclick = async () => {
        cerrarModal('modal-eliminar-comunicado');
        try {
            await API.request(`/api/comunicados/${id}`, { method: 'DELETE' });
            mostrarAlerta('Comunicado eliminado', 'success');
            cargarComunicados();
        } catch (err) {
            mostrarAlerta(err.message || 'Error al eliminar comunicado', 'error');
        }
    };
    document.getElementById('modal-eliminar-comunicado').classList.add('active');
}
