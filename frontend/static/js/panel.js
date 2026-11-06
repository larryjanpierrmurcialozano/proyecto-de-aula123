// ════════════════════════════════════════════════════════════════════════════════
// DOCSTRY - PANEL CORE
// Inicialización, estado global, sidebar, navegación, modales, perfil, sesión
// ════════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════
// ESTADO GLOBAL
// ═══════════════════════════════════════════════════════════════════
let USUARIO = {
    id: null,
    nombre: '',
    email: '',
    rol: ''
};

// Permisos por rol (módulos visibles para cada rol)
const PERMISOS = {
    'server_admin': ['dashboard', 'usuarios', 'estudiantes', 'docentes', 'horarios-gestion', 'grados', 'materias', 'horarios', 'periodos', 'calificaciones', 'asistencia', 'observador', 'comunicados', 'reportes', 'logs'],
    'rector': ['dashboard', 'usuarios', 'estudiantes', 'docentes', 'horarios-gestion', 'grados', 'materias', 'horarios', 'periodos', 'calificaciones', 'asistencia', 'observador', 'comunicados', 'reportes', 'logs'],
    'coordinador': ['dashboard', 'usuarios', 'estudiantes', 'docentes', 'horarios-gestion', 'grados', 'materias', 'horarios', 'periodos', 'calificaciones', 'asistencia', 'observador', 'comunicados', 'reportes', 'logs'],
    'docente': ['dashboard', 'mi-horario', 'calificaciones', 'asistencia', 'observador', 'comunicados', 'reportes'],
    'profesor': ['dashboard', 'mi-horario', 'calificaciones', 'asistencia', 'observador', 'comunicados', 'reportes']
};

// ═══════════════════════════════════════════════════════════════════
// FUNCIONES DE ROL
// ═══════════════════════════════════════════════════════════════════
function getPermisosUsuario() {
    const rol = USUARIO.rol ? USUARIO.rol.toLowerCase() : '';
    return PERMISOS[rol] || PERMISOS['docente'] || PERMISOS['profesor'] || [];
}

function esDocente() {
    const rol = USUARIO.rol ? USUARIO.rol.toLowerCase() : '';
    return rol === 'docente' || rol === 'profesor';
}

function esAdmin() {
    const rol = USUARIO.rol ? USUARIO.rol.toLowerCase() : '';
    return rol === 'server_admin' || rol === 'rector';
}

// ═══════════════════════════════════════════════════════════════════
// TOASTS (NOTIFICACIONES)
// ═══════════════════════════════════════════════════════════════════
(function initToastContainer() {
    if (!document.getElementById('toast-container')) {
        const c = document.createElement('div');
        c.id = 'toast-container';
        c.className = 'toast-container';
        document.body.appendChild(c);
    }
})();

function mostrarAlerta(mensaje, tipo = 'info', tiempo = 4500) {
    const container = document.getElementById('toast-container');
    if (!container) return alert(mensaje);

    const tipoNormalizado = tipo === 'exito' ? 'success' : tipo;

    const toast = document.createElement('div');
    toast.className = `toast ${tipoNormalizado}`;
    toast.innerHTML = `
        <div class="icon">${tipoNormalizado === 'success' ? '<i class="fas fa-check"></i>' : tipoNormalizado === 'error' ? '<i class="fas fa-exclamation-triangle"></i>' : '<i class="fas fa-info-circle"></i>'}</div>
        <div class="message">${mensaje}</div>
        <button class="close-btn" aria-label="Cerrar">&times;</button>
    `;
    container.appendChild(toast);
    const remove = () => { if (toast.parentNode) toast.parentNode.removeChild(toast); };
    toast.querySelector('.close-btn').addEventListener('click', remove);
    setTimeout(remove, tiempo);
}

// ═══════════════════════════════════════════════════════════════════
// MODALES
// ═══════════════════════════════════════════════════════════════════
function abrirModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
    }
}

function cerrarModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = '';
    }
}

