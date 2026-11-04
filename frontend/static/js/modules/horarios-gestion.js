let HG_MODE = 'grupos'; // 'grupos' o 'docentes'
let HG_FILTROS = { grado_id: null, grupo_id: null, docente_id: null };
let HG_DATOS   = [];
let HG_GRADOS  = [];
let HG_GRUPOS  = [];
let HG_DOCENTES = [];

// Días y horas
const HG_DIAS  = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const HG_HORAS = [];
for (let h = 7; h <= 13; h++) {
    HG_HORAS.push(`${String(h).padStart(2,'0')}:00`);
}

// Paleta de colores (tonos claros y distintos entre sí)
const HG_COLORES = [
    'rgba(255, 205, 205, 0.42)',  // Rojo pastel
    'rgba(255, 226, 190, 0.42)',  // Naranja pastel
    'rgba(255, 246, 193, 0.42)',  // Amarillo pastel
    'rgba(209, 236, 209, 0.42)',  // Verde pastel
    'rgba(208, 228, 255, 0.42)',  // Azul pastel
    'rgba(231, 214, 244, 0.42)',  // Lila pastel
    'rgba(255, 214, 232, 0.42)',  // Rosa pastel
    'rgba(214, 240, 240, 0.42)',  // Turquesa pastel
    'rgba(233, 233, 205, 0.42)',  // Oliva claro
    'rgba(199, 226, 255, 0.42)',  // Azul cielo pastel
    'rgba(255, 236, 174, 0.42)',  // Miel suave
    'rgba(255, 202, 202, 0.42)',  // Salmón pastel
    'rgba(214, 245, 255, 0.42)',  // Celeste hielo
    'rgba(224, 210, 245, 0.42)',  // Violeta suave
    'rgba(255, 220, 205, 0.42)'   // Durazno suave
];
let _hgColorIdx = 0;
const _hgColorMap = {};
function hgGetColor(idMateria) {
    if (!_hgColorMap[idMateria]) {
        _hgColorMap[idMateria] = HG_COLORES[_hgColorIdx % HG_COLORES.length];
        _hgColorIdx++;
    }
    return _hgColorMap[idMateria];
}

// ── Render principal ────────────────────────────────────────────────────────

