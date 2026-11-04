// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO REPORTES
// Generación y envío de reportes por correo electrónico
// ════════════════════════════════════════════════════════════════════════════════

async function renderReportes() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const htmlRes = await fetch('/templates/modules html/reportes.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de reportes');
        content.innerHTML = await htmlRes.text();
    } catch (e) {
        content.innerHTML = `<div class="alerta error">${e.message}</div>`;
        return;
    }

    cargarGruposReporte();
    cargarPeriodosReporte();

    // Eventos de radio buttons de tipo de reporte
    document.querySelectorAll('input[name="tipo-reporte"]').forEach(radio => {
        radio.addEventListener('change', function () {
            document.querySelectorAll('.reporte-item').forEach(item => {
                item.style.backgroundColor = '#f5f5f5';
            });
            if (this.checked) {
                this.closest('.reporte-item').style.backgroundColor = '#E3F2FD';
                document.getElementById('reporte-tipo-select').value = this.value;
            }
        });
    });

    // Sincronizar select con radio buttons
    document.getElementById('reporte-tipo-select').addEventListener('change', function () {
        if (this.value) {
            seleccionarReporte(this.value);
        } else {
            document.querySelectorAll('.reporte-item').forEach(item => {
                item.style.backgroundColor = '#f5f5f5';
            });
            document.querySelectorAll('input[name="tipo-reporte"]').forEach(r => r.checked = false);
        }
    });

    // Eventos de radio buttons de destinatario
    document.getElementById('radio-especifico').addEventListener('change', () => {
        document.getElementById('container-correo-especifico').style.display = 'block';
        document.getElementById('container-grupo').style.display = 'none';
    });

    document.getElementById('radio-grupo').addEventListener('change', () => {
        document.getElementById('container-correo-especifico').style.display = 'none';
        document.getElementById('container-grupo').style.display = 'block';
    });

    document.getElementById('form-enviar-reporte').addEventListener('submit', enviarReportePorCorreo);

    const btnGenerar = document.getElementById('btn-boletin-generar');
    if (btnGenerar) btnGenerar.addEventListener('click', generarBoletinesGrupo);
    const btnEnviar = document.getElementById('btn-boletin-enviar');
    if (btnEnviar) btnEnviar.addEventListener('click', enviarBoletinesGrupo);
}

async function cargarGruposReporte() {
    try {
        const res = await API.getGruposReportes();
        const grupos = res.grupos || [];
        const select = document.getElementById('reporte-grupo-select');
        select.innerHTML = '<option value="">-- Selecciona un grupo --</option>' +
            grupos.map(grp => `<option value="${grp.id_grupo}">${grp.codigo_grupo} (${grp.nombre_grado})</option>`).join('');

        const selectBoletin = document.getElementById('boletin-grupo-select');
        if (selectBoletin) {
            selectBoletin.innerHTML = '<option value="">-- Selecciona un grupo --</option>' +
                grupos.map(grp => `<option value="${grp.id_grupo}">${grp.codigo_grupo} (${grp.nombre_grado})</option>`).join('');
        }
    } catch (e) {
        mostrarAlerta('No se pudieron cargar los grupos', 'error');
    }
}