// ═══════════════════════════════════════════════════════════════════
// MENÚ SIDEBAR
// ═══════════════════════════════════════════════════════════════════
function getMenuItems() {
    const rol = USUARIO.rol ? USUARIO.rol.toLowerCase() : '';

    if (rol === 'server_admin') {
        return [
            { seccion: 'PRINCIPAL', items: [
                { id: 'dashboard', icono: 'fa-home', texto: 'Menú Principal' }
            ]},
            { seccion: 'GESTIÓN', items: [
                { id: 'usuarios', icono: 'fa-users', texto: 'Usuarios' },
                { id: 'estudiantes', icono: 'fa-user-graduate', texto: 'Estudiantes' },
                { id: 'docentes', icono: 'fa-chalkboard-teacher', texto: 'Docentes' },
                { id: 'horarios-gestion', icono: 'fa-user-clock', texto: 'Horarios Docentes' }
            ]},
            { seccion: 'ACADÉMICO', items: [
                { id: 'grados', icono: 'fa-layer-group', texto: 'Grados y Grupos' },
                { id: 'materias', icono: 'fa-book', texto: 'Materias' },
                { id: 'horarios', icono: 'fa-clock', texto: 'Horarios' },
                { id: 'periodos', icono: 'fa-calendar-alt', texto: 'Períodos' }
            ]},
            { seccion: 'EVALUACIÓN', items: [
                { id: 'calificaciones', icono: 'fa-star', texto: 'Calificaciones' },
                { id: 'asistencia', icono: 'fa-clipboard-check', texto: 'Asistencia' },
                { id: 'observador', icono: 'fa-eye', texto: 'Observador' }
            ]},
            { seccion: 'COMUNICACIÓN', items: [
                { id: 'comunicados', icono: 'fa-bullhorn', texto: 'Comunicados' }
            ]},
            { seccion: 'REPORTES', items: [
                { id: 'reportes', icono: 'fa-file-pdf', texto: 'Reportes' }
            ]},
            { seccion: 'SISTEMA', items: [
                { id: 'logs', icono: 'fa-history', texto: 'Auditoria' }
            ]}
        ];
    }

    if (esDocente()) {
        return [
            { seccion: 'PRINCIPAL', items: [
                { id: 'dashboard', icono: 'fa-home', texto: 'Menú Principal' }
            ]},
            { seccion: 'MI ESPACIO', items: [
                { id: 'mi-horario', icono: 'fa-calendar-week', texto: 'Mi Horario' }
            ]},
            { seccion: 'EVALUACIÓN', items: [
                { id: 'calificaciones', icono: 'fa-star', texto: 'Calificaciones' },
                { id: 'asistencia', icono: 'fa-clipboard-check', texto: 'Asistencia' },
                { id: 'observador', icono: 'fa-eye', texto: 'Observador' }
            ]},
            { seccion: 'COMUNICACIÓN', items: [
                { id: 'comunicados', icono: 'fa-bullhorn', texto: 'Comunicados' }
            ]},
            { seccion: 'REPORTES', items: [
                { id: 'reportes', icono: 'fa-file-pdf', texto: 'Reportes' }
            ]}
        ];
    }

    // Admin/Rector/Coordinador
    return [
        { seccion: 'PRINCIPAL', items: [
            { id: 'dashboard', icono: 'fa-home', texto: 'Menú Principal' }
        ]},
        { seccion: 'GESTIÓN', items: [
            { id: 'usuarios', icono: 'fa-users', texto: 'Usuarios' },
            { id: 'estudiantes', icono: 'fa-user-graduate', texto: 'Estudiantes' },
            { id: 'docentes', icono: 'fa-chalkboard-teacher', texto: 'Docentes' },
            { id: 'horarios-gestion', icono: 'fa-user-clock', texto: 'Horarios Docentes' }
        ]},
        { seccion: 'ACADÉMICO', items: [
            { id: 'grados', icono: 'fa-layer-group', texto: 'Grados y Grupos' },
            { id: 'materias', icono: 'fa-book', texto: 'Materias' },
            { id: 'horarios', icono: 'fa-clock', texto: 'Horarios' },
            { id: 'periodos', icono: 'fa-calendar-alt', texto: 'Períodos' }
        ]},
        { seccion: 'EVALUACIÓN', items: [
            { id: 'calificaciones', icono: 'fa-star', texto: 'Calificaciones' },
            { id: 'asistencia', icono: 'fa-clipboard-check', texto: 'Asistencia' },
            { id: 'observador', icono: 'fa-eye', texto: 'Observador' }
        ]},
        { seccion: 'COMUNICACIÓN', items: [
            { id: 'comunicados', icono: 'fa-bullhorn', texto: 'Comunicados' }
        ]},
        { seccion: 'REPORTES', items: [
            { id: 'reportes', icono: 'fa-file-pdf', texto: 'Reportes' }
        ]},
        { seccion: 'SISTEMA', items: [
            { id: 'logs', icono: 'fa-history', texto: 'Auditoria' }
        ]}
    ];
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    await cargarUsuario();
    generarSidebar();
    cargarPagina('dashboard');
    configurarEventos();
});

