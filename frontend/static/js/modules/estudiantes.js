// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO ESTUDIANTES
// CRUD completo de estudiantes
// ════════════════════════════════════════════════════════════════════════════════

let ESTUDIANTES_CACHE = [];
let GRUPOS_CACHE_EST = []; // Cache local para evitar conflictos
let PERIODOS_CACHE_EST = [];

function fechaLocalHoyEstudiantes() {
    const hoy = new Date();
    const pad = valor => String(valor).padStart(2, '0');
    return `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-${pad(hoy.getDate())}`;
}

function validarNombreEstudiante(valor) {
    const nombre = valor.trim().replace(/\s+/g, ' ');
    return /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(nombre);
}

function normalizarNombrePersonaEstudiante(valor) {
    return valor
        .replace(/[^\p{L}\p{M} '\u2019-]/gu, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizarTelefonoEstudiante(valor) {
    return valor.replace(/\D/g, '').slice(0, 15);
}

function normalizarDocumentoEstudiante(valor) {
    return valor.replace(/[^0-9]/g, '');
}

function configurarCamposNombreEstudiante() {
    for (const id of ['estudiante-nombre', 'estudiante-apellido', 'estudiante-acudiente-nombre']) {
        const input = document.getElementById(id);
        if (!input || input.dataset.filtroNombreConfigurado) continue;

        input.addEventListener('input', () => {
            const inicio = input.selectionStart;
            const valorNormalizado = normalizarNombrePersonaEstudiante(input.value);
            if (input.value !== valorNormalizado) {
                input.value = valorNormalizado;
                input.setSelectionRange(Math.min(inicio, input.value.length), Math.min(inicio, input.value.length));
            }
        });
        input.dataset.filtroNombreConfigurado = 'true';
    }
}

function configurarDocumentoEstudiante() {
    const input = document.getElementById('estudiante-documento');
    if (!input || input.dataset.filtroDocumentoConfigurado) return;

    input.addEventListener('input', () => {
        const inicio = input.selectionStart;
        const documentoNormalizado = normalizarDocumentoEstudiante(input.value);
        if (input.value !== documentoNormalizado) {
            input.value = documentoNormalizado;
            input.setSelectionRange(Math.min(inicio, input.value.length), Math.min(inicio, input.value.length));
        }
    });
    input.dataset.filtroDocumentoConfigurado = 'true';
}

function configurarTelefonoEstudiante() {
    const input = document.getElementById('estudiante-acudiente-telefono');
    if (!input || input.dataset.filtroTelefonoConfigurado) return;

    input.addEventListener('input', () => {
        const inicio = input.selectionStart;
        const telefonoNormalizado = normalizarTelefonoEstudiante(input.value);
        if (input.value !== telefonoNormalizado) {
            input.value = telefonoNormalizado;
            input.setSelectionRange(Math.min(inicio, input.value.length), Math.min(inicio, input.value.length));
        }
    });
    input.dataset.filtroTelefonoConfigurado = 'true';
}

async function renderEstudiantes() {
    const content = document.getElementById('main-content');
    content.innerHTML = Helpers.loading();

    try {
        const [estudiantesRes, gruposRes] = await Promise.all([
            API.getEstudiantes(),
            API.getGrupos()
        ]);

        ESTUDIANTES_CACHE = estudiantesRes.estudiantes || [];
        GRUPOS_CACHE_EST = gruposRes.grupos || [];

        const opcionesGrado = Array.from(new Set(GRUPOS_CACHE_EST.map(g => g.nombre_grado))).filter(Boolean);

        const htmlRes = await fetch('/templates/modules html/estudiantes.html');
        if (!htmlRes.ok) throw new Error('Error cargando la vista de estudiantes');
        content.innerHTML = await htmlRes.text();

        const selectGrado = document.getElementById('filtro-estudiante-grado');
        const selectGrupo = document.getElementById('filtro-estudiante-grupo');

        selectGrado.innerHTML = '<option value="">Todos los grados</option>' + 
            opcionesGrado.map(g => `<option value="${g}">${g}</option>`).join('');
        actualizarOpcionesGrupoEstudiantes(selectGrado.value);

        document.getElementById('filtro-estudiante-buscar').addEventListener('input', aplicarFiltrosEstudiantes);
        document.getElementById('filtro-estudiante-grado').addEventListener('change', () => {
            actualizarOpcionesGrupoEstudiantes(selectGrado.value);
            aplicarFiltrosEstudiantes();
        });
        document.getElementById('filtro-estudiante-grupo').addEventListener('change', aplicarFiltrosEstudiantes);
        document.getElementById('filtro-estudiante-estado').addEventListener('change', aplicarFiltrosEstudiantes);

        aplicarFiltrosEstudiantes();
    } catch (error) {
        console.error('Error renderEstudiantes', error);
        content.innerHTML = Helpers.error('No se pudieron cargar los estudiantes.');
    }
}

function actualizarOpcionesGrupoEstudiantes(grado) {
    const selectGrupo = document.getElementById('filtro-estudiante-grupo');
    if (!selectGrupo) return;

    const grupos = GRUPOS_CACHE_EST.filter(g => !grado || String(g.nombre_grado) === String(grado));
    selectGrupo.innerHTML = '<option value="">Todos los grupos</option>' +
        grupos.map(g => `<option value="${g.id_grupo}">${g.codigo_grupo}${g.nombre_grado ? ` (${g.nombre_grado})` : ''}</option>`).join('');
}

function aplicarFiltrosEstudiantes() {
    const buscar = (document.getElementById('filtro-estudiante-buscar')?.value || '').toLowerCase();
    const grado = document.getElementById('filtro-estudiante-grado')?.value || '';
    const grupo = document.getElementById('filtro-estudiante-grupo')?.value || '';
    const estado = document.getElementById('filtro-estudiante-estado')?.value || '';

    const filtrados = ESTUDIANTES_CACHE.filter(e => {
        const coincideBusqueda = !buscar || `${e.nombre} ${e.apellido} ${e.documento}`.toLowerCase().includes(buscar);
        const grupoData = GRUPOS_CACHE_EST.find(g => String(g.id_grupo) === String(e.id_grupo));
        const nombreGrado = grupoData ? grupoData.nombre_grado : e.nombre_grado;
        const coincideGrado = !grado || nombreGrado === grado;
        const coincideGrupo = !grupo || String(e.id_grupo) === String(grupo);
        const coincideEstado = !estado || String(e.estado).toLowerCase() === estado.toLowerCase();
        return coincideBusqueda && coincideGrado && coincideGrupo && coincideEstado;
    });

    dibujarTablaEstudiantes(filtrados);
}

function dibujarTablaEstudiantes(lista) {
    const tbody = document.getElementById('tbody-estudiantes');
    if (!tbody) return;

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="7">${Helpers.sinDatos('No hay estudiantes')}</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(e => {
        const grupoData = GRUPOS_CACHE_EST.find(g => String(g.id_grupo) === String(e.id_grupo));
        const gradoGrupo = grupoData ? `${grupoData.nombre_grado} / ${grupoData.codigo_grupo}` : `${e.nombre_grado || ''} / ${e.codigo_grupo || ''}`;
        const acudiente = e.acudiente_nombre ? `${e.acudiente_nombre}${e.acudiente_telefono ? ' - ' + e.acudiente_telefono : ''}` : '-';
        return `
            <tr>
                <td>${e.id_estudiante}</td>
                <td>${e.documento || '-'}</td>
                <td>${Helpers.celdaUsuario(e.nombre, e.apellido)}</td>
                <td>${gradoGrupo}</td>
                <td>${acudiente}</td>
                <td>${Helpers.badgeEstado(e.estado)}</td>
                <td>
                    <div class="acciones-btns">
                        <button class="btn-accion btn-accion-cafe" title="Ver" onclick="verEstudiante(${e.id_estudiante})"><i class="fas fa-eye"></i></button>
                        <button class="btn-accion btn-accion-azul" title="Boletín" onclick="abrirModalBoletinEstudiante(${e.id_estudiante})"><i class="fas fa-file-pdf"></i></button>
                        <button class="btn-accion btn-accion-verde" title="Editar" onclick="abrirModalEstudiante(${e.id_estudiante})"><i class="fas fa-edit"></i></button>
                        <button class="btn-accion btn-accion-rojo" title="Eliminar" onclick="eliminarEstudiante(${e.id_estudiante})"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function abrirModalBoletinEstudiante(id) {
    const overlay = document.getElementById('modal-boletin-estudiante');
    if (!overlay) {
        mostrarAlerta('No se encontró el modal de boletín', 'error');
        return;
    }
    overlay.classList.add('active');
    document.getElementById('boletin-estudiante-id').value = id;

    if (!PERIODOS_CACHE_EST.length) {
        try {
            const res = await API.getPeriodos();
            PERIODOS_CACHE_EST = res.periodos || [];
        } catch (e) {
            mostrarAlerta('No se pudieron cargar los períodos', 'error');
            return;
        }
    }

    const select = document.getElementById('boletin-estudiante-periodo');
    if (select) {
        select.innerHTML = PERIODOS_CACHE_EST.map(p => {
            const activo = p.estado === 'Abierto' ? ' (Activo)' : '';
            return `<option value="${p.id_periodo}">${p.nombre_periodo || ('Período ' + p.numero_periodo)}${activo}</option>`;
        }).join('');
    }
}

async function descargarBoletinEstudiante() {
    const estudianteId = document.getElementById('boletin-estudiante-id')?.value;
    const periodoId = document.getElementById('boletin-estudiante-periodo')?.value;
    if (!estudianteId || !periodoId) {
        mostrarAlerta('Selecciona el período', 'error');
        return;
    }

    try {
        const res = await fetch('/api/boletines/generar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_estudiante: estudianteId, periodo_id: periodoId, formato: 'pdf' })
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error generando el boletín');
        }

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Boletin_${estudianteId}_P${periodoId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        mostrarAlerta('Boletín generado sin problemas', 'success');
    } catch (e) {
        mostrarAlerta(e.message || 'No se pudo generar el boletín', 'error');
    }
}

async function abrirModalEstudiante(id = null) {
    const overlay = document.getElementById('modal-estudiante');
    overlay.classList.add('active');
    configurarCamposNombreEstudiante();
    configurarDocumentoEstudiante();
    configurarTelefonoEstudiante();
    document.getElementById('modal-estudiante-titulo').textContent = id ? 'Editar Estudiante' : 'Nuevo Estudiante';
    document.getElementById('form-estudiante').reset();
    document.getElementById('estudiante-id').value = id || '';
    const fechaNacimiento = document.getElementById('estudiante-fecha-nacimiento');
    if (fechaNacimiento) fechaNacimiento.max = fechaLocalHoyEstudiantes();

    if (!GRUPOS_CACHE_EST.length) {
        try {
            const gruposRes = await API.getGrupos();
            GRUPOS_CACHE_EST = gruposRes.grupos || [];
        } catch (err) {
            mostrarAlerta('No se pudieron cargar los grupos', 'error');
            return;
        }
    }

    _poblarSelectGruposEstudiante();

    if (id) {
        try {
            const res = await API.getEstudiante(id);
            const e = res.estudiante;
            if (!e) throw new Error('Estudiante no encontrado');

            document.getElementById('estudiante-documento').value = normalizarDocumentoEstudiante(e.documento || '');
            document.getElementById('estudiante-nombre').value = normalizarNombrePersonaEstudiante(e.nombre || '');
            document.getElementById('estudiante-apellido').value = normalizarNombrePersonaEstudiante(e.apellido || '');

            const fechaElement = document.getElementById('estudiante-fecha-nacimiento');
            if (fechaElement && e.fecha_nacimiento) {
                fechaElement.value = e.fecha_nacimiento.substring(0, 10);
            }

            document.getElementById('estudiante-correo').value = e.correo || '';
            document.getElementById('estudiante-genero').value = e.genero || 'M';
            document.getElementById('estudiante-grupo').value = e.id_grupo;
            document.getElementById('estudiante-acudiente-nombre').value = normalizarNombrePersonaEstudiante(e.acudiente_nombre || '');
            document.getElementById('estudiante-acudiente-telefono').value = normalizarTelefonoEstudiante(e.acudiente_telefono || '');
            document.getElementById('estudiante-direccion').value = e.direccion || '';
            document.getElementById('estudiante-estado').value = e.estado || 'Activo';
        } catch (error) {
            console.error('Error cargando estudiante', error);
            mostrarAlerta('No se pudo cargar el estudiante', 'error');
            cerrarModal('modal-estudiante');
            return;
        }
    } else {
        document.getElementById('estudiante-estado').value = 'Activo';
    }

    document.getElementById('form-estudiante').onsubmit = _submitEstudiante;
}

function _poblarSelectGruposEstudiante() {
    const select = document.getElementById('estudiante-grupo');
    if (!select) return;
    select.innerHTML = GRUPOS_CACHE_EST.map(g => `<option value="${g.id_grupo}">${g.codigo_grupo} - ${g.nombre_grado}</option>`).join('');
}

async function _submitEstudiante(event) {
    event.preventDefault();
    const id = document.getElementById('estudiante-id').value;
    const documento = document.getElementById('estudiante-documento');
    documento.value = normalizarDocumentoEstudiante(documento.value);
    if (!documento.value) {
        mostrarAlerta('El documento es obligatorio y solo puede contener números.', 'error');
        documento.focus();
        return;
    }
    const camposNombre = [
        ['estudiante-nombre', 'El nombre', true],
        ['estudiante-apellido', 'El apellido', true],
        ['estudiante-acudiente-nombre', 'El nombre del acudiente', false]
    ];
    for (const [idCampo, etiqueta, obligatorio] of camposNombre) {
        const input = document.getElementById(idCampo);
        const valor = input.value.trim();
        if ((obligatorio && !valor) || (valor && !validarNombreEstudiante(valor))) {
            mostrarAlerta(`${etiqueta}: solo se permiten letras, espacios, apóstrofes o guiones.`, 'error');
            input.focus();
            return;
        }
    }
    const fechaNacimiento = document.getElementById('estudiante-fecha-nacimiento');
    if (fechaNacimiento?.value && fechaNacimiento.value > fechaLocalHoyEstudiantes()) {
        mostrarAlerta('La fecha de nacimiento no puede ser futura', 'error');
        fechaNacimiento.focus();
        return;
    }

    const payload = {
        documento: documento.value,
        nombre: normalizarNombrePersonaEstudiante(document.getElementById('estudiante-nombre').value),
        apellido: normalizarNombrePersonaEstudiante(document.getElementById('estudiante-apellido').value),
        correo: document.getElementById('estudiante-correo').value,
        fecha_nacimiento: document.getElementById('estudiante-fecha-nacimiento').value || null,
        genero: document.getElementById('estudiante-genero').value,
        id_grupo: document.getElementById('estudiante-grupo').value,
        acudiente_nombre: normalizarNombrePersonaEstudiante(document.getElementById('estudiante-acudiente-nombre').value),
        acudiente_telefono: normalizarTelefonoEstudiante(document.getElementById('estudiante-acudiente-telefono').value),
        direccion: document.getElementById('estudiante-direccion').value,
        estado: document.getElementById('estudiante-estado').value
    };

    try {
        if (id) {
            await API.actualizarEstudiante(id, payload);
            mostrarAlerta('Estudiante actualizado', 'success');
        } else {
            await API.crearEstudiante(payload);
            mostrarAlerta('Estudiante creado', 'success');
        }
        cerrarModal('modal-estudiante');
        renderEstudiantes();
    } catch (error) {
        mostrarAlerta(error.message || 'No se pudo guardar el estudiante', 'error');
    }
}

async function eliminarEstudiante(id) {
    const overlay = document.getElementById('modal-eliminar-estudiante');
    overlay.classList.add('active');

    const btnEliminar = document.getElementById('btn-confirmar-eliminar-estudiante');
    const btnInactivar = document.getElementById('btn-inactivar-estudiante');

    const nuevoEliminar = btnEliminar.cloneNode(true);
    btnEliminar.parentNode.replaceChild(nuevoEliminar, btnEliminar);
    const nuevoInactivar = btnInactivar.cloneNode(true);
    btnInactivar.parentNode.replaceChild(nuevoInactivar, btnInactivar);

    nuevoEliminar.onclick = async () => {
        try {
            await API.eliminarEstudiante(id);
            mostrarAlerta('Estudiante eliminado', 'success');
            cerrarModal('modal-eliminar-estudiante');
            renderEstudiantes();
        } catch (error) {
            mostrarAlerta(error.message || 'No se pudo eliminar', 'error');
        }
    };

    nuevoInactivar.onclick = async () => {
        try {
            const res = await API.getEstudiante(id);
            const e = res.estudiante;
            if (!e) throw new Error('No encontrado');
            await API.actualizarEstudiante(id, {
                documento: e.documento, nombre: e.nombre, apellido: e.apellido,
                correo: e.correo, id_grupo: e.id_grupo,
                acudiente_nombre: e.acudiente_nombre, acudiente_telefono: e.acudiente_telefono,
                direccion: e.direccion, estado: 'Inactivo'
            });
            mostrarAlerta('Estudiante marcado como inactivo', 'success');
            cerrarModal('modal-eliminar-estudiante');
            renderEstudiantes();
        } catch (error) {
            mostrarAlerta(error.message || 'No se pudo inactivar', 'error');
        }
    };
}

async function verEstudiante(id) {
    const overlay = document.getElementById('modal-ver-estudiante');
    const body = document.getElementById('ver-estudiante-body');
    overlay.classList.add('active');
    body.innerHTML = Helpers.loading();

    try {
        const res = await API.getEstudiante(id);
        const e = res.estudiante;
        if (!e) throw new Error('No encontrado');
        const grupoData = GRUPOS_CACHE_EST.find(g => String(g.id_grupo) === String(e.id_grupo));
        const gradoGrupo = grupoData ? `${grupoData.nombre_grado} / ${grupoData.codigo_grupo}` : `${e.nombre_grado || ''} / ${e.codigo_grupo || ''}`;
        const fechaNac = e.fecha_nacimiento ? e.fecha_nacimiento.split('T')[0] : '-';
        const iniciales = Helpers.getIniciales(e.nombre, e.apellido);

        body.innerHTML = `
            <div class="detalle-estudiante">
                <div class="detalle-avatar">
                    <div class="avatar-grande">${iniciales}</div>
                    <h3>${e.nombre} ${e.apellido}</h3>
                    <span class="badge badge-cafe">${gradoGrupo}</span>
                </div>
                <div class="detalle-info">
                    <div class="detalle-item"><i class="fas fa-id-card"></i><div><label>Documento</label><span>${e.documento || '-'}</span></div></div>
                    <div class="detalle-item"><i class="fas fa-envelope"></i><div><label>Correo</label><span>${e.correo || '-'}</span></div></div>
                    <div class="detalle-item"><i class="fas fa-calendar"></i><div><label>Fecha de nacimiento</label><span>${fechaNac}</span></div></div>
                    <div class="detalle-item"><i class="fas fa-venus-mars"></i><div><label>Género</label><span>${e.genero || '-'}</span></div></div>
                    <div class="detalle-item"><i class="fas fa-users"></i><div><label>Grupo</label><span>${gradoGrupo}</span></div></div>
                    <div class="detalle-item"><i class="fas fa-toggle-on"></i><div><label>Estado</label><span>${e.estado}</span></div></div>
                    <div class="detalle-item"><i class="fas fa-user-friends"></i><div><label>Acudiente</label><span>${e.acudiente_nombre || '-'}${e.acudiente_telefono ? ' - ' + e.acudiente_telefono : ''}</span></div></div>
                    <div class="detalle-item"><i class="fas fa-home"></i><div><label>Dirección</label><span>${e.direccion || '-'}</span></div></div>
                </div>
            </div>
        `;
    } catch (error) {
        body.innerHTML = Helpers.error('No se pudo cargar el estudiante');
    }
}