async function cargarPeriodosReporte() {
    try {
        const res = await API.getPeriodos();
        const periodos = res.periodos || [];
        const select = document.getElementById('boletin-periodo-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- Selecciona un período --</option>' +
            periodos.map(p => {
                const activo = p.estado === 'Abierto' ? ' (Activo)' : '';
                return `<option value="${p.id_periodo}">${p.nombre_periodo || ('Período ' + p.numero_periodo)}${activo}</option>`;
            }).join('');
    } catch (e) {
        mostrarAlerta('No se pudieron cargar los períodos', 'error');
    }
}

function seleccionarReporte(tipo) {
    document.getElementById('reporte-tipo-select').value = tipo;

    document.querySelectorAll('.reporte-item').forEach(item => {
        item.style.backgroundColor = '#f5f5f5';
    });

    document.querySelectorAll('input[name="tipo-reporte"]').forEach(r => r.checked = false);

    const radioButton = document.getElementById('radio-' + tipo);
    if (radioButton) {
        radioButton.checked = true;
        radioButton.closest('.reporte-item').style.backgroundColor = '#E3F2FD';
    }
}

async function enviarReportePorCorreo(e) {
    e.preventDefault();

    const remitente = document.getElementById('reporte-remitente').value;
    const tipoReporte = document.getElementById('reporte-tipo-select').value;
    const tipoDestinatario = document.querySelector('input[name="tipo-destinatario"]:checked').value;
    const mensaje = document.getElementById('reporte-mensaje').value;

    if (!remitente) {
        mostrarAlerta('Por favor ingresa el correo remitente', 'error');
        return;
    }
    if (!tipoReporte) {
        mostrarAlerta('Por favor selecciona un tipo de reporte', 'error');
        return;
    }
    if (!mensaje.trim()) {
        mostrarAlerta('Por favor escribe un mensaje', 'error');
        return;
    }

    let correos = [];

    if (tipoDestinatario === 'especifico') {
        const correoEspecifico = document.getElementById('reporte-correo-especifico').value;
        if (!correoEspecifico) {
            mostrarAlerta('Por favor ingresa el correo destinatario', 'error');
            return;
        }
        correos = [correoEspecifico];
    } else {
        const grupoId = document.getElementById('reporte-grupo-select').value;
        if (!grupoId) {
            mostrarAlerta('Por favor selecciona un grupo', 'error');
            return;
        }
        try {
            const data = await API.getCorreosPorGrupo(grupoId);
            correos = data.correos || [];
            if (correos.length === 0) {
                mostrarAlerta('No hay correos disponibles para este grupo', 'error');
                return;
            }
        } catch (err) {
            mostrarAlerta(err.message || 'Error al obtener correos del grupo', 'error');
            return;
        }
    }

    const archivo = document.getElementById('reporte-adjunto')?.files?.[0];

    try {
        if (archivo) {
            const formData = new FormData();
            formData.append('remitente', remitente);
            formData.append('tipoReporte', tipoReporte);
            formData.append('mensaje', mensaje);
            formData.append('correos', JSON.stringify(correos));
            formData.append('archivo_pdf', archivo);

            const res = await fetch('/api/reportes/enviar-correo-adjunto', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al enviar el reporte');
            mostrarAlerta(`Reporte enviado a ${correos.length} destinatario(s)`, 'success');
        } else {
            const dataEnvio = { remitente, tipoReporte, correos, mensaje };
            await API.enviarReportePorCorreo(dataEnvio);
            mostrarAlerta(`Reporte enviado a ${correos.length} destinatario(s)`, 'success');
        }
        document.getElementById('form-enviar-reporte').reset();
    } catch (error) {
        console.error('Error:', error);
        mostrarAlerta(error.message || 'Error al enviar el reporte', 'error');
    }
}

async function generarBoletinesGrupo() {
    const grupoId = document.getElementById('boletin-grupo-select')?.value;
    const periodoId = document.getElementById('boletin-periodo-select')?.value;

    if (!grupoId || !periodoId) {
        mostrarAlerta('Selecciona grupo y período para generar boletines', 'error');
        return;
    }

    try {
        const res = await API.sincronizarBoletinesGrupo({ grupo_id: grupoId, periodo_id: periodoId });
        mostrarAlerta(res.message || 'Boletines generados', 'success');
        setTimeout(() => renderReportes(), 150);
    } catch (e) {
        mostrarAlerta(e.message || 'No se pudieron generar los boletines', 'error');
    }
}

async function enviarBoletinesGrupo() {
    const grupoId = document.getElementById('boletin-grupo-select')?.value;
    const periodoId = document.getElementById('boletin-periodo-select')?.value;
    const remitente = document.getElementById('reporte-remitente')?.value;
    const mensaje = document.getElementById('reporte-mensaje')?.value;

    if (!grupoId || !periodoId) {
        mostrarAlerta('Selecciona grupo y período para enviar boletines', 'error');
        return;
    }
    if (!remitente || !mensaje.trim()) {
        mostrarAlerta('Ingresa remitente y mensaje para enviar', 'error');
        return;
    }

    try {
        const res = await API.enviarBoletinesGrupo({
            grupo_id: grupoId,
            periodo_id: periodoId,
            remitente,
            mensaje
        });
        mostrarAlerta(`Boletines enviados: ${res.enviados || 0}`, 'success');
        setTimeout(() => renderReportes(), 150);
    } catch (e) {
        mostrarAlerta(e.message || 'No se pudieron enviar los boletines', 'error');
    }
}
