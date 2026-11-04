// ════════════════════════════════════════════════════════════════════════════════
// API CLIENT
// Funciones para conectar con el backend
// ════════════════════════════════════════════════════════════════════════════════

const API = {
    // ═══════════════════════════════════════════════════════════════════
    // UTILIDADES
    // ═══════════════════════════════════════════════════════════════════
    async request(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });
            let data;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                // Si no es JSON, probablemente es HTML de error
                const text = await response.text();
                throw new Error('Respuesta inesperada del servidor: ' + text.substring(0, 120));
            }
            if (!response.ok) {
                throw new Error(data.error || 'Error en la solicitud');
            }
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════════════════════════
    async getDashboardStats() {
        return this.request('/api/dashboard/stats');
    },

    // ═══════════════════════════════════════════════════════════════════
    // USUARIOS
    // ═══════════════════════════════════════════════════════════════════
    async getUsuarios() {
        return this.request('/api/usuarios');
    },

    async getUsuario(id) {
        return this.request(`/api/usuarios/${id}`);
    },

    async crearUsuario(data) {
        return this.request('/api/usuarios', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async actualizarUsuario(id, data) {
        return this.request(`/api/usuarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async eliminarUsuario(id) {
        return this.request(`/api/usuarios/${id}`, {
            method: 'DELETE'
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // ESTUDIANTES
    // ═══════════════════════════════════════════════════════════════════
    async getEstudiantes() {
        return this.request('/api/estudiantes');
    },

    async getEstudiante(id) {
        return this.request(`/api/estudiantes/${id}`);
    },

    async crearEstudiante(data) {
        return this.request('/api/estudiantes', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async actualizarEstudiante(id, data) {
        return this.request(`/api/estudiantes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async eliminarEstudiante(id) {
        return this.request(`/api/estudiantes/${id}`, {
            method: 'DELETE'
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // DOCENTES
    // ═══════════════════════════════════════════════════════════════════
    async getDocentes() {
        return this.request('/api/docentes');
    },

    async actualizarEstadoDocente(id, isActivo) {
        return this.request(`/api/docentes/${id}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ is_activo: Boolean(isActivo) })
        });
    },

    async getDocenteAsignaciones(id) {
        return this.request(`/api/docentes/${id}/asignaciones`);
    },

    async getDocentesDisponibles() {
        return this.request('/api/docentes/disponibles');
    },

    async getDocenteGradosGrupos(id) {
        return this.request(`/api/docentes/${id}/grados-grupos`);
    },

    async getAsignacionesGrado(gradoId) {
        return this.request(`/api/horarios/asignaciones-grado/${gradoId}`);
    },

    async guardarAsignacionesDocente(id, asignaciones) {
        return this.request(`/api/docentes/${id}/asignaciones`, {
            method: 'POST',
            body: JSON.stringify({ asignaciones })
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // GRADOS Y GRUPOS
    // ═══════════════════════════════════════════════════════════════════
    async getGrados() {
        return this.request('/api/grados');
    },

    async crearGrado(data) {
        return this.request('/api/grados', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async actualizarGrado(id, data) {
        return this.request(`/api/grados/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async eliminarGrado(id) {
        return this.request(`/api/grados/${id}`, {
            method: 'DELETE'
        });
    },

    async getGrupos() {
        return this.request('/api/grupos');
    },

    async crearGrupo(data) {
        return this.request('/api/grupos', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async actualizarGrupo(id, data) {
        return this.request(`/api/grupos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async eliminarGrupo(id) {
        return this.request(`/api/grupos/${id}`, {
            method: 'DELETE'
        });
    },

    async getGrupoEstudiantes(id) {
        return this.request(`/api/grupos/${id}/estudiantes`);
    },

    // ═══════════════════════════════════════════════════════════════════
    // MATERIAS
    // ═══════════════════════════════════════════════════════════════════
    async getMaterias() {
        return this.request('/api/materias');
    },

    async crearMateria(data) {
        return this.request('/api/materias', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // PERÍODOS
    // ═══════════════════════════════════════════════════════════════════
    async getPeriodos() {
        return this.request('/api/periodos');
    },

    async crearPeriodo(data) {
        return this.request('/api/periodos', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async actualizarPeriodo(id, data) {
        return this.request(`/api/periodos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async cambiarEstadoPeriodo(id, estado) {
        return this.request(`/api/periodos/${id}/estado`, {
            method: 'PUT',
            body: JSON.stringify({ estado })
        });
    },

    async getResumenPeriodos(periodoId) {
        return this.request(`/api/periodos/resumen?periodo_id=${periodoId}`);
    },

    // ═══════════════════════════════════════════════════════════════════
    // HORARIOS
    // ═══════════════════════════════════════════════════════════════════
    async getHorarios(grupoId = null) {
        const url = grupoId ? `/api/horarios?grupo_id=${grupoId}` : '/api/horarios';
        return this.request(url);
    },

    async getHorario(id) {
        return this.request(`/api/horarios/${id}`);
    },

    async crearHorario(data) {
        return this.request('/api/horarios', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async actualizarHorario(id, data) {
        return this.request(`/api/horarios/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async eliminarHorario(id) {
        return this.request(`/api/horarios/${id}`, {
            method: 'DELETE'
        });
    },

    async getAsignacionesGrupo(grupoId) {
        return this.request(`/api/horarios/asignaciones-grupo/${grupoId}`);
    },

    async getNiveles() {
        return this.request('/api/niveles');
    },

    // ═══════════════════════════════════════════════════════════════════
    // CALIFICACIONES
    // ═══════════════════════════════════════════════════════════════════
    async getCalificaciones(grupoId = null, materiaId = null, periodoId = null) {
        let url = '/api/calificaciones?';
        if (grupoId) url += `grupo_id=${grupoId}&`;
        if (materiaId) url += `materia_id=${materiaId}&`;
        if (periodoId) url += `periodo_id=${periodoId}&`;
        return this.request(url);
    },

    async getActividades(grupoId = null, materiaId = null) {
        let url = '/api/actividades?';
        if (grupoId) url += `grupo_id=${grupoId}&`;
        if (materiaId) url += `materia_id=${materiaId}&`;
        return this.request(url);
    },

    // ═══════════════════════════════════════════════════════════════════
    // DESCARGAS POR PERÍODO (FASE 2)
    // ═══════════════════════════════════════════════════════════════════
    async listarArchivosPeriodo(periodoId) {
        return this.request(`/api/calificaciones/periodos/${periodoId}/listar`);
    },

    async descargarArchivoPeriodo(periodoId, rutaRelativa) {
        const url = `/api/calificaciones/periodos/descargar_archivo?periodo_id=${periodoId}&ruta=${encodeURIComponent(rutaRelativa)}`;
        window.location.href = url;
        return { status: 'ok', message: 'Descarga iniciada' };
    },

    async descargarZipPeriodo(periodoId) {
        const url = `/api/calificaciones/periodos/${periodoId}/descargar_zip`;
        window.location.href = url;
        return { status: 'ok', message: 'Descarga de ZIP iniciada' };
    },

    // ═══════════════════════════════════════════════════════════════════
    // ASISTENCIA
    // ═══════════════════════════════════════════════════════════════════
    async getAsistencia(grupoId = null, fecha = null) {
        let url = '/api/asistencia?';
        if (grupoId) url += `grupo_id=${grupoId}&`;
        if (fecha) url += `fecha=${fecha}&`;
        return this.request(url);
    },

    async registrarAsistencia(registros) {
        return this.request('/api/asistencia', {
            method: 'POST',
            body: JSON.stringify({ registros })
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // OBSERVADOR
    // ═══════════════════════════════════════════════════════════════════
    async getObservaciones(estudianteId = null) {
        const url = estudianteId ? `/api/observador?estudiante_id=${estudianteId}` : '/api/observador';
        return this.request(url);
    },

    async crearObservacion(data) {
        return this.request('/api/observador', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async actualizarObservacion(id, data) {
        return this.request(`/api/observador/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async eliminarObservacion(id) {
        return this.request(`/api/observador/${id}`, {
            method: 'DELETE'
        });
    },

    getFormatoObservadorPdfUrl(id = null) {
        return id ? `/api/observador/${id}/formato.pdf` : '/api/observador/formato.pdf';
    },

    // ═══════════════════════════════════════════════════════════════════
    // COMUNICADOS
    // ═══════════════════════════════════════════════════════════════════
    async getComunicados() {
        return this.request('/api/comunicados');
    },

    async crearComunicado(data) {
        return this.request('/api/comunicados', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // LOGS
    // ═══════════════════════════════════════════════════════════════════
    async getLogs() {
        return this.request('/api/logs');
    },

    // ═══════════════════════════════════════════════════════════════════
    // DOCENTE - SECCIONES EXCLUSIVAS
    // ═══════════════════════════════════════════════════════════════════
    async getMisMaterias() {
        return this.request('/api/docente/mis-materias');
    },

    async getMiHorario() {
        return this.request('/api/docente/mi-horario');
    },

    // ═══════════════════════════════════════════════════════════════════
    // REPORTES
    // ═══════════════════════════════════════════════════════════════════
    async getGruposReportes() {
        return this.request('/api/reportes/grupos');
    },

    async getCorreosPorGrupo(idGrupo) {
        return this.request(`/api/reportes/correos-grupo/${idGrupo}`);
    },

    async enviarReportePorCorreo(data) {
        return this.request('/api/reportes/enviar-correo', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async sincronizarBoletinesGrupo(data) {
        return this.request('/api/boletines/sincronizar-grupo', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async enviarBoletinesGrupo(data) {
        return this.request('/api/boletines/enviar-grupo', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async sincronizarBoletinesTodo(data = {}) {
        return this.request('/api/boletines/sincronizar-todo', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    // ROLES
    // ═══════════════════════════════════════════════════════════════════
    async getRoles() {
        return this.request('/api/roles');
    },

    
};