async function cargarUsuario() {
    try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();

        if (!data.authenticated) {
            window.location.href = '/login';
            return;
        }

        USUARIO.id = data.user_id;
        USUARIO.nombre = data.user_name;
        USUARIO.email = data.user_email;
        USUARIO.rol = data.user_role;

        document.getElementById('user-name').textContent = USUARIO.nombre;
        document.getElementById('user-role').textContent = USUARIO.rol;
    } catch (e) {
        console.error('Error:', e);
        window.location.href = '/login';
    }
}

function generarSidebar() {
    const permisos = getPermisosUsuario();
    const menu = getMenuItems();
    let html = '';

    menu.forEach(seccion => {
        const itemsVisibles = seccion.items.filter(i => permisos.includes(i.id));
        if (itemsVisibles.length > 0) {
            html += `<li class="sidebar-label">${seccion.seccion}</li>`;
            itemsVisibles.forEach(item => {
                html += `
                        <li class="sidebar-item" data-page="${item.id}" title="${item.texto}" aria-label="${item.texto}">
                        <i class="fas ${item.icono}"></i>
                            <span>${item.texto}</span>
                    </li>
                `;
            });
        }
    });

    document.getElementById('sidebar-menu').innerHTML = html;
}

function configurarEventos() {
    // Navegación sidebar
    document.getElementById('sidebar-menu').addEventListener('click', (e) => {
        const item = e.target.closest('.sidebar-item');
        if (item) {
            const pagina = item.dataset.page;
            cargarPagina(pagina);
            document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        }
    });

    // Dropdown
    document.getElementById('btn-dropdown').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('dropdown-menu').classList.toggle('active');
    });

    document.addEventListener('click', () => {
        document.getElementById('dropdown-menu').classList.remove('active');
    });
}

// ═══════════════════════════════════════════════════════════════════
// NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════════
const TITULOS_PAGINAS = {
    'dashboard': 'Menú Principal',
    'usuarios': 'Usuarios',
    'estudiantes': 'Estudiantes',
    'docentes': 'Docentes',
    'grados': 'Grados y Grupos',
    'materias': 'Materias',
    'horarios': 'Horarios',
    'horarios-gestion': 'Horarios Docentes',
    'periodos': 'Períodos',
    'calificaciones': 'Calificaciones',
    'asistencia': 'Asistencia',
    'observador': 'Observador',
    'comunicados': 'Comunicados',
    'reportes': 'Reportes',
    'logs': 'Logs del Sistema',
    'mi-horario': 'Mi Horario'
};

function cargarPagina(pagina) {
    window.PAGINA_ACTUAL = pagina;
    const permisos = getPermisosUsuario();

    if (pagina !== 'dashboard' && !permisos.includes(pagina)) {
        mostrarAlerta('No tienes permiso para acceder a esta sección', 'error');
        cargarPagina('dashboard');
        return;
    }

    document.getElementById('page-title').textContent = TITULOS_PAGINAS[pagina] || pagina.charAt(0).toUpperCase() + pagina.slice(1);

    const content = document.getElementById('main-content');
    content.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i></div>';

    switch (pagina) {
        case 'dashboard':       renderDashboard(); break;
        case 'usuarios':        renderUsuarios(); break;
        case 'estudiantes':     renderEstudiantes(); break;
        case 'docentes':        renderDocentes(); break;
        case 'grados':          renderGrados(); break;
        case 'materias':        renderMaterias(); break;
        case 'comunicados':     renderComunicados(); break;
        case 'reportes':        renderReportes(); break;
        case 'calificaciones':  if (window.CalificacionesModule) { window.CalificacionesModule.init(); } else { renderPlaceholder('Calificaciones (Cargando...)', 'fa-star'); } break;
        // Módulos en desarrollo
        case 'horarios':        renderHorarios(); break;
        case 'horarios-gestion': renderHorariosGestion(); break;
        case 'periodos':        if (typeof renderPeriodos === 'function') { renderPeriodos(); } else { renderPlaceholder('Gestión de Períodos (Cargando...)', 'fa-calendar-alt'); } break;
        case 'asistencia':      if (typeof renderAsistencia === 'function') { renderAsistencia(); } else { renderPlaceholder('Control de Asistencia (Cargando...)', 'fa-clipboard-check'); } break;
        case 'observador':      if (typeof renderObservador === 'function') { renderObservador(); } else { renderPlaceholder('Observador del Estudiante (Cargando...)', 'fa-eye'); } break;
        case 'logs':            if (typeof renderLogs === 'function') { renderLogs(); } else { renderPlaceholder('Logs del Sistema', 'fa-history'); } break;
        case 'mi-horario':      if (typeof renderMiHorario === 'function') { renderMiHorario(); } else { renderPlaceholder('Mi Horario (Cargando...)', 'fa-calendar-week'); } break;
        default:
            content.innerHTML = `
                <div class="card">
                    <h2 class="card-title">${pagina.charAt(0).toUpperCase() + pagina.slice(1)}</h2>
                    <p style="color: var(--cafe-claro);">Esta sección está en desarrollo.</p>
                </div>
            `;
    }
}

