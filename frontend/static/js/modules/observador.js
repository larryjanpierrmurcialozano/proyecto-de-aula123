// ════════════════════════════════════════════════════════════════════════════════
// MODULO OBSERVADOR
// CRUD + filtros + protocolo dinamico + selector de estudiante por grupo
// ════════════════════════════════════════════════════════════════════════════════

let OBSERVACIONES_CACHE = [];
let OBSERVADOR_SCHEMA = {};
let ESTUDIANTES_OBSERVADOR_CACHE = [];
let OBS_GRUPOS_CACHE = [];
let OBS_MATERIAS_CACHE = [];

const OBS_PROTOCOLOS_GUIA = {
    TIPO_1: {
        titulo: 'Tipo 1',
        resumen: 'Conflictos esporadicos sin dano al cuerpo o salud.',
        acciones: [
            'Mediacion pedagogica inmediata entre las partes.',
            'Registro del caso y acuerdos de aula.',
            'Seguimiento para verificar cumplimiento.'
        ]
    },
    TIPO_2: {
        titulo: 'Tipo 2',
        resumen: 'Situaciones repetidas o de mayor impacto en la convivencia.',
        acciones: [
            'Notificar acudientes y coordinar acciones pedagogicas.',
            'Activar rutas internas del comite escolar de convivencia.',
            'Dejar evidencia de medidas, compromisos y seguimiento.'
        ]
    },
    TIPO_3: {
        titulo: 'Tipo 3',
        resumen: 'Posibles situaciones constitutivas de delito o riesgo alto.',
        acciones: [
            'Atencion y proteccion inmediata del estudiante.',
            'Notificacion institucional y activacion de rutas externas.',
            'Remision a entidades competentes y trazabilidad del caso.'
        ]
    }
};

function _toMultilineHtml(value) {
    return escapeHtml(value || '').replace(/\r?\n/g, '<br>');
}

function _obsFechaCorta(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    return d.toLocaleDateString('es-CO');
}

