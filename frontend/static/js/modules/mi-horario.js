// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO MI HORARIO (vista solo lectura para docentes)
// Muestra la grilla semanal personal del profesor conectado
// ════════════════════════════════════════════════════════════════════════════════

const MI_HORARIO_COLORES = [
    'rgba(255, 205, 205, 0.42)',  // Rojo pastel
    'rgba(255, 226, 190, 0.42)',  // Naranja pastel
    'rgba(255, 246, 193, 0.42)',  // Amarillo pastel
    'rgba(209, 236, 209, 0.42)',  // Verde pastel
    'rgba(208, 228, 255, 0.42)',  // Azul pastel
    'rgba(231, 214, 244, 0.42)',  // Lila pastel
    'rgba(255, 214, 232, 0.42)',  // Rosa pastel
    'rgba(214, 240, 240, 0.42)',  // Turquesa pastel
    'rgba(233, 233, 205, 0.42)',  // Oliva claro
    'rgba(199, 226, 255, 0.42)'   // Azul cielo pastel
];
let _miColorIdx = 0;
const _miColorMap = {};
function getMiColorMateria(idMateria) {
    if (!_miColorMap[idMateria]) {
        _miColorMap[idMateria] = MI_HORARIO_COLORES[_miColorIdx % MI_HORARIO_COLORES.length];
        _miColorIdx++;
    }
    return _miColorMap[idMateria];
}

// tengo que cambiar los tres de rango de hora para poner en la grilita
const MI_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const MI_HORAS = [];
for (let h = 7; h <= 13; h++) {
    MI_HORAS.push(`${String(h).padStart(2,'0')}:00`);
}

let MI_HORARIO_DATOS = [];
let MI_HORARIO_TITULO = 'Mi Horario';

async function renderMiHorario() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const res = await API.getMiHorario();
        const bloques = res.horario || [];
        const nombreDocente = (typeof USUARIO !== 'undefined' && USUARIO.nombre) ? USUARIO.nombre : 'Docente';
        MI_HORARIO_TITULO = `Mi Horario - ${nombreDocente}`;
        MI_HORARIO_DATOS = bloques;

        if (bloques.length === 0) {
            MI_HORARIO_DATOS = [];
            content.innerHTML = `
                <div class="card">
                    <div class="card-header-flex">
                        <h2 class="card-title" style="border:none;margin:0;padding:0;">
                            <i class="fas fa-calendar-alt"></i> Mi Horario
                        </h2>
                    </div>
                    ${Helpers.sinDatos('No tienes bloques de horario asignados aún.')}
                </div>
            `;
            return;
        }

        // Construir grilla
        let gridHtml = `
            <div class="horario-scroll" style="overflow-x:auto;">
            <table class="horario-grid mi-horario-grid">
                <thead>
                    <tr>
                        <th class="hora-col">Hora</th>
                        ${MI_DIAS.map(d => `<th>${d}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
        `;

        MI_HORAS.forEach(hora => {
            const horaNum = parseInt(hora.split(':')[0]);
            const horaFin = `${String(horaNum + 1).padStart(2,'0')}:00`;

            gridHtml += `<tr>`;
            gridHtml += `<td class="hora-col"><strong>${hora}</strong><br><span style="font-size:.75rem;color:var(--cafe-claro)">${horaFin}</span></td>`;

            MI_DIAS.forEach(dia => {
                const celda = bloques.filter(b => {
                    const bi = b.hora_inicio.substring(0, 5);
                    const bf = b.hora_fin.substring(0, 5);
                    return b.dia_semana === dia && bi <= hora && bf > hora;
                });

                if (celda.length > 0) {
                    const b = celda[0];
                    const bi = b.hora_inicio.substring(0, 5);
                    if (bi === hora) {
                        const bfH = parseInt(b.hora_fin.substring(0, 2));
                        const biH = parseInt(b.hora_inicio.substring(0, 2));
                        const span = bfH - biH;
                        const color = getMiColorMateria(b.id_materia);
                        gridHtml += `<td class="horario-celda ocupada" rowspan="${span}" style="background:${color};">
                            <div class="horario-bloque">
                                <strong class="horario-materia">${b.nombre_materia}</strong>
                                <span class="horario-grupo-info">${b.nombre_grado || ''} — ${b.codigo_grupo || ''}</span>
                                <span class="horario-hora">${bi} - ${b.hora_fin.substring(0,5)}</span>
                                ${b.aula ? `<span class="horario-aula"><i class="fas fa-door-open"></i> ${b.aula}</span>` : ''}
                            </div>
                        </td>`;
                    }
                    // rowspan handles intermediate cells
                } else {
                    gridHtml += `<td class="horario-celda vacia-readonly"></td>`;
                }
            });
            gridHtml += `</tr>`;
        });

        gridHtml += `</tbody></table></div>`;

        // Leyenda
        const materiasUnicas = [...new Map(bloques.map(b => [b.id_materia, b.nombre_materia])).entries()];
        let leyenda = `<div class="horario-leyenda" style="margin-top:1rem;display:flex;flex-wrap:wrap;gap:.5rem;">`;
        materiasUnicas.forEach(([id, nombre]) => {
            leyenda += `<span class="badge" style="background:${getMiColorMateria(id)};color:#475569;padding:.25rem .75rem;border-radius:12px;font-size:.8rem;">${nombre}</span>`;
        });
        leyenda += `</div>`;

        // Resumen
        const totalHoras = bloques.length;
        const diasConClase = new Set(bloques.map(b => b.dia_semana)).size;

        content.innerHTML = `
            <div class="card">
                <div class="card-header-flex">
                    <h2 class="card-title" style="border:none;margin:0;padding:0;">
                        <i class="fas fa-calendar-alt"></i> Mi Horario
                    </h2>
                    <div style="display:flex;gap:1rem;align-items:center;">
                        <div style="display:flex;gap:1rem;font-size:.9rem;color:var(--cafe-claro);">
                            <span><i class="fas fa-clock"></i> ${totalHoras} bloque(s)</span>
                            <span><i class="fas fa-calendar-check"></i> ${diasConClase} día(s) con clases</span>
                        </div>
                        <button class="btn btn-rojo" onclick="miHorarioExportarPDF()" title="Descargar horario en PDF">
                            <i class="fas fa-file-pdf"></i> PDF
                        </button>
                    </div>
                </div>
                ${gridHtml}
                ${leyenda}
            </div>
        `;

    } catch (error) {
        content.innerHTML = Helpers.error('No se pudo cargar tu horario.');
        console.error(error);
    }
}

function miHorarioExportarPDF() {
    if (MI_HORARIO_DATOS.length === 0) {
        mostrarAlerta('No hay horario para exportar.', 'info');
        return;
    }

    try {
        const payload = {
            horarios: MI_HORARIO_DATOS,
            titulo: MI_HORARIO_TITULO,
            tipo: 'docentes'
        };

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
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Horario_${MI_HORARIO_TITULO.replace(/[\s,]/g, '_')}.pdf`;
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
        mostrarAlerta('Error al procesar exportacion: ' + e.message, 'error');
    }
}