function renderPlaceholder(titulo, icono) {
    document.getElementById('main-content').innerHTML = Helpers.enDesarrollo(titulo, icono);
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function renderDashboard() {
    const content = document.getElementById('main-content');
    const permisos = getPermisosUsuario();
    const rol = USUARIO.rol ? USUARIO.rol.toLowerCase() : '';

    let secciones = [];

    if (rol === 'server_admin') {
        secciones = [
            { id: 'usuarios', icono: 'fa-users', titulo: 'Usuarios', descripcion: 'Gestiona los usuarios del sistema: administradores, rectores, coordinadores y profesores.' },
            { id: 'estudiantes', icono: 'fa-user-graduate', titulo: 'Estudiantes', descripcion: 'Administra la información de los estudiantes, sus datos personales y acudientes.' },
            { id: 'docentes', icono: 'fa-chalkboard-teacher', titulo: 'Docentes', descripcion: 'Gestiona los docentes y sus asignaciones de materias por grado.' },
            { id: 'grados', icono: 'fa-layer-group', titulo: 'Grados y Grupos', descripcion: 'Configura los grados académicos y sus grupos con capacidades.' },
            { id: 'materias', icono: 'fa-book', titulo: 'Materias', descripcion: 'Administra las materias, su intensidad horaria y descripción.' },
            { id: 'horarios', icono: 'fa-clock', titulo: 'Horarios', descripcion: 'Visualiza y gestiona los horarios de clases por grupo.' },
            { id: 'horarios-gestion', icono: 'fa-calendar-alt', titulo: 'Horarios Docentes', descripcion: 'Consulta los horarios de docentes por grado y grupo, permite descargar en Excel o PDF.' },
            { id: 'periodos', icono: 'fa-calendar-alt', titulo: 'Períodos', descripcion: 'Configura los períodos académicos del año escolar.' },
            { id: 'calificaciones', icono: 'fa-star', titulo: 'Calificaciones', descripcion: 'Registra y consulta las notas de los estudiantes por actividad.' },
            { id: 'asistencia', icono: 'fa-clipboard-check', titulo: 'Asistencia', descripcion: 'Control diario de asistencia de estudiantes por grupo.' },
            { id: 'observador', icono: 'fa-eye', titulo: 'Observador', descripcion: 'Registra observaciones positivas, negativas o neutras de estudiantes.' },
            { id: 'comunicados', icono: 'fa-bullhorn', titulo: 'Comunicados', descripcion: 'Publica circulares, avisos e información para la comunidad.' },
            { id: 'reportes', icono: 'fa-file-pdf', titulo: 'Reportes', descripcion: 'Genera boletines, consolidados y reportes institucionales.' },
            { id: 'logs', icono: 'fa-history', titulo: 'Auditoría', descripcion: 'Consulta el historial de acciones realizadas en el sistema.' },
            { id: 'mis-materias', icono: 'fa-book-open', titulo: 'Mis Materias (Vista Docente)', descripcion: 'Vista previa de cómo ven los docentes sus materias.' },
            { id: 'mi-horario', icono: 'fa-calendar-week', titulo: 'Mi Horario (Vista Docente)', descripcion: 'Vista previa del horario personal del docente.' }
        ];
    } else if (esDocente()) {
        secciones = [
            { id: 'mis-materias', icono: 'fa-book-open', titulo: 'Mis Materias', descripcion: 'Consulta las materias que tienes asignadas con sus detalles.' },
            { id: 'mi-horario', icono: 'fa-calendar-week', titulo: 'Mi Horario', descripcion: 'Revisa tu horario semanal de clases organizado por día.' },
            { id: 'estudiantes', icono: 'fa-user-graduate', titulo: 'Estudiantes', descripcion: 'Consulta información de los estudiantes de tus grupos.' },
            { id: 'periodos', icono: 'fa-calendar-alt', titulo: 'Períodos', descripcion: 'Consulta los períodos académicos y su estado actual.' },
            { id: 'calificaciones', icono: 'fa-star', titulo: 'Calificaciones', descripcion: 'Registra y consulta las notas de tus estudiantes.' },
            { id: 'asistencia', icono: 'fa-clipboard-check', titulo: 'Asistencia', descripcion: 'Control diario de asistencia de tus grupos.' },
            { id: 'observador', icono: 'fa-eye', titulo: 'Observador', descripcion: 'Registra observaciones de tus estudiantes.' },
            { id: 'comunicados', icono: 'fa-bullhorn', titulo: 'Comunicados', descripcion: 'Lee los comunicados y avisos de la institución.' },
            { id: 'reportes', icono: 'fa-file-pdf', titulo: 'Reportes', descripcion: 'Genera reportes de tus grupos y estudiantes.' }
        ];
    } else {
        secciones = [
            { id: 'usuarios', icono: 'fa-users', titulo: 'Usuarios', descripcion: 'Gestiona los usuarios del sistema: administradores, rectores, coordinadores y profesores.' },
            { id: 'estudiantes', icono: 'fa-user-graduate', titulo: 'Estudiantes', descripcion: 'Administra la información de los estudiantes, sus datos personales y acudientes.' },
            { id: 'docentes', icono: 'fa-chalkboard-teacher', titulo: 'Docentes', descripcion: 'Gestiona los docentes y sus asignaciones de materias por grado.' },
            { id: 'grados', icono: 'fa-layer-group', titulo: 'Grados y Grupos', descripcion: 'Configura los grados académicos y sus grupos con capacidades.' },
            { id: 'materias', icono: 'fa-book', titulo: 'Materias', descripcion: 'Administra las materias, su intensidad horaria y descripción.' },
            { id: 'horarios', icono: 'fa-clock', titulo: 'Horarios', descripcion: 'Visualiza y gestiona los horarios de clases por grupo.' },
            { id: 'horarios-gestion', icono: 'fa-calendar-alt', titulo: 'Horarios Docentes', descripcion: 'Consulta los horarios de docentes por grado y grupo, permite descargar en Excel o PDF.' },
            { id: 'periodos', icono: 'fa-calendar-alt', titulo: 'Períodos', descripcion: 'Configura los períodos académicos del año escolar.' },
            { id: 'calificaciones', icono: 'fa-star', titulo: 'Calificaciones', descripcion: 'Registra y consulta las notas de los estudiantes por actividad.' },
            { id: 'asistencia', icono: 'fa-clipboard-check', titulo: 'Asistencia', descripcion: 'Control diario de asistencia de estudiantes por grupo.' },
            { id: 'observador', icono: 'fa-eye', titulo: 'Observador', descripcion: 'Registra observaciones positivas, negativas o neutras de estudiantes.' },
            { id: 'comunicados', icono: 'fa-bullhorn', titulo: 'Comunicados', descripcion: 'Publica circulares, avisos e información para la comunidad.' },
            { id: 'reportes', icono: 'fa-file-pdf', titulo: 'Reportes', descripcion: 'Genera boletines, consolidados y reportes institucionales.' },
            { id: 'logs', icono: 'fa-history', titulo: 'Auditoría', descripcion: 'Consulta el historial de acciones realizadas en el sistema.' }
        ];
    }

    const seccionesVisibles = secciones.filter(s => permisos.includes(s.id));

    let tarjetasHTML = seccionesVisibles.map(s => `
        <div class="dashboard-card" onclick="cargarPagina('${s.id}')">
            <div class="dashboard-card-icon">
                <i class="fas ${s.icono}"></i>
            </div>
            <div class="dashboard-card-content">
                <h3>${s.titulo}</h3>
                <p>${s.descripcion}</p>
            </div>
            <div class="dashboard-card-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');

    content.innerHTML = `
        <div class="card">
            <h2 class="card-title"><i class="fas fa-home"></i> Bienvenido, ${USUARIO.nombre}</h2>
            <p style="color: var(--institutional-green-dark); margin-bottom: 0.5rem;">
                Rol: <strong>${USUARIO.rol}</strong> · Acceso a <strong>${seccionesVisibles.length}</strong> módulos
            </p>
        </div>
        <div class="dashboard-grid">
            ${tarjetasHTML}
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════
// TABS (usado por grados)
// ═══════════════════════════════════════════════════════════════════
function mostrarTab(evtOrTab, tab) {
    let tabName = null;
    let evt = null;
    if (typeof tab === 'undefined') {
        tabName = evtOrTab;
        evt = window.event || null;
    } else {
        evt = evtOrTab;
        tabName = tab;
    }
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    if (evt && evt.target) {
        evt.target.classList.add('active');
    } else {
        const btn = document.querySelector(`.tab-btn[onclick*="'${tabName}'"]`) || document.querySelector('.tab-btn');
        if (btn) btn.classList.add('active');
    }
    const el = document.getElementById('tab-' + tabName);
    if (el) el.classList.add('active');
}

// ═══════════════════════════════════════════════════════════════════
// PERFIL Y SESIÓN
// ═══════════════════════════════════════════════════════════════════
async function mostrarPerfil() {
    document.getElementById('modal-perfil').classList.add('active');

    try {
        const res = await fetch('/api/auth/profile');
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Error al cargar perfil');
        }

        const u = data.usuario || data.user;
        if (!u) {
            throw new Error('Perfil no disponible');
        }

        const iniciales = Helpers.getIniciales(u.nombre, u.apellido);

        document.getElementById('perfil-content').innerHTML = `
            <div class="perfil-resumen">
                <div class="perfil-avatar">${iniciales}</div>
                <div class="perfil-identidad">
                    <h3>${u.nombre} ${u.apellido}</h3>
                    <span class="badge badge-cafe">${u.nombre_rol}</span>
                </div>
            </div>
            <div class="perfil-grid">
                <div class="perfil-item">
                    <label>Nombre completo</label>
                    <div class="perfil-campo">${u.nombre} ${u.apellido}</div>
                </div>
                <div class="perfil-item">
                    <label>Email</label>
                    <div class="perfil-campo">${u.correo}</div>
                </div>
                <div class="perfil-item">
                    <label>Documento</label>
                    <div class="perfil-campo">${u.documento}</div>
                </div>
                <div class="perfil-item">
                    <label>Rol</label>
                    <div class="perfil-campo">${u.nombre_rol}</div>
                </div>
            </div>
        `;
    } catch (e) {
        document.getElementById('perfil-content').innerHTML = `<p class="text-error">${e.message || 'Error al cargar perfil'}</p>`;
    }
}

function mostrarCambiarPassword() {
    document.getElementById('modal-password').classList.add('active');
    document.getElementById('form-password').reset();
}

async function cambiarPassword(e) {
    e.preventDefault();

    const current = document.getElementById('current-password').value;
    const nueva = document.getElementById('new-password').value;
    const confirmar = document.getElementById('confirm-password').value;

    if (Array.from(nueva).length < 6 || !/\p{L}/u.test(nueva) || !/\p{N}/u.test(nueva)) {
        mostrarAlerta('La contraseña debe tener al menos 6 caracteres e incluir letras y números.', 'error');
        return;
    }

    if (nueva !== confirmar) {
        mostrarAlerta('Las contraseñas no coinciden', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ current_password: current, new_password: nueva })
        });
        const data = await res.json();

        if (res.ok) {
            mostrarAlerta('Contraseña actualizada correctamente', 'success');
            cerrarModal('modal-password');
        } else {
            mostrarAlerta(data.error || 'Error al cambiar contraseña', 'error');
        }
    } catch (e) {
        mostrarAlerta('Error de conexión', 'error');
    }
}

function cerrarSesion() {
    document.getElementById('modal-logout').classList.add('active');
}

async function confirmarCerrarSesion() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/bienvenida';
    } catch (e) {
        window.location.href = '/bienvenida';
    }
}