async function renderHorariosGestion() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        // Cargar grados y docentes
        const [gradosRes, docentesRes] = await Promise.all([
            API.request('/api/grados'),
            API.request('/api/docentes/disponibles')
        ]);

        const grados = gradosRes.grados || [];
        const docentes = docentesRes.docentes || [];

        HG_GRADOS = grados;
        HG_DOCENTES = docentes;

        const opGrados = grados.map(g =>
            `<option value="${g.id_grado}" ${g.id_grado == HG_FILTROS.grado_id ? 'selected' : ''}>${g.nombre_grado}</option>`
        ).join('');

        const opDocentes = docentes.map(d =>
            `<option value="${d.id_usuario}" ${d.id_usuario == HG_FILTROS.docente_id ? 'selected' : ''}>${d.apellido}, ${d.nombre}</option>`
        ).join('');

        content.innerHTML = `
            <div class="card">
                <div class="card-header-flex">
                    <h2 class="card-title" style="border:none;margin:0;padding:0;">
                        <i class="fas fa-calendar-alt"></i> Horarios
                    </h2>
                    <div style="display:flex;gap:.5rem;">
                        <button class="btn btn-verde" onclick="hgExportarExcel()" title="Exportar a Excel">
                            <i class="fas fa-file-excel"></i> Excel
                        </button>
                        <button class="btn btn-rojo" onclick="hgExportarPDF()" title="Exportar a PDF">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                    </div>
                </div>

                <!-- Tabs -->
                <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;border-bottom:2px solid var(--cafe-oscuro);">
                    <button class="tab-btn" id="tab-grupos" onclick="hgCambiarTab('grupos')" style="padding:.75rem 1.5rem;font-weight:bold;border:none;background:none;cursor:pointer;border-bottom:3px solid var(--verde);color:var(--verde);">
                        <i class="fas fa-layer-group"></i> Por Grado y Grupo
                    </button>
                    <button class="tab-btn" id="tab-docentes" onclick="hgCambiarTab('docentes')" style="padding:.75rem 1.5rem;font-weight:bold;border:none;background:none;cursor:pointer;border-bottom:3px solid transparent;color:var(--cafe-claro);">
                        <i class="fas fa-user-tie"></i> Por Docente
                    </button>
                </div>

                <!-- TAB 1: Grado y Grupo -->
                <div id="hg-tab-grupos" style="display:block;">
                    <div class="horario-filtros" style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
                        <div class="form-group" style="flex:1;min-width:220px;">
                            <label><i class="fas fa-layer-group"></i> Grado</label>
                            <select id="hg-filtro-grado" onchange="hgOnGradoChange()">
                                <option value="">— Seleccionar grado —</option>
                                ${opGrados}
                            </select>
                        </div>
                        <div class="form-group" style="flex:1;min-width:160px;">
                            <label><i class="fas fa-users"></i> Grupo</label>
                            <select id="hg-filtro-grupo" onchange="hgOnGrupoChange()" disabled>
                                <option value="">— Primero selecciona grado —</option>
                            </select>
                        </div>
                    </div>
                    <div id="hg-grilla-grupos">
                        <div style="text-align:center;padding:3rem;color:var(--cafe-claro);">
                            <i class="fas fa-calendar-alt" style="font-size:3rem;margin-bottom:1rem;display:block;opacity:.4;"></i>
                            <p>Selecciona un <strong>grado</strong> para ver sus grupos.</p>
                        </div>
                    </div>
                </div>

                <!-- TAB 2: Docente -->
                <div id="hg-tab-docentes" style="display:none;">
                    <div class="horario-filtros" style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
                        <div class="form-group" style="flex:1;min-width:300px;">
                            <label><i class="fas fa-user-tie"></i> Docente</label>
                            <select id="hg-filtro-docente" onchange="hgOnDocenteChange()">
                                <option value="">— Seleccionar docente —</option>
                                ${opDocentes}
                            </select>
                        </div>
                    </div>
                    <div id="hg-grilla-docentes">
                        <div style="text-align:center;padding:3rem;color:var(--cafe-claro);">
                            <i class="fas fa-calendar-alt" style="font-size:3rem;margin-bottom:1rem;display:block;opacity:.4;"></i>
                            <p>Selecciona un <strong>docente</strong> para ver su horario.</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Restaurar filtros si había selección previa
        if (HG_FILTROS.grado_id) {
            await hgOnGradoChange(true);
        }
    } catch (error) {
        content.innerHTML = Helpers.error('No se pudieron cargar los datos.');
        console.error(error);
    }
}

// ── Cambiar tab ────────────────────────────────────────────────────────────

function hgCambiarTab(tab) {
    HG_MODE = tab;
    
    const tab1 = document.getElementById('hg-tab-grupos');
    const tab2 = document.getElementById('hg-tab-docentes');
    const btn1 = document.getElementById('tab-grupos');
    const btn2 = document.getElementById('tab-docentes');

    if (tab === 'grupos') {
        tab1.style.display = 'block';
        tab2.style.display = 'none';
        btn1.style.borderBottomColor = 'var(--verde)';
        btn1.style.color = 'var(--verde)';
        btn2.style.borderBottomColor = 'transparent';
        btn2.style.color = 'var(--cafe-claro)';
        
        // Limpiar selecciones del tab de docentes
        const docenteSel = document.getElementById('hg-filtro-docente');
        if (docenteSel) {
            docenteSel.value = '';
        }
        hgRenderVacio('grupos');
        HG_FILTROS.docente_id = null;
        HG_DATOS = [];
    } else {
        tab1.style.display = 'none';
        tab2.style.display = 'block';
        btn1.style.borderBottomColor = 'transparent';
        btn1.style.color = 'var(--cafe-claro)';
        btn2.style.borderBottomColor = 'var(--verde)';
        btn2.style.color = 'var(--verde)';
        
        // Limpiar selecciones del tab de grupos
        const gradoSel = document.getElementById('hg-filtro-grado');
        const grupoSel = document.getElementById('hg-filtro-grupo');
        if (gradoSel) gradoSel.value = '';
        if (grupoSel) {
            grupoSel.value = '';
            grupoSel.disabled = true;
            grupoSel.innerHTML = '<option value="">— Primero selecciona grado —</option>';
        }
        hgRenderVacio('docentes');
        HG_FILTROS.grado_id = null;
        HG_FILTROS.grupo_id = null;
        HG_DATOS = [];
    }
}

// ── Eventos de filtros - GRUPOS ─────────────────────────────────────────────

async function hgOnGradoChange(preserveGrupo = false) {
    const gradoId  = document.getElementById('hg-filtro-grado').value;
    const grupoSel = document.getElementById('hg-filtro-grupo');

    HG_FILTROS.grado_id = gradoId || null;
    if (!preserveGrupo) {
        HG_FILTROS.grupo_id = null;
    }

    if (!gradoId) {
        grupoSel.innerHTML = '<option value="">— Primero selecciona grado —</option>';
        grupoSel.disabled = true;
        hgRenderVacio('grupos');
        return;
    }

    try {
        const res = await API.request(`/api/grados/${gradoId}/grupos`);
        HG_GRUPOS = res.grupos || [];

        grupoSel.disabled = false;
        grupoSel.innerHTML = '<option value="">— Seleccionar grupo —</option>' +
            HG_GRUPOS.map(g =>
                `<option value="${g.id_grupo}" ${g.id_grupo == HG_FILTROS.grupo_id ? 'selected' : ''}>${g.codigo_grupo}</option>`
            ).join('');

        if (HG_FILTROS.grupo_id) {
            await hgCargarGrilla('grupos');
        }
    } catch (e) {
        console.error('Error cargando grupos:', e);
        grupoSel.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function hgOnGrupoChange() {
    HG_FILTROS.grupo_id = document.getElementById('hg-filtro-grupo').value || null;
    if (HG_FILTROS.grupo_id) {
        await hgCargarGrilla('grupos');
    }
}

async function hgOnDocenteChange() {
    HG_FILTROS.docente_id = document.getElementById('hg-filtro-docente').value || null;
    if (HG_FILTROS.docente_id) {
        await hgCargarGrilla('docentes');
    }
}

// ── Cargar grilla ──────────────────────────────────────────────────────────

async function hgCargarGrilla(source) {
    try {
        let params = new URLSearchParams();
        
        if (source === 'grupos') {
            if (!HG_FILTROS.grupo_id) {
                hgRenderVacio('grupos');
                return;
            }
            params.append('grupo_id', HG_FILTROS.grupo_id);
        } else if (source === 'docentes') {
            if (!HG_FILTROS.docente_id) {
                hgRenderVacio('docentes');
                return;
            }
            params.append('docente_id', HG_FILTROS.docente_id);
        }
        
        const res = await API.request(`/api/horarios?${params.toString()}`);
        HG_DATOS = res.horarios || [];

        hgRenderGrilla(source);
    } catch (e) {
        console.error('Error cargando grilla:', e);
        document.getElementById(source === 'grupos' ? 'hg-grilla-grupos' : 'hg-grilla-docentes').innerHTML = 
            Helpers.error('Error al cargar el horario.');
    }
}



// ── Renderizar grilla ──────────────────────────────────────────────────────

function hgRenderGrilla(source) {
    const containerId = source === 'grupos' ? 'hg-grilla-grupos' : 'hg-grilla-docentes';
    const container = document.getElementById(containerId);
    
    if (HG_DATOS.length === 0) {
        const msg = source === 'grupos' ? 'este grupo' : 'este docente';
        container.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--cafe-claro);">
                <p>No hay horarios registrados para ${msg}.</p>
            </div>
        `;
        return;
    }

    // Obtener nombre según el source
    let nombreReporte = '';
    if (source === 'grupos') {
        const gradoSel = document.getElementById('hg-filtro-grado');
        const grupoSel = document.getElementById('hg-filtro-grupo');
        const gradoNom = gradoSel.options[gradoSel.selectedIndex]?.text || 'Grado';
        const grupoNom = grupoSel.options[grupoSel.selectedIndex]?.text || 'Grupo';
        nombreReporte = `${gradoNom} - ${grupoNom}`;
    } else {
        const docenteSel = document.getElementById('hg-filtro-docente');
        nombreReporte = docenteSel.options[docenteSel.selectedIndex]?.text || 'Docente';
    }

    const materias = [...new Set(HG_DATOS.map(h => h.nombre_materia))];

    let html = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
            <h4 style="margin:0;color:var(--cafe-oscuro);">
                📅 Horario de ${nombreReporte}
            </h4>
            <span style="color:var(--cafe-claro);font-size:.9rem;">
                ${HG_DATOS.length} bloque(s) registrado(s)
            </span>
        </div>
        <div class="table-container" style="overflow-x:auto;margin-bottom:1rem;">
            <table class="horario-table">
                <thead>
                    <tr>
                        <th>HORA</th>
    `;

    // Encabezados de días
    HG_DIAS.forEach(dia => {
        html += `<th>${dia}</th>`;
    });
    html += `</tr></thead><tbody>`;

    // Filas de horas
    HG_HORAS.forEach((hora, idx) => {
        const horaFin = idx + 1 < HG_HORAS.length ? HG_HORAS[idx + 1] : '14:00';
        html += `<tr><td class="hora-cell">${hora}<br><small>${horaFin}</small></td>`;

        HG_DIAS.forEach(dia => {
            const bloque = HG_DATOS.find(h => {
                const [hInicio] = h.hora_inicio.split(':');
                return h.dia_semana === dia && hInicio === hora.split(':')[0];
            });

            if (bloque) {
                const color = hgGetColor(bloque.id_materia);
                const docenteNom = `${bloque.docente_apellido || ''} ${bloque.docente_nombre || ''}`.trim() || 'Sin profesor';
                html += `
                    <td style="background:${color};color:#475569;vertical-align:middle;text-align:center;padding:.5rem;font-weight:bold;">
                        <div style="font-size:.9rem;margin-bottom:.2rem;">${bloque.nombre_materia}</div>
                        <div style="font-size:.75rem;opacity:.8;">${docenteNom}</div>
                        <div style="font-size:.7rem;color:#666;">${bloque.hora_inicio} - ${bloque.hora_fin}</div>
                    </td>
                `;
            } else {
                html += `<td style="background:#f9f5f0;"></td>`;
            }
        });

        html += `</tr>`;
    });

    html += `</tbody></table></div>`;

    // Leyenda
    if (materias.length > 0) {
        html += `<div class="horario-leyenda" style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:.5rem;">`;
        materias.forEach(materia => {
            const datos = HG_DATOS.find(h => h.nombre_materia === materia);
            const color = hgGetColor(datos.id_materia);
            html += `<span class="badge" style="background:${color};color:#475569;padding:.25rem .75rem;border-radius:12px;font-size:.8rem;">${materia}</span>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
}

function hgRenderVacio(source) {
    const containerId = source === 'grupos' ? 'hg-grilla-grupos' : 'hg-grilla-docentes';
    const msg = source === 'grupos' ? 'grado' : 'docente';
    document.getElementById(containerId).innerHTML = `
        <div style="text-align:center;padding:3rem;color:var(--cafe-claro);">
            <i class="fas fa-calendar-alt" style="font-size:3rem;margin-bottom:1rem;display:block;opacity:.4;"></i>
            <p>Selecciona un <strong>${msg}</strong> para ver el horario.</p>
        </div>
    `;
}

// ── Exportar ───────────────────────────────────────────────────────────────

function hgExportarExcel() {
    if (HG_DATOS.length === 0) {
        const msg = HG_MODE === 'grupos' ? 'Selecciona un grupo primero.' : 'Selecciona un docente primero.';
        mostrarAlerta(`No hay horario para exportar. ${msg}`, 'info');
        return;
    }

    let nombreReporte = '';
    if (HG_MODE === 'grupos') {
        const gradoSel = document.getElementById('hg-filtro-grado');
        const grupoSel = document.getElementById('hg-filtro-grupo');
        const gradoNom = gradoSel.options[gradoSel.selectedIndex]?.text || 'Grado';
        const grupoNom = grupoSel.options[grupoSel.selectedIndex]?.text || 'Grupo';
        nombreReporte = `${gradoNom} - ${grupoNom}`;
    } else {
        const docenteSel = document.getElementById('hg-filtro-docente');
        nombreReporte = docenteSel.options[docenteSel.selectedIndex]?.text || 'Docente';
    }

    // Crear estructura de datos para tabla tipo grilla (como PDF)
    const datos = [];
    
    // Encabezados
    datos.push(['INSTITUCIÓN EDUCATIVA INEM JULIÁN MOTTA SALAS']);
    datos.push(['Horario Semanal']);
    datos.push([]);
    datos.push([HG_MODE === 'grupos' ? 'Grado/Grupo:' : 'Docente:', nombreReporte]);
    datos.push(['Generado:', new Date().toLocaleDateString()]);
    datos.push([]);
    
    // Encabezado de tabla
    datos.push(['HORA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES']);
    
    // Crear grilla horaria
    HG_HORAS.forEach((hora, idx) => {
        const horaFin = idx + 1 < HG_HORAS.length ? HG_HORAS[idx + 1] : '14:00';
        const fila = [`${hora}-${horaFin}`];
        
        HG_DIAS.forEach(dia => {
            const bloque = HG_DATOS.find(b => 
                b.dia_semana === dia && 
                b.hora_inicio.substring(0, 5) === hora
            );
            
            if (bloque) {
                if (HG_MODE === 'grupos') {
                    const docenteNom = `${bloque.docente_apellido || ''} ${bloque.docente_nombre || ''}`.trim();
                    // Usar \u000A para salto de línea en Excel
                    fila.push(`${bloque.nombre_materia}\u000A${docenteNom}`);
                } else {
                    fila.push(`${bloque.nombre_materia}\u000A${bloque.codigo_grupo || ''}`);
                }
            } else {
                // Casilla vacía con salto de línea para mantener altura uniforme
                fila.push('\u000A');
            }
        });
        
        datos.push(fila);
    });
    
    // Crear worksheet
    const ws = XLSX.utils.aoa_to_sheet(datos);
    
    // Aplicar estilos
    const wb = XLSX.utils.book_new();
    
    // Anchos de columnas
    ws['!cols'] = [
        { wch: 15 },   // HORA
        { wch: 22 },   // LUNES
        { wch: 22 },   // MARTES
        { wch: 22 },   // MIÉRCOLES
        { wch: 22 },   // JUEVES
        { wch: 22 }    // VIERNES
    ];
    
    // Alturas de filas
    ws['!rows'] = [];
    
    // Encabezados
    for (let i = 0; i < 7; i++) {
        ws['!rows'][i] = { hpx: 20 };
    }
    
    // Filas de datos (mucho más alto para acomodar 2 líneas)
    for (let i = 7; i < datos.length; i++) {
        ws['!rows'][i] = { hpx: 45 };
    }
    
    // Aplicar formato a encabezado de tabla (fila 7, índice 6)
    const encabezados = ['A7', 'B7', 'C7', 'D7', 'E7', 'F7'];
    encabezados.forEach(cell => {
        if (!ws[cell]) ws[cell] = {};
        ws[cell].s = {
            font: { bold: true, sz: 12, color: { rgb: 'FFFFFFFF' } },
            fill: { fgColor: { rgb: 'FF0F6B42' } },  // Color institucional
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
            border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
            }
        };
    });
    
    // Aplicar formato a TODAS las celdas de datos (desde fila 8 en adelante)
    for (let rowIdx = 7; rowIdx < datos.length; rowIdx++) {
        for (let colIdx = 0; colIdx < 6; colIdx++) {
            const cellAddr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
            
            if (!ws[cellAddr]) ws[cellAddr] = {};
            
            ws[cellAddr].s = {
                alignment: { 
                    horizontal: 'center', 
                    vertical: 'center', 
                    wrapText: true,
                    shrinkToFit: false
                },
                font: { sz: 10 },
                border: {
                    top: { style: 'thin' },
                    bottom: { style: 'thin' },
                    left: { style: 'thin' },
                    right: { style: 'thin' }
                }
            };
        }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'Horario');
    XLSX.writeFile(wb, `Horario_${nombreReporte.replace(/[\s,]/g, '_')}.xlsx`);
    mostrarAlerta('Horario exportado a Excel', 'exito');
}

function hgExportarPDF() {
    if (HG_DATOS.length === 0) {
        const msg = HG_MODE === 'grupos' ? 'Selecciona un grupo primero.' : 'Selecciona un docente primero.';
        mostrarAlerta(`No hay horario para exportar. ${msg}`, 'info');
        return;
    }

    let nombreReporte = '';
    if (HG_MODE === 'grupos') {
        const gradoSel = document.getElementById('hg-filtro-grado');
        const grupoSel = document.getElementById('hg-filtro-grupo');
        const gradoNom = gradoSel.options[gradoSel.selectedIndex]?.text || 'Grado';
        const grupoNom = grupoSel.options[grupoSel.selectedIndex]?.text || 'Grupo';
        nombreReporte = `${gradoNom} - ${grupoNom}`;
    } else {
        const docenteSel = document.getElementById('hg-filtro-docente');
        nombreReporte = docenteSel.options[docenteSel.selectedIndex]?.text || 'Docente';
    }

    // Enviar al backend para generar PDF
    try {
        const payload = {
            horarios: HG_DATOS,
            titulo: nombreReporte,
            tipo: HG_MODE
        };

        // Hacer POST al servidor
        fetch('/api/horarios/exportar-pdf', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.blob();
        })
        .then(blob => {
            // Crear URL temporal y descargar
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Horario_${nombreReporte.replace(/[\s,]/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            mostrarAlerta('Horario exportado a PDF correctamente', 'exito');
        })
        .catch(error => {
            console.error('Error al descargar PDF:', error);
            mostrarAlerta('Error al descargar PDF: ' + error.message, 'error');
        });
    } catch (e) {
        console.error('Error:', e);
        mostrarAlerta('Error al procesar exportación: ' + e.message, 'error');
    }
}
