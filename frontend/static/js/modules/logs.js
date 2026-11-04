//  Logs del sistema
let LOGS_CACHE = [];

async function renderLogs() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const htmlRes = await fetch('/templates/modules html/logs.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de logs');
        content.innerHTML = await htmlRes.text();

        const res = await API.request('/api/logs');
        LOGS_CACHE = res.logs || [];

        _buildLogActionFilter(LOGS_CACHE);
        _renderLogsTable(LOGS_CACHE);

        document.getElementById('buscar-log').addEventListener('input', _applyLogFilters);
        document.getElementById('filtro-accion-log').addEventListener('change', _applyLogFilters);
    } catch (error) {
        console.error('Error renderLogs:', error);
        content.innerHTML = Helpers.error('No se pudieron cargar los logs.');
    }
}

function _buildLogActionFilter(logs) {
    const select = document.getElementById('filtro-accion-log');
    if (!select) return;

    const acciones = Array.from(new Set(logs.map(l => (l.tipo_accion || '').toString().trim()).filter(Boolean)));
    acciones.sort((a, b) => a.localeCompare(b));

    select.innerHTML = '<option value="">Todas las acciones</option>' +
        acciones.map(a => `<option value="${a}">${a}</option>`).join('');
}

function _applyLogFilters() {
    const buscar = (document.getElementById('buscar-log')?.value || '').toLowerCase();
    const accion = document.getElementById('filtro-accion-log')?.value || '';

    const filtrados = LOGS_CACHE.filter(l => {
        const usuario = _formatLogUsuario(l).toLowerCase();
        const descripcion = (l.descripcion || '').toString().toLowerCase();
        const tipo = (l.tipo_accion || '').toString().toLowerCase();
        const tabla = (l.tabla_afectada || l.modulo || '').toString().toLowerCase();
        const registro = (l.registro_id ?? '').toString().toLowerCase();
        const ip = (l.ip_address || l.ip || '').toString().toLowerCase();
        const userAgent = (l.user_agent || '').toString().toLowerCase();
        const exito = l.exito === null || l.exito === undefined ? '' : (Number(l.exito) === 1 ? 'si' : 'no');
        const matchTexto = !buscar || usuario.includes(buscar) || descripcion.includes(buscar) || tipo.includes(buscar)
            || tabla.includes(buscar) || registro.includes(buscar) || ip.includes(buscar) || userAgent.includes(buscar)
            || exito.includes(buscar);
        const matchAccion = !accion || (l.tipo_accion || '') === accion;
        return matchTexto && matchAccion;
    });

    _renderLogsTable(filtrados);
}

function _renderLogsTable(logs) {
    const tbody = document.getElementById('tabla-logs-body');
    if (!tbody) return;

    if (!logs.length) {
        tbody.innerHTML = `<tr><td colspan="5">${Helpers.sinDatos('No hay logs para mostrar')}</td></tr>`;
        return;
    }

    tbody.innerHTML = logs.map(l => {
        const fecha = l.fecha ? Helpers.formatearFechaHora(l.fecha) : '-';
        const usuario = _formatLogUsuario(l);
        const accion = l.tipo_accion || '-';
        const descripcion = l.descripcion || '-';
        const idLog = l.id_log || l.id_log_registro || l.id || l.id_registro || '-';

        return `
            <tr>
                <td>${idLog}</td>
                <td>${fecha}</td>
                <td>${usuario}</td>
                <td>${accion}</td>
                <td>${descripcion}</td>
            </tr>
        `;
    }).join('');
}

function _formatLogUsuario(log) {
    const nombre = (log.usuario_nombre || '').toString().trim();
    const apellido = (log.usuario_apellido || '').toString().trim();
    const full = `${nombre} ${apellido}`.trim();
    if (full) return full;
    if (log.id_usuario) return `Usuario ${log.id_usuario}`;
    return 'Sistema';
}
