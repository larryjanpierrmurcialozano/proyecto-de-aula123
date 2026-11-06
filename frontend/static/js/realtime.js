// Actualiza el módulo visible cuando otro usuario modifica datos.

const ACTUALIZACION_INTERVALO_MS = 4000;
let ACTUALIZACION_VERSION = null;
let ACTUALIZACION_EN_CURSO = false;
let ACTUALIZACION_PENDIENTE = false;

const MODULOS_ACTUALIZABLES = {
    dashboard: () => renderDashboard(),
    usuarios: () => renderUsuarios(),
    estudiantes: () => renderEstudiantes(),
    docentes: () => renderDocentes(),
    grados: () => renderGrados(),
    materias: () => renderMaterias(),
    comunicados: () => renderComunicados(),
    reportes: () => renderReportes(),
    horarios: () => renderHorarios(),
    'horarios-gestion': () => renderHorariosGestion(),
    periodos: () => renderPeriodos(),
    asistencia: () => renderAsistencia(),
    observador: () => renderObservador(),
    logs: () => renderLogs(),
    'mi-horario': () => renderMiHorario(),
    calificaciones: () => window.CalificacionesModule?.init()
};

function iniciarSincronizacionDeVistas() {
    consultarVersionDeDatos();
    window.setInterval(consultarVersionDeDatos, ACTUALIZACION_INTERVALO_MS);
}

async function consultarVersionDeDatos() {
    if (ACTUALIZACION_EN_CURSO) return;
    try {
        const respuesta = await fetch('/api/actualizaciones/estado', {
            credentials: 'same-origin',
            cache: 'no-store'
        });
        if (!respuesta.ok) return;
        const datos = await respuesta.json();
        const version = Number(datos.version || 0);

        if (ACTUALIZACION_VERSION === null) {
            ACTUALIZACION_VERSION = version;
            return;
        }
        if (version <= ACTUALIZACION_VERSION) {
            if (ACTUALIZACION_PENDIENTE && !hayModalAbierto()) actualizarModuloVisible();
            return;
        }

        ACTUALIZACION_VERSION = version;
        actualizarModuloVisible();
    } catch (error) {
        console.warn('No se pudo consultar la sincronización de vistas:', error);
    }
}

function actualizarModuloVisible() {
    const pagina = window.PAGINA_ACTUAL;
    const actualizar = MODULOS_ACTUALIZABLES[pagina];
    if (!actualizar || !document.getElementById('main-content')) return;

    if (hayModalAbierto()) {
        ACTUALIZACION_PENDIENTE = true;
        mostrarAlerta('Hay cambios nuevos. Se actualizará al cerrar el formulario.', 'info');
        return;
    }

    ACTUALIZACION_EN_CURSO = true;
    Promise.resolve(actualizar())
        .finally(() => {
            ACTUALIZACION_EN_CURSO = false;
            ACTUALIZACION_PENDIENTE = false;
        });
}

function hayModalAbierto() {
    return Boolean(document.querySelector('.modal-overlay.active, .modal-overlay[style*="display: flex"]'));
}

window.addEventListener('load', iniciarSincronizacionDeVistas);