function _obsHoraCorta(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

function _obsFindEstudiante(idEstudiante) {
    return ESTUDIANTES_OBSERVADOR_CACHE.find(e => String(e.id_estudiante) === String(idEstudiante)) || null;
}

function _obsMateriaNombrePorId(idMateria) {
    if (!idMateria) return '';
    const item = OBS_MATERIAS_CACHE.find(m => String(m.id_materia) === String(idMateria));
    return item ? (item.nombre_materia || '') : '';
}

function _buildMateriasOptions(selectedId = null) {
    if (!OBS_MATERIAS_CACHE.length) {
        return { html: '<option value="">No hay asignaturas asignadas</option>', disabled: true };
    }

    const options = OBS_MATERIAS_CACHE.map(m => {
        const selected = selectedId && String(selectedId) === String(m.id_materia) ? 'selected' : '';
        return `<option value="${m.id_materia}" ${selected}>${escapeHtml(m.nombre_materia || '')}</option>`;
    }).join('');

    return {
        html: `<option value="">Seleccionar asignatura...</option>${options}`,
        disabled: false
    };
}

function _obsBuildCompromisoSeguimiento(observacion) {
    const partes = [];
    if (observacion?.compromiso) {
        partes.push(`Compromisos: ${observacion.compromiso}`);
    }
    if (observacion?.seguimiento) {
        partes.push(`Seguimiento: ${observacion.seguimiento}`);
    }
    return partes.join('\n\n');
}

function _obsFormatoData(observacion = null) {
    const est = observacion ? _obsFindEstudiante(observacion.id_estudiante) : null;
    const docenteNombre = observacion
        ? `${observacion.registrado_nombre || ''} ${observacion.registrado_apellido || ''}`.trim()
        : ((typeof USUARIO !== 'undefined' && USUARIO?.nombre) ? USUARIO.nombre : '');

    const fechaObs = observacion?.fecha_observacion || new Date().toISOString();
    const asignatura = observacion?.asignatura_nombre || observacion?.asignatura || _obsMateriaNombrePorId(observacion?.id_materia);

    return {
        institucion: 'INSTITUCION EDUCATIVA INEM JULIAN MOTTA SALAS - NEIVA',
        fecha: _obsFechaCorta(fechaObs),
        hora: _obsHoraCorta(fechaObs),
        estudiante: est ? `${est.apellido || ''}, ${est.nombre || ''}`.replace(/^,\s*/, '') : '',
        acudiente: est?.acudiente_nombre || '',
        docente: docenteNombre,
        grado: est?.nombre_grado || '',
        seccion: est?.codigo_grupo || (observacion?.codigo_grupo || ''),
        asignatura: asignatura,
        tipo: observacion?.tipo_observacion || '',
        protocolo: observacion?.protocolo_tipo || '',
        estado: observacion?.estado_caso || '',
        descripcionTipificacion: [
            observacion?.tipo_observacion ? `Tipo de observacion: ${observacion.tipo_observacion}` : '',
            observacion?.protocolo_tipo ? `Protocolo: ${etiquetaProtocolo(observacion.protocolo_tipo)}` : '',
            observacion?.estado_caso ? `Estado del caso: ${observacion.estado_caso}` : '',
            observacion?.descripcion || ''
        ].filter(Boolean).join('\n\n'),
        descargos: observacion?.descargos_estudiante || '',
        accionesPedagogicas: observacion?.medidas_inmediatas || '',
        compromisosSeguimiento: _obsBuildCompromisoSeguimiento(observacion)
    };
}

function _obsFormatoCopiaHtml(data) {
    return `
        <section class="obs-print-copy">
            <header class="obs-print-head">
                <div class="obs-print-head-left">
                    <img src="/static/img/escudo.png" alt="Logo" onerror="this.style.display='none'">
                </div>
                <div class="obs-print-head-center">
                    <h1>${escapeHtml(data.institucion)}</h1>
                    <p>REGISTRO ACUMULATIVO DEL PROCESO FORMATIVO INTEGRAL</p>
                </div>
            </header>

            <table class="obs-print-meta">
                <tr>
                    <td><strong>NOMBRE DEL ESTUDIANTE:</strong> ${escapeHtml(data.estudiante)}</td>
                    <td><strong>SECCION:</strong> ${escapeHtml(data.seccion)}</td>
                </tr>
                <tr>
                    <td><strong>ACUDIENTE:</strong> ${escapeHtml(data.acudiente)}</td>
                    <td><strong>PARENTESCO:</strong></td>
                </tr>
                <tr>
                    <td><strong>DOCENTE:</strong> ${escapeHtml(data.docente)}</td>
                    <td><strong>CELULAR:</strong></td>
                </tr>
                <tr>
                    <td><strong>GRADO:</strong> ${escapeHtml(data.grado)}</td>
                    <td><strong>ASIGNATURA:</strong> ${escapeHtml(data.asignatura)}</td>
                </tr>
                <tr>
                    <td><strong>FECHA:</strong> ${escapeHtml(data.fecha)}</td>
                    <td><strong>HORA:</strong> ${escapeHtml(data.hora)}</td>
                </tr>
            </table>

            <div class="obs-print-block">
                <h3>DESCRIPCION Y TIPIFICACION DE LA SITUACION DE CONVIVENCIA O ACADEMICA</h3>
                <div class="obs-print-lineado">${_toMultilineHtml(data.descripcionTipificacion)}</div>
            </div>

            <div class="obs-print-block">
                <h3>DESCARGOS DEL ESTUDIANTE</h3>
                <div class="obs-print-lineado">${_toMultilineHtml(data.descargos)}</div>
            </div>

            <div class="obs-print-block">
                <h3>ACCIONES PEDAGOGICAS</h3>
                <div class="obs-print-lineado">${_toMultilineHtml(data.accionesPedagogicas)}</div>
            </div>

            <div class="obs-print-block">
                <h3>COMPROMISOS Y SEGUIMIENTO</h3>
                <div class="obs-print-lineado">${_toMultilineHtml(data.compromisosSeguimiento)}</div>
            </div>

            <footer class="obs-print-firmas">
                <div class="firma-item"><span>ACUDIENTE</span></div>
                <div class="firma-item"><span>ESTUDIANTE</span></div>
                <div class="firma-item"><span>DOCENTE</span></div>
            </footer>
        </section>
    `;
}

function _obsFormatoDocumentoHtml(data) {
    return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Formato Observador</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #202020; background: #fff; }
    .obs-print-page { padding: 10mm; }
    .obs-print-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
    .obs-print-copy { border: 1px solid #999; padding: 6mm; min-height: 260mm; display: flex; flex-direction: column; }
    .obs-print-head { display: grid; grid-template-columns: 18mm 1fr; gap: 3mm; align-items: center; margin-bottom: 3mm; }
    .obs-print-head img { width: 16mm; height: 16mm; object-fit: contain; }
    .obs-print-head h1 { margin: 0; font-size: 10px; line-height: 1.2; text-align: center; }
    .obs-print-head p { margin: 1mm 0 0; font-size: 9px; text-align: center; }
    .obs-print-meta { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
    .obs-print-meta td { border: 1px solid #b8b8b8; padding: 1.2mm 1.4mm; font-size: 8px; vertical-align: top; }
    .obs-print-block { margin-bottom: 3mm; }
    .obs-print-block h3 { margin: 0 0 1mm; font-size: 8px; font-weight: 700; }
    .obs-print-lineado {
      border: 1px solid #b8b8b8;
      min-height: 34mm;
      padding: 1.5mm;
      font-size: 8px;
      line-height: 1.55;
      white-space: pre-wrap;
      background-image: repeating-linear-gradient(
        to bottom,
        transparent 0,
        transparent 5.8mm,
        #d8d8d8 5.8mm,
        #d8d8d8 6mm
      );
    }
    .obs-print-firmas { margin-top: auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
    .firma-item { border-top: 1px solid #444; text-align: center; padding-top: 1mm; font-size: 8px; }
    @media print {
      @page { size: A4 portrait; margin: 8mm; }
      .obs-print-page { padding: 0; }
      .obs-print-grid { gap: 5mm; }
      .obs-print-copy { min-height: auto; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="obs-print-page">
    <div class="obs-print-grid">
      ${_obsFormatoCopiaHtml(data)}
      ${_obsFormatoCopiaHtml(data)}
    </div>
  </div>
  <script>
    window.addEventListener('load', function () {
      window.focus();
      setTimeout(function () { window.print(); }, 220);
    });
  <\/script>
</body>
</html>`;
}

function _buildGuiaProtocolosHtml() {
    const cards = Object.keys(OBS_PROTOCOLOS_GUIA).map((key) => {
        const info = OBS_PROTOCOLOS_GUIA[key];
        const acciones = info.acciones.map(item => `<li>${escapeHtml(item)}</li>`).join('');
        return `
            <article class="obs-protocolo-card obs-protocolo-${key.toLowerCase()}">
                <h4>${escapeHtml(info.titulo)}</h4>
                <p>${escapeHtml(info.resumen)}</p>
                <ul>${acciones}</ul>
                <button class="btn btn-cafe btn-sm" onclick="abrirModalObservacionConProtocolo('${key}')">
                    <i class="fas fa-pen"></i> Registrar caso ${escapeHtml(info.titulo)}
                </button>
            </article>
        `;
    }).join('');

    return `
        <section class="obs-guia-panel">
            <div class="obs-guia-header">
                <h3><i class="fas fa-shield-alt"></i> Guia de protocolos de convivencia</h3>
                <div class="obs-guia-header-actions">
                    <button class="btn btn-cafe btn-sm" onclick="imprimirFormatoObservador()">
                        <i class="fas fa-print"></i> Formato en blanco
                    </button>
                    <button class="btn btn-cafe btn-sm" onclick="descargarFormatoObservador()">
                        <i class="fas fa-file-pdf"></i> PDF directo
                    </button>
                </div>
            </div>

            <div class="obs-guia-grid">
                <div class="obs-guia-imagen-wrap">
                    <img class="obs-guia-imagen" src="/static/img/protocolo-convivencia.png" alt="Infografia de protocolos"
                         onerror="this.style.display='none'; this.parentElement.querySelector('.obs-guia-imagen-fallback').style.display='flex';">
                    <div class="obs-guia-imagen-fallback" style="display:none;">
                        <i class="fas fa-image"></i>
                        <p>imagen de protocolo<strong>pal futuro</strong></p>
                    </div>
                </div>

                <div class="obs-guia-cards">${cards}</div>
            </div>

            <div class="obs-guia-manual">
                <h4><i class="fas fa-book"></i> Ruta minima sugerida</h4>
                <ol>
                    <li>Registrar descripcion objetiva del hecho.</li>
                    <li>Seleccionar tipo de protocolo (1, 2 o 3).</li>
                    <li>Diligenciar acciones pedagogicas y compromisos.</li>
                    <li>Generar e imprimir el formato para firmas.</li>
                </ol>
            </div>
        </section>
    `;
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function etiquetaProtocolo(protocolo) {
    const map = {
        'TIPO_1': 'Tipo 1',
        'TIPO_2': 'Tipo 2',
        'TIPO_3': 'Tipo 3'
    };
    return map[protocolo] || 'Sin definir';
}

function badgeTipoObservacion(tipo) {
    const t = (tipo || '').toLowerCase();
    if (t === 'positiva') return '<span class="badge badge-verde">Positiva</span>';
    if (t === 'negativa') return '<span class="badge badge-rojo">Negativa</span>';
    return '<span class="badge badge-cafe">Neutra</span>';
}

function badgeProtocolo(protocolo) {
    if (protocolo === 'TIPO_1') return '<span class="badge badge-verde">Tipo 1</span>';
    if (protocolo === 'TIPO_2') return '<span class="badge badge-cafe">Tipo 2</span>';
    if (protocolo === 'TIPO_3') return '<span class="badge badge-rojo">Tipo 3</span>';
    return '<span class="badge badge-cafe">Sin definir</span>';
}

function badgeEstadoCaso(estado) {
    if (estado === 'Abierto') return '<span class="badge badge-rojo">Abierto</span>';
    if (estado === 'Seguimiento') return '<span class="badge badge-cafe">Seguimiento</span>';
    if (estado === 'Cerrado') return '<span class="badge badge-verde">Cerrado</span>';
    return '<span class="badge badge-cafe">Sin estado</span>';
}

function toDateInputValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toDateTimeLocalInputValue(value) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function observadorFechaHoraLocalActual() {
    return toDateTimeLocalInputValue(new Date());
}

function observadorFechaLocalActual() {
    return observadorFechaHoraLocalActual().slice(0, 10);
}

function limitarFechaObservacionAHoraActual() {
    const fechaHoraMaxima = observadorFechaHoraLocalActual();
    const fechaMaxima = fechaHoraMaxima.slice(0, 10);
    for (const id of ['obs-fecha-observacion', 'obs-fecha-notificacion']) {
        const input = document.getElementById(id);
        if (input) input.max = fechaHoraMaxima;
    }
    for (const id of ['obs-fecha-seguimiento', 'obs-fecha-remision']) {
        const input = document.getElementById(id);
        if (input) input.max = fechaMaxima;
    }
}

function validarFechasObservadorFormulario() {
    limitarFechaObservacionAHoraActual();
    const ahora = observadorFechaHoraLocalActual();
    const hoy = observadorFechaLocalActual();
    const campos = [
        ['obs-fecha-observacion', ahora, 'La fecha y hora de la observación'],
        ['obs-fecha-seguimiento', hoy, 'La fecha de seguimiento'],
        ['obs-fecha-remision', hoy, 'La fecha de remisión'],
        ['obs-fecha-notificacion', ahora, 'La fecha y hora de notificación']
    ];
    for (const [id, maximo, etiqueta] of campos) {
        const input = document.getElementById(id);
        if (input?.value && input.value > maximo) {
            mostrarAlerta(`${etiqueta} no puede estar en el futuro.`, 'error');
            input.focus();
            return false;
        }
    }
    return true;
}

function _schemaEnabled(key) {
    return !!OBSERVADOR_SCHEMA[key];
}

function _normalizarGrupoCodigo(item) {
    return String(item?.codigo_grupo || item?.grupo_codigo || 'Sin grupo');
}

function _normalizarNombreCompleto(item) {
    return `${item?.nombre || ''} ${item?.apellido || ''}`.trim();
}

function _sortGrupoCodigo(a, b) {
    const rgx = /^(\d+)(?:\s*-\s*(\d+))?/;
    const ma = String(a).match(rgx);
    const mb = String(b).match(rgx);

    if (!ma || !mb) return String(a).localeCompare(String(b), 'es', { numeric: true });

    const ga = Number(ma[1]);
    const gb = Number(mb[1]);
    if (ga !== gb) return ga - gb;

    const sa = Number(ma[2] || 0);
    const sb = Number(mb[2] || 0);
    return sa - sb;
}

function _buildGruposCache() {
    const grupos = new Set();
    ESTUDIANTES_OBSERVADOR_CACHE.forEach(e => grupos.add(_normalizarGrupoCodigo(e)));
    OBS_GRUPOS_CACHE = Array.from(grupos).sort(_sortGrupoCodigo);
}

function _filtrarEstudiantes({ grupo = '', buscar = '' } = {}) {
    const grupoNorm = (grupo || '').trim();
    const buscarNorm = (buscar || '').toLowerCase().trim();

    return ESTUDIANTES_OBSERVADOR_CACHE.filter(e => {
        const grupoEst = _normalizarGrupoCodigo(e);
        const nombreCompleto = _normalizarNombreCompleto(e).toLowerCase();
        const coincideGrupo = !grupoNorm || grupoEst === grupoNorm;
        const coincideBusqueda = !buscarNorm || nombreCompleto.includes(buscarNorm) || grupoEst.toLowerCase().includes(buscarNorm);
        return coincideGrupo && coincideBusqueda;
    }).sort((a, b) => _normalizarNombreCompleto(a).localeCompare(_normalizarNombreCompleto(b), 'es', { sensitivity: 'base' }));
}

function _buildEstudiantesOptions({ grupo = '', buscar = '' } = {}) {
    const estudiantes = _filtrarEstudiantes({ grupo, buscar });

    if (!estudiantes.length) {
        return '<option value="">No hay estudiantes con esos filtros</option>';
    }

    const grouped = {};
    estudiantes.forEach(e => {
        const g = _normalizarGrupoCodigo(e);
        if (!grouped[g]) grouped[g] = [];
        grouped[g].push(e);
    });

    return OBS_GRUPOS_CACHE
        .filter(g => grouped[g] && grouped[g].length)
        .map(g => {
            const options = grouped[g]
                .map(e => `<option value="${e.id_estudiante}">${escapeHtml(e.apellido || '')}, ${escapeHtml(e.nombre || '')}</option>`)
                .join('');
            return `<optgroup label="Grupo ${escapeHtml(g)}">${options}</optgroup>`;
        })
        .join('');
}

function _buildGruposFilterOptions(includeAllText = 'Todos los grupos') {
    return `
        <option value="">${includeAllText}</option>
        ${OBS_GRUPOS_CACHE.map(g => `<option value="${escapeHtml(g)}">Grupo ${escapeHtml(g)}</option>`).join('')}
    `;
}

function actualizarFiltroEstudianteTabla() {
    const grupo = document.getElementById('filtro-observador-grupo')?.value || '';
    const select = document.getElementById('filtro-observador-estudiante');
    if (!select) return;

    const selectedBefore = select.value;
    select.innerHTML = `<option value="">Todos los estudiantes</option>${_buildEstudiantesOptions({ grupo })}`;

    const stillExists = Array.from(select.options).some(opt => opt.value === selectedBefore);
    select.value = stillExists ? selectedBefore : '';
}

function cargarOpcionesEstudiantesObservador(selectedId = null) {
    const grupo = document.getElementById('obs-filtro-grupo')?.value || '';
    const buscar = document.getElementById('obs-buscar-estudiante')?.value || '';
    const select = document.getElementById('obs-estudiante');
    if (!select) return;

    const selectedBefore = selectedId ? String(selectedId) : select.value;
    select.innerHTML = `<option value="">Seleccionar estudiante...</option>${_buildEstudiantesOptions({ grupo, buscar })}`;

    const stillExists = Array.from(select.options).some(opt => opt.value === String(selectedBefore));
    select.value = stillExists ? String(selectedBefore) : '';
}

function inicializarFormularioObservador() {
    const form = document.getElementById('form-observacion');
    if (!form || form.dataset.initialized === '1') return;

    form.dataset.initialized = '1';
    form.addEventListener('submit', submitObservacion);

    document.getElementById('obs-protocolo')?.addEventListener('change', actualizarReglasFormularioObservador);
    document.getElementById('obs-estado-caso')?.addEventListener('change', actualizarReglasFormularioObservador);
    document.getElementById('obs-filtro-grupo')?.addEventListener('change', () => cargarOpcionesEstudiantesObservador());
    document.getElementById('obs-buscar-estudiante')?.addEventListener('input', () => cargarOpcionesEstudiantesObservador());

    document.getElementById('obs-acudiente-notificado')?.addEventListener('change', (e) => {
        const fechaNotif = document.getElementById('obs-fecha-notificacion');
        if (e.target.checked && fechaNotif && !fechaNotif.value) {
            fechaNotif.value = toDateTimeLocalInputValue(new Date().toISOString());
        }
    });
}

function _buildModalHtml() {
    const advanced = _schemaEnabled('advanced_protocol');
    const hasMedidas = _schemaEnabled('has_medidas_inmediatas');
    const hasSeguimiento = _schemaEnabled('has_seguimiento');
    const hasFechaSeguimiento = _schemaEnabled('has_fecha_seguimiento');
    const hasEntidad = _schemaEnabled('has_entidad_remitida');
    const hasRadicado = _schemaEnabled('has_numero_radicado');
    const hasFechaRemision = _schemaEnabled('has_fecha_remision');
    const hasNotif = _schemaEnabled('has_acudiente_notificado');
    const hasFechaNotif = _schemaEnabled('has_fecha_notificacion');
    const hasDescargos = _schemaEnabled('has_descargos_estudiante');
    const materiasSelect = _buildMateriasOptions();

    return `
        <div class="modal-overlay" id="modal-observacion">
            <div class="modal" style="max-width: 920px;">
                <div class="modal-header">
                    <h2><i class="fas fa-eye"></i> <span id="modal-observacion-titulo">Nueva Observacion</span></h2>
                    <button class="modal-close" onclick="cerrarModal('modal-observacion')">&times;</button>
                </div>
                <form id="form-observacion">
                    <input type="hidden" id="obs-id">

                    <div class="obs-estudiante-panel">
                        <h4><i class="fas fa-user-graduate"></i> Seleccion del estudiante</h4>
                        <div class="form-row">
                            <div class="form-group">
                                <label>Filtrar por grupo</label>
                                <select id="obs-filtro-grupo">${_buildGruposFilterOptions('Todos los grupos')}</select>
                            </div>
                            <div class="form-group">
                                <label>Buscar estudiante</label>
                                <input type="text" id="obs-buscar-estudiante" placeholder="Escribe apellido o nombre...">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Estudiante *</label>
                            <select id="obs-estudiante" required></select>
                        </div>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>Tipo de observacion *</label>
                            <select id="obs-tipo" required>
                                <option value="Positiva">Positiva</option>
                                <option value="Negativa">Negativa</option>
                                <option value="Neutra">Neutra</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Fecha y hora *</label>
                            <input type="datetime-local" id="obs-fecha-observacion" required>
                        </div>
                        <div class="form-group">
                            <label>Categoria</label>
                            <input type="text" id="obs-categoria" placeholder="Ej: Convivencia, Academico...">
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Asignatura *</label>
                        <select id="obs-materia" ${materiasSelect.disabled ? 'disabled' : 'required'}>
                            ${materiasSelect.html}
                        </select>
                    </div>

                    ${advanced ? `
                    <div class="form-row">
                        <div class="form-group">
                            <label>Protocolo</label>
                            <select id="obs-protocolo">
                                <option value="TIPO_1">Tipo 1</option>
                                <option value="TIPO_2">Tipo 2</option>
                                <option value="TIPO_3">Tipo 3</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Estado del caso</label>
                            <select id="obs-estado-caso">
                                <option value="Abierto">Abierto</option>
                                <option value="Seguimiento">Seguimiento</option>
                                <option value="Cerrado">Cerrado</option>
                            </select>
                        </div>
                    </div>
                    <p id="obs-ayuda-protocolo" class="obs-ayuda-protocolo"></p>
                    ` : ''}

                    <div class="form-group">
                        <label>Descripcion *</label>
                        <textarea id="obs-descripcion" rows="4" required placeholder="Describe el hecho u observacion"></textarea>
                    </div>

                    ${hasDescargos ? `
                    <div class="form-group">
                        <label>Descargos del estudiante</label>
                        <textarea id="obs-descargos-estudiante" rows="3" placeholder="Version o descargo del estudiante"></textarea>
                    </div>
                    ` : '<input type="hidden" id="obs-descargos-estudiante">'}

                    ${(hasMedidas || hasSeguimiento) ? `
                    <div class="form-row">
                        ${hasMedidas ? `
                        <div class="form-group">
                            <label>Medidas inmediatas</label>
                            <textarea id="obs-medidas-inmediatas" rows="2" placeholder="Acciones realizadas de inmediato"></textarea>
                        </div>` : '<input type="hidden" id="obs-medidas-inmediatas">'}
                        ${hasSeguimiento ? `
                        <div class="form-group">
                            <label>Seguimiento / cierre</label>
                            <textarea id="obs-seguimiento" rows="2" placeholder="Seguimiento o cierre del caso"></textarea>
                        </div>` : '<input type="hidden" id="obs-seguimiento">'}
                    </div>` : '<input type="hidden" id="obs-medidas-inmediatas"><input type="hidden" id="obs-seguimiento">'}

                    ${(hasFechaSeguimiento || hasFechaRemision) ? `
                    <div class="form-row">
                        ${hasFechaSeguimiento ? `
                        <div class="form-group">
                            <label>Fecha seguimiento</label>
                            <input type="date" id="obs-fecha-seguimiento">
                        </div>` : '<input type="hidden" id="obs-fecha-seguimiento">'}
                        ${hasFechaRemision ? `
                        <div class="form-group">
                            <label>Fecha remision</label>
                            <input type="date" id="obs-fecha-remision">
                        </div>` : '<input type="hidden" id="obs-fecha-remision">'}
                    </div>` : '<input type="hidden" id="obs-fecha-seguimiento"><input type="hidden" id="obs-fecha-remision">'}

                    ${(hasEntidad || hasRadicado) ? `
                    <div class="form-row" id="obs-remision-extra">
                        ${hasEntidad ? `
                        <div class="form-group">
                            <label>Entidad remitida</label>
                            <input type="text" id="obs-entidad-remitida" placeholder="Comisaria, ICBF, etc.">
                        </div>` : '<input type="hidden" id="obs-entidad-remitida">'}
                        ${hasRadicado ? `
                        <div class="form-group">
                            <label>Numero de radicado</label>
                            <input type="text" id="obs-numero-radicado" placeholder="Numero interno/externo">
                        </div>` : '<input type="hidden" id="obs-numero-radicado">'}
                    </div>` : '<input type="hidden" id="obs-entidad-remitida"><input type="hidden" id="obs-numero-radicado">'}

                    <div class="form-row">
                        <div class="form-group">
                            <label>Compromiso</label>
                            <textarea id="obs-compromiso" rows="2" placeholder="Compromisos acordados"></textarea>
                        </div>
                        ${hasNotif ? `
                        <div class="form-group obs-check-group">
                            <label><input type="checkbox" id="obs-acudiente-notificado"> Acudiente notificado</label>
                            ${hasFechaNotif ? '<input type="datetime-local" id="obs-fecha-notificacion" style="margin-top:0.6rem;">' : '<input type="hidden" id="obs-fecha-notificacion">'}
                        </div>` : '<input type="hidden" id="obs-acudiente-notificado"><input type="hidden" id="obs-fecha-notificacion">'}
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-rojo" onclick="cerrarModal('modal-observacion')">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="submit" class="btn btn-verde" id="btn-guardar-observacion">
                            <i class="fas fa-save"></i> Guardar Observacion
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function _buildStatsObservador() {
    const total = OBSERVACIONES_CACHE.length;
    const abiertas = OBSERVACIONES_CACHE.filter(o => (o.estado_caso || '') === 'Abierto').length;
    const positivas = OBSERVACIONES_CACHE.filter(o => (o.tipo_observacion || '').toLowerCase() === 'positiva').length;
    const estudiantesUnicos = new Set(OBSERVACIONES_CACHE.map(o => String(o.id_estudiante || ''))).size;

    return `
        <div class="obs-stats">
            <span class="obs-stat obs-stat-total"><i class="fas fa-eye"></i> ${total} observaciones</span>
            <span class="obs-stat obs-stat-abiertas"><i class="fas fa-folder-open"></i> ${abiertas} abiertas</span>
            <span class="obs-stat obs-stat-positivas"><i class="fas fa-thumbs-up"></i> ${positivas} positivas</span>
            <span class="obs-stat obs-stat-estudiantes"><i class="fas fa-users"></i> ${estudiantesUnicos} estudiantes</span>
        </div>
    `;
}

async function renderObservador() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const materiasPromise = (API.getMaterias ? API.getMaterias() : Promise.resolve({ materias: [] }))
            .catch(() => ({ materias: [] }));
        const [obsRes, estRes, materiasRes] = await Promise.all([
            API.getObservaciones(),
            API.getEstudiantes(),
            materiasPromise
        ]);

        OBSERVACIONES_CACHE = obsRes.observaciones || [];
        OBSERVADOR_SCHEMA = obsRes.schema || {};
        ESTUDIANTES_OBSERVADOR_CACHE = estRes.estudiantes || [];
        OBS_MATERIAS_CACHE = materiasRes.materias || [];
        _buildGruposCache();

        const htmlRes = await fetch('/templates/modules html/observador.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista del observador');
        const baseHtml = await htmlRes.text();
        
        let finalHtml = baseHtml;
        if (_schemaEnabled('advanced_protocol')) {
            finalHtml = finalHtml.replace(/<!--\s*IF_ADVANCED_PROTOCOL\s*-->([\s\S]*?)<!--\s*ENDIF_ADVANCED_PROTOCOL\s*-->/g, '$1');
            finalHtml = finalHtml.replace(/<!--\s*IF_ADVANCED_PROTOCOL_HEADER\s*-->([\s\S]*?)<!--\s*ENDIF_ADVANCED_PROTOCOL_HEADER\s*-->/g, '$1');
        } else {
            finalHtml = finalHtml.replace(/<!--\s*IF_ADVANCED_PROTOCOL\s*-->([\s\S]*?)<!--\s*ENDIF_ADVANCED_PROTOCOL\s*-->/g, '');
            finalHtml = finalHtml.replace(/<!--\s*IF_ADVANCED_PROTOCOL_HEADER\s*-->([\s\S]*?)<!--\s*ENDIF_ADVANCED_PROTOCOL_HEADER\s*-->/g, '');
        }
        content.innerHTML = finalHtml;

        const statsContainer = document.getElementById('obs-stats-container');
        if (statsContainer) statsContainer.innerHTML = _buildStatsObservador();
        
        const protocolsGuia = document.getElementById('obs-guia-container');
        if (protocolsGuia) protocolsGuia.innerHTML = _buildGuiaProtocolosHtml();
        
        const filterGrupo = document.getElementById('filtro-observador-grupo');
        if (filterGrupo) filterGrupo.innerHTML = _buildGruposFilterOptions('Todos los grupos');
        
        if (!document.getElementById('modal-observacion')) {
            document.body.insertAdjacentHTML('beforeend', _buildModalHtml());
        }


        actualizarFiltroEstudianteTabla();

        const filtros = [
            'filtro-observador-buscar',
            'filtro-observador-estudiante',
            'filtro-observador-tipo',
            'filtro-observador-protocolo',
            'filtro-observador-estado'
        ];

        filtros.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', aplicarFiltrosObservador);
            el.addEventListener('change', aplicarFiltrosObservador);
        });

        document.getElementById('filtro-observador-grupo')?.addEventListener('change', () => {
            actualizarFiltroEstudianteTabla();
            aplicarFiltrosObservador();
        });

        inicializarFormularioObservador();
        aplicarFiltrosObservador();
    } catch (error) {
        content.innerHTML = Helpers.error('No se pudo cargar el modulo Observador.');
    }
}

function aplicarFiltrosObservador() {
    const buscar = (document.getElementById('filtro-observador-buscar')?.value || '').toLowerCase().trim();
    const grupo = document.getElementById('filtro-observador-grupo')?.value || '';
    const estudianteId = document.getElementById('filtro-observador-estudiante')?.value || '';
    const tipo = document.getElementById('filtro-observador-tipo')?.value || '';
    const protocolo = document.getElementById('filtro-observador-protocolo')?.value || '';
    const estado = document.getElementById('filtro-observador-estado')?.value || '';

    const filtradas = OBSERVACIONES_CACHE.filter(o => {
        const estudiante = `${o.estudiante_nombre || ''} ${o.estudiante_apellido || ''}`.toLowerCase();
        const descripcion = (o.descripcion || '').toLowerCase();
        const registrado = `${o.registrado_nombre || ''} ${o.registrado_apellido || ''}`.toLowerCase();
        const grupoCodigo = String(o.codigo_grupo || 'Sin grupo');

        const coincideBusqueda = !buscar || estudiante.includes(buscar) || descripcion.includes(buscar) || registrado.includes(buscar) || grupoCodigo.toLowerCase().includes(buscar);
        const coincideGrupo = !grupo || grupoCodigo === grupo;
        const coincideEstudiante = !estudianteId || String(o.id_estudiante) === String(estudianteId);
        const coincideTipo = !tipo || (o.tipo_observacion || '') === tipo;
        const coincideProtocolo = !protocolo || (o.protocolo_tipo || '') === protocolo;
        const coincideEstado = !estado || (o.estado_caso || '') === estado;

        return coincideBusqueda && coincideGrupo && coincideEstudiante && coincideTipo && coincideProtocolo && coincideEstado;
    });

    const tbody = document.getElementById('tabla-observador-body');
    if (tbody) {
        tbody.innerHTML = renderFilasObservador(filtradas);
    }

    const info = document.getElementById('obs-total-registros');
    if (info) {
        info.textContent = `Mostrando ${filtradas.length} de ${OBSERVACIONES_CACHE.length} observaciones`;
    }
}

function renderFilasObservador(observaciones) {
    const advanced = _schemaEnabled('advanced_protocol');

    if (!observaciones.length) {
        const colspan = advanced ? 8 : 6;
        return `<tr><td colspan="${colspan}">${Helpers.sinDatos('No hay observaciones registradas con esos filtros.')}</td></tr>`;
    }

    return observaciones.map(o => {
        const nombreRegistrado = `${o.registrado_nombre || ''} ${o.registrado_apellido || ''}`.trim();
        const grupo = o.codigo_grupo ? `<div class="obs-grupo-tag">Grupo ${escapeHtml(o.codigo_grupo)}</div>` : '';
        const descripcion = escapeHtml(o.descripcion || '');

        return `
            <tr>
                <td>${Helpers.formatearFechaHora(o.fecha_observacion)}</td>
                <td>
                    ${Helpers.celdaUsuario(o.estudiante_nombre || '-', o.estudiante_apellido || '')}
                    ${grupo}
                </td>
                <td>${badgeTipoObservacion(o.tipo_observacion)}</td>
                ${advanced ? `<td>${badgeProtocolo(o.protocolo_tipo)}</td><td>${badgeEstadoCaso(o.estado_caso)}</td>` : ''}
                <td class="obs-desc-cell">${descripcion}</td>
                <td>${escapeHtml(nombreRegistrado || '-')}</td>
                <td>
                    <div class="acciones-btns">
                        <button class="btn-accion btn-accion-cafe" title="Ver" onclick="verObservacion(${o.id_observacion})"><i class="fas fa-eye"></i></button>
                        <button class="btn-accion btn-accion-cafe" title="PDF" onclick="descargarFormatoObservador(${o.id_observacion})"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-accion btn-accion-cafe" title="Formato" onclick="imprimirFormatoObservador(${o.id_observacion})"><i class="fas fa-print"></i></button>
                        <button class="btn-accion btn-accion-verde" title="Editar" onclick="abrirModalObservacion(${o.id_observacion})"><i class="fas fa-edit"></i></button>
                        <button class="btn-accion btn-accion-rojo" title="Eliminar" onclick="eliminarObservacion(${o.id_observacion})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getObservacionById(id) {
    return OBSERVACIONES_CACHE.find(o => String(o.id_observacion) === String(id));
}

function abrirModalObservacionConProtocolo(protocolo) {
    abrirModalObservacion();

    const select = document.getElementById('obs-protocolo');
    if (!select) {
        mostrarAlerta('Tu base actual no incluye protocolo avanzado en observador.', 'info');
        return;
    }

    if (!OBS_PROTOCOLOS_GUIA[protocolo]) return;
    select.value = protocolo;
    actualizarReglasFormularioObservador();
}

function imprimirFormatoObservador(id = null) {
    const observacion = id ? getObservacionById(id) : null;
    if (id && !observacion) {
        mostrarAlerta('No se encontro la observacion para imprimir.', 'error');
        return;
    }

    const data = _obsFormatoData(observacion);
    const html = _obsFormatoDocumentoHtml(data);
    const ventana = window.open('', '_blank');

    if (!ventana) {
        mostrarAlerta('El navegador bloqueo la ventana de impresion. Habilita popups.', 'warning');
        return;
    }

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
}

function descargarFormatoObservador(id = null) {
    const url = (typeof API !== 'undefined' && typeof API.getFormatoObservadorPdfUrl === 'function')
        ? API.getFormatoObservadorPdfUrl(id)
        : (id ? `/api/observador/${id}/formato.pdf` : '/api/observador/formato.pdf');
    const ventana = window.open(url, '_blank');
    if (!ventana) {
        mostrarAlerta('El navegador bloqueo la descarga de PDF. Habilita popups.', 'warning');
    }
}

function actualizarReglasFormularioObservador() {
    const advanced = _schemaEnabled('advanced_protocol');
    if (!advanced) return;

    const protocolo = document.getElementById('obs-protocolo')?.value || 'TIPO_1';
    const estado = document.getElementById('obs-estado-caso')?.value || 'Abierto';

    const medidas = document.getElementById('obs-medidas-inmediatas');
    const entidad = document.getElementById('obs-entidad-remitida');
    const radicado = document.getElementById('obs-numero-radicado');
    const seguimiento = document.getElementById('obs-seguimiento');
    const remisionBloque = document.getElementById('obs-remision-extra');
    const ayuda = document.getElementById('obs-ayuda-protocolo');

    const exigeMedidas = protocolo === 'TIPO_2' || protocolo === 'TIPO_3';
    const exigeRemision = protocolo === 'TIPO_3';
    const exigeSeguimientoCierre = estado === 'Cerrado';

    if (medidas) medidas.required = exigeMedidas;
    if (entidad) entidad.required = exigeRemision;
    if (radicado) radicado.required = exigeRemision;
    if (seguimiento) seguimiento.required = exigeSeguimientoCierre;

    if (remisionBloque) {
        remisionBloque.style.display = exigeRemision ? '' : 'none';
    }

    if (ayuda) {
        const partes = [`Protocolo seleccionado: ${etiquetaProtocolo(protocolo)}.`];
        if (exigeMedidas) partes.push('Debes diligenciar medidas inmediatas.');
        if (exigeRemision) partes.push('Debes registrar entidad remitida y numero de radicado.');
        if (exigeSeguimientoCierre) partes.push('Para cerrar el caso debes registrar seguimiento/cierre.');
        ayuda.textContent = partes.join(' ');
    }
}

function abrirModalObservacion(id = null) {
    inicializarFormularioObservador();

    const form = document.getElementById('form-observacion');
    if (!form) return;

    form.reset();
    document.getElementById('obs-id').value = '';
    document.getElementById('modal-observacion-titulo').textContent = 'Nueva Observacion';
    document.getElementById('btn-guardar-observacion').innerHTML = '<i class="fas fa-save"></i> Guardar Observacion';

    const grupoModal = document.getElementById('obs-filtro-grupo');
    if (grupoModal) grupoModal.innerHTML = _buildGruposFilterOptions('Todos los grupos');

    const materiaSelect = document.getElementById('obs-materia');
    if (materiaSelect) {
        const materiasSelect = _buildMateriasOptions();
        materiaSelect.innerHTML = materiasSelect.html;
        materiaSelect.disabled = materiasSelect.disabled;
    }

    document.getElementById('obs-fecha-observacion').value = observadorFechaHoraLocalActual();
    limitarFechaObservacionAHoraActual();
    if (document.getElementById('obs-protocolo')) document.getElementById('obs-protocolo').value = 'TIPO_1';
    if (document.getElementById('obs-estado-caso')) document.getElementById('obs-estado-caso').value = 'Abierto';

    if (id) {
        const observacion = getObservacionById(id);
        if (!observacion) {
            mostrarAlerta('No se encontro la observacion a editar', 'error');
            return;
        }

        document.getElementById('obs-id').value = observacion.id_observacion;
        document.getElementById('modal-observacion-titulo').textContent = 'Editar Observacion';
        document.getElementById('btn-guardar-observacion').innerHTML = '<i class="fas fa-save"></i> Actualizar Observacion';

        const estObj = ESTUDIANTES_OBSERVADOR_CACHE.find(e => String(e.id_estudiante) === String(observacion.id_estudiante));
        const grupoEst = _normalizarGrupoCodigo(estObj || { codigo_grupo: observacion.codigo_grupo });

        if (grupoModal) grupoModal.value = grupoEst;
        cargarOpcionesEstudiantesObservador(observacion.id_estudiante);

        document.getElementById('obs-tipo').value = observacion.tipo_observacion || 'Neutra';
        const cat = document.getElementById('obs-categoria');
        if (cat) cat.value = observacion.categoria || '';
        const prot = document.getElementById('obs-protocolo');
        if (prot) prot.value = observacion.protocolo_tipo || 'TIPO_1';
        const est = document.getElementById('obs-estado-caso');
        if (est) est.value = observacion.estado_caso || 'Abierto';
        document.getElementById('obs-fecha-observacion').value = toDateTimeLocalInputValue(observacion.fecha_observacion);
        document.getElementById('obs-descripcion').value = observacion.descripcion || '';
        const desc = document.getElementById('obs-descargos-estudiante');
        if (desc) desc.value = observacion.descargos_estudiante || '';
        const med = document.getElementById('obs-medidas-inmediatas');
        if (med) med.value = observacion.medidas_inmediatas || '';
        document.getElementById('obs-compromiso').value = observacion.compromiso || '';
        const seg = document.getElementById('obs-seguimiento');
        if (seg) seg.value = observacion.seguimiento || '';
        const fs = document.getElementById('obs-fecha-seguimiento');
        if (fs) fs.value = toDateInputValue(observacion.fecha_seguimiento);
        const ent = document.getElementById('obs-entidad-remitida');
        if (ent) ent.value = observacion.entidad_remitida || '';
        const rad = document.getElementById('obs-numero-radicado');
        if (rad) rad.value = observacion.numero_radicado || '';
        const fr = document.getElementById('obs-fecha-remision');
        if (fr) fr.value = toDateInputValue(observacion.fecha_remision);
        const an = document.getElementById('obs-acudiente-notificado');
        if (an) an.checked = Number(observacion.acudiente_notificado || 0) === 1;
        const fn = document.getElementById('obs-fecha-notificacion');
        if (fn) fn.value = toDateTimeLocalInputValue(observacion.fecha_notificacion);

        if (materiaSelect) {
            const materiasSelect = _buildMateriasOptions(observacion.id_materia || null);
            materiaSelect.innerHTML = materiasSelect.html;
            materiaSelect.disabled = materiasSelect.disabled;
            if (observacion.id_materia) {
                materiaSelect.value = String(observacion.id_materia);
            } else if (observacion.asignatura) {
                const match = OBS_MATERIAS_CACHE.find(m => (m.nombre_materia || '').toLowerCase() === String(observacion.asignatura).toLowerCase());
                if (match) materiaSelect.value = String(match.id_materia);
            }
        }
    } else {
        const grupoGlobal = document.getElementById('filtro-observador-grupo')?.value || '';
        if (grupoModal && grupoGlobal) grupoModal.value = grupoGlobal;
        cargarOpcionesEstudiantesObservador();
    }

    limitarFechaObservacionAHoraActual();
    actualizarReglasFormularioObservador();
    abrirModal('modal-observacion');
}

async function submitObservacion(event) {
    event.preventDefault();

    const id = document.getElementById('obs-id').value;
    const materiaSelect = document.getElementById('obs-materia');
    const fechaObsInput = document.getElementById('obs-fecha-observacion')?.value || observadorFechaHoraLocalActual();
    if (!validarFechasObservadorFormulario()) return;
    const payload = {
        id_estudiante: Number(document.getElementById('obs-estudiante').value),
        tipo_observacion: document.getElementById('obs-tipo').value,
        categoria: document.getElementById('obs-categoria')?.value || null,
        protocolo_tipo: document.getElementById('obs-protocolo')?.value || null,
        estado_caso: document.getElementById('obs-estado-caso')?.value || null,
        fecha_observacion: fechaObsInput,
        descripcion: document.getElementById('obs-descripcion').value.trim(),
        descargos_estudiante: document.getElementById('obs-descargos-estudiante')?.value.trim() || null,
        medidas_inmediatas: document.getElementById('obs-medidas-inmediatas')?.value.trim() || null,
        compromiso: document.getElementById('obs-compromiso')?.value.trim() || null,
        seguimiento: document.getElementById('obs-seguimiento')?.value.trim() || null,
        fecha_seguimiento: document.getElementById('obs-fecha-seguimiento')?.value || null,
        entidad_remitida: document.getElementById('obs-entidad-remitida')?.value.trim() || null,
        numero_radicado: document.getElementById('obs-numero-radicado')?.value.trim() || null,
        fecha_remision: document.getElementById('obs-fecha-remision')?.value || null,
        acudiente_notificado: document.getElementById('obs-acudiente-notificado')?.checked || false,
        fecha_notificacion: document.getElementById('obs-fecha-notificacion')?.value || null
    };

    if (materiaSelect && materiaSelect.value) {
        payload.id_materia = Number(materiaSelect.value);
        const materiaTexto = materiaSelect.options[materiaSelect.selectedIndex]?.text || '';
        if (materiaTexto) payload.asignatura = materiaTexto;
    }

    if (!payload.id_estudiante || Number.isNaN(payload.id_estudiante)) {
        mostrarAlerta('Selecciona un estudiante', 'error');
        return;
    }

    if (materiaSelect && !materiaSelect.disabled && !materiaSelect.value) {
        mostrarAlerta('Selecciona una asignatura', 'error');
        return;
    }

    if (!payload.descripcion) {
        mostrarAlerta('La descripcion es obligatoria', 'error');
        return;
    }

    if (_schemaEnabled('advanced_protocol')) {
        if ((payload.protocolo_tipo === 'TIPO_2' || payload.protocolo_tipo === 'TIPO_3') && !payload.medidas_inmediatas) {
            mostrarAlerta('Para Tipo 2 o Tipo 3 debes diligenciar medidas inmediatas', 'error');
            return;
        }

        if (payload.protocolo_tipo === 'TIPO_3' && (!payload.entidad_remitida || !payload.numero_radicado)) {
            mostrarAlerta('Para Tipo 3 debes diligenciar entidad remitida y numero de radicado', 'error');
            return;
        }

        if (payload.estado_caso === 'Cerrado' && !payload.seguimiento) {
            mostrarAlerta('Para cerrar un caso debes diligenciar seguimiento/cierre', 'error');
            return;
        }
    }

    Object.keys(payload).forEach((key) => {
        if (payload[key] === null || payload[key] === '') {
            delete payload[key];
        }
    });

    try {
        if (id) {
            await API.actualizarObservacion(id, payload);
            mostrarAlerta('Observacion actualizada correctamente', 'success');
        } else {
            await API.crearObservacion(payload);
            mostrarAlerta('Observacion creada correctamente', 'success');
        }
        cerrarModal('modal-observacion');
        await renderObservador();
    } catch (error) {
        mostrarAlerta(error.message || 'No se pudo guardar la observacion', 'error');
    }
}

function verObservacion(id) {
    const observacion = getObservacionById(id);
    if (!observacion) {
        mostrarAlerta('No se encontro la observacion', 'error');
        return;
    }

    const estudiante = `${observacion.estudiante_nombre || ''} ${observacion.estudiante_apellido || ''}`.trim();
    const fecha = Helpers.formatearFechaHora(observacion.fecha_observacion);
    const resumen = `${estudiante} · ${fecha} · ${(observacion.tipo_observacion || 'Neutra')}`;
    mostrarAlerta(`Caso: ${resumen}`, 'info');
}

async function eliminarObservacion(id) {
    if (!confirm('Deseas eliminar esta observacion? Esta accion no se puede deshacer.')) {
        return;
    }

    try {
        await API.eliminarObservacion(id);
        mostrarAlerta('Observacion eliminada', 'success');
        await renderObservador();
    } catch (error) {
        mostrarAlerta(error.message || 'No se pudo eliminar la observacion', 'error');
    }
}
