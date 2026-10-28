// ════════════════════════════════════════════════════════════════════════════════
// MÓDULO CALIFICACIONES (REGISTRO DE NOTAS)
// Interfaz tipo Excel con filtros dinámicos, actividades, ponderación y notas.
// Mantiene también el flujo de descarga/subida de planilla física.
// ════════════════════════════════════════════════════════════════════════════════
const CalificacionesModule = {
    grados: [],
    grupos: [],
    materias: [],
    periodos: [],
    estudiantes: [],
    actividades: [],
    notas: {},
    notasModificadas: new Set(),
    filtros: { grado: null, grupo: null, materia: null, periodo: null },
    fechaActividadSeleccionada: null,
    acuerdoPdfUrl: null,
    _tableEventsBound: false,
    _tableWrapper: null,

    async init() {
        await this.render();
        this.bindEvents();
        this.cargarFiltrosBase();
    },

    async render() {
        const container = document.getElementById('main-content');
        container.innerHTML = Helpers.loading();
        
        try {
            const htmlRes = await fetch('/templates/modules html/calificaciones.html');
            if (!htmlRes.ok) throw new Error('Error cargando la vista de calificaciones');
            container.innerHTML = await htmlRes.text();
            
        } catch (error) {
            console.error('Error render Calificaciones:', error);
            container.innerHTML = Helpers.error('No se pudo cargar la vista de calificaciones.');
        }
    },

    async recargarModulo(mantenerFiltros = true) {
        const filtrosPrev = { ...this.filtros };
        const fechaPrev = this.fechaActividadSeleccionada;

        this._tableEventsBound = false;
        this._tableWrapper = null;

        await this.render();
        this.bindEvents();
        await this.cargarFiltrosBase();
        this.fechaActividadSeleccionada = fechaPrev;

        if (!mantenerFiltros) return;

        if (filtrosPrev.grado) {
            const selGrado = document.getElementById('cal-filtro-grado');
            if (selGrado) selGrado.value = filtrosPrev.grado;
            await this.cambiarGrado(filtrosPrev.grado);
        }

        if (filtrosPrev.grupo) {
            const selGrupo = document.getElementById('cal-filtro-grupo');
            if (selGrupo) selGrupo.value = filtrosPrev.grupo;
            await this.cambiarGrupo(filtrosPrev.grupo);
        }

        if (filtrosPrev.materia) {
            const selMateria = document.getElementById('cal-filtro-materia');
            if (selMateria) selMateria.value = filtrosPrev.materia;
            this.cambiarMateria(filtrosPrev.materia);
        }

        if (filtrosPrev.periodo) {
            const selPeriodo = document.getElementById('cal-filtro-periodo');
            if (selPeriodo) selPeriodo.value = filtrosPrev.periodo;
            this.cambiarPeriodo(filtrosPrev.periodo);
        }

        if (filtrosPrev.grupo && filtrosPrev.materia && filtrosPrev.periodo) {
            await this.cargarTabla();
        }
    },

    bindEvents() {
        document.getElementById('btn-sincronizar').addEventListener('click', () => this.sincronizarCarpetas());
        const btnBoletines = document.getElementById('btn-sincronizar-boletines');
        if (btnBoletines) btnBoletines.addEventListener('click', () => this.sincronizarBoletines());
        document.getElementById('btn-agregar-acuerdo').addEventListener('click', () => this.seleccionarAcuerdoPdf());
        document.getElementById('btn-agregar-actividad').addEventListener('click', () => this.abrirModalActividad());
        document.getElementById('btn-guardar-todo').addEventListener('click', () => this.guardarTodo());

        document.getElementById('cal-filtro-grado').addEventListener('change', (e) => this.cambiarGrado(e.target.value));
        document.getElementById('cal-filtro-grupo').addEventListener('change', (e) => this.cambiarGrupo(e.target.value));
        document.getElementById('cal-filtro-materia').addEventListener('change', (e) => this.cambiarMateria(e.target.value));
        document.getElementById('cal-filtro-periodo').addEventListener('change', (e) => this.cambiarPeriodo(e.target.value));

        document.getElementById('btn-generar').addEventListener('click', () => this.generarPlantillaDesdeBase());
        document.getElementById('btn-abrir-linea').addEventListener('click', () => this.cargarTabla());

        const fileInput = document.getElementById('file-excel');
        fileInput.addEventListener('change', () => {
            const label = document.getElementById('cal-file-label-text');
            const fileName = fileInput.files && fileInput.files[0] ? fileInput.files[0].name : 'Seleccionar archivo .xlsx';
            label.textContent = fileName;
            document.getElementById('btn-subir').disabled = this.esPeriodoCerrado() || !fileInput.value;
        });
        document.getElementById('btn-subir').addEventListener('click', () => this.subirExcel());

        const fileAcuerdo = document.getElementById('file-acuerdo-pdf');
        fileAcuerdo.addEventListener('change', () => this.subirAcuerdoPedagogico());
        document.getElementById('btn-ver-acuerdo').addEventListener('click', () => this.verAcuerdoPedagogico());

        document.getElementById('form-cal-actividad').addEventListener('submit', (e) => this.submitActividad(e));
        document.getElementById('btn-cerrar-modal-actividad').addEventListener('click', () => this.cerrarModalActividad());
        document.getElementById('btn-cancelar-modal-actividad').addEventListener('click', () => this.cerrarModalActividad());
        
        // Los event listeners de la tabla se attachan en renderTabla() via bindTableEvents()
    },

    _resetSyncButtons() {
        const btnSync = document.getElementById('btn-sincronizar');
        if (btnSync) {
            btnSync.disabled = false;
            btnSync.innerHTML = '<i class="bx bx-sync"></i> Sincronización Total (Escritorio)';
        }

        const btnBoletines = document.getElementById('btn-sincronizar-boletines');
        if (btnBoletines) {
            btnBoletines.disabled = false;
            btnBoletines.innerHTML = '<i class="fas fa-file-pdf"></i> Boletines (Escritorio)';
        }
    },

    _recargarModuloPostSync() {
        this._resetSyncButtons();
        window.location.reload();
    },

    async cargarFiltrosBase() {
        try {
            const res = await API.request('/api/calificaciones/filtros');
            this.grados = res.grados || [];
            this.periodos = res.periodos || [];

            const periodoAbierto = this.periodos.find(p => p.estado === 'Abierto');
            this.filtros.periodo = periodoAbierto ? periodoAbierto.id_periodo : (this.periodos[0]?.id_periodo || null);

            this.renderSelectGrados();
            this.renderSelectPeriodos();
        } catch (error) {
            mostrarAlerta('No se pudieron cargar filtros de calificaciones', 'error');
        }
    },

    renderSelectGrados() {
        const sel = document.getElementById('cal-filtro-grado');
        sel.innerHTML = '<option value="">Seleccionar grado...</option>' +
            this.grados.map(g => `<option value="${g.id_grado}">${g.nombre_grado || ('Grado ' + g.numero_grado)}</option>`).join('');
    },

    renderSelectPeriodos() {
        const sel = document.getElementById('cal-filtro-periodo');
        sel.innerHTML = this.periodos.map(p => {
            const activo = p.estado === 'Abierto' ? ' (Activo)' : '';
            const selected = String(p.id_periodo) === String(this.filtros.periodo) ? 'selected' : '';
            return `<option value="${p.id_periodo}" ${selected}>${p.nombre_periodo || ('Período ' + p.numero_periodo)}${activo}</option>`;
        }).join('');
    },

    async cambiarGrado(gradoId) {
        this.filtros.grado = gradoId || null;
        this.filtros.grupo = null;
        this.filtros.materia = null;

        const selGrupo = document.getElementById('cal-filtro-grupo');
        const selMateria = document.getElementById('cal-filtro-materia');
        selGrupo.innerHTML = '<option value="">Seleccionar grupo...</option>';
        selMateria.innerHTML = '<option value="">Seleccionar materia...</option>';
        selGrupo.disabled = true;
        selMateria.disabled = true;
        this.ocultarTabla();
        this.actualizarBotonesSeleccion();

        if (!gradoId) return;

        try {
            const res = await API.request(`/api/calificaciones/grupos/${gradoId}`);
            this.grupos = res.grupos || [];
            selGrupo.innerHTML = '<option value="">Seleccionar grupo...</option>' +
                this.grupos.map(g => `<option value="${g.id_grupo}">${g.codigo_grupo}</option>`).join('');
            selGrupo.disabled = false;
        } catch (error) {
            mostrarAlerta('Error al cargar grupos', 'error');
        }
    },

    async cambiarGrupo(grupoId) {
        this.filtros.grupo = grupoId || null;
        this.filtros.materia = null;

        const selMateria = document.getElementById('cal-filtro-materia');
        selMateria.innerHTML = '<option value="">Seleccionar materia...</option>';
        selMateria.disabled = true;
        this.ocultarTabla();
        this.actualizarBotonesSeleccion();

        if (!grupoId) return;

        try {
            const res = await API.request(`/api/calificaciones/materias/${grupoId}`);
            this.materias = res.materias || [];
            const placeholder = this.materias.length
                ? 'Seleccionar materia...'
                : 'No hay materias con docente asignado';
            selMateria.innerHTML = `<option value="">${placeholder}</option>` +
                this.materias.map(m => `<option value="${m.id_materia}">${m.nombre_materia}</option>`).join('');
            selMateria.disabled = this.materias.length === 0;
        } catch (error) {
            mostrarAlerta('Error al cargar materias', 'error');
        }
    },

    cambiarMateria(materiaId) {
        this.filtros.materia = materiaId || null;
        this.ocultarTabla();
        this.actualizarBotonesSeleccion();
        this.cargarEstadoAcuerdo();
    },

    cambiarPeriodo(periodoId) {
        this.filtros.periodo = periodoId || null;
        this.aplicarRestriccionesPeriodo();
        this.cargarEstadoAcuerdo();
        if (this.filtros.grupo && this.filtros.materia && this.actividades.length) {
            this.cargarTabla();
        }
    },

    esPeriodoCerrado() {
        const p = this.periodos.find(x => String(x.id_periodo) === String(this.filtros.periodo));
        return !!p && String(p.estado || '').toLowerCase() === 'cerrado';
    },

    validarEdicionPeriodo() {
        if (this.esPeriodoCerrado()) {
            mostrarAlerta('El período está cerrado. Solo el administrador puede realizar cambios.', 'warning');
            return false;
        }
        return true;
    },

    aplicarRestriccionesPeriodo() {
        const cerrado = this.esPeriodoCerrado();
        const btnAcuerdo = document.getElementById('btn-agregar-acuerdo');
        const btnAgregar = document.getElementById('btn-agregar-actividad');
        const btnGuardar = document.getElementById('btn-guardar-todo');
        const btnSubir = document.getElementById('btn-subir');

        if (btnAcuerdo) btnAcuerdo.disabled = cerrado || !(this.filtros.grupo && this.filtros.materia && this.filtros.periodo);
        if (btnAgregar) btnAgregar.disabled = cerrado;
        if (btnGuardar) btnGuardar.disabled = cerrado;
        if (btnSubir) btnSubir.disabled = cerrado || !document.getElementById('file-excel')?.value;

        document.querySelectorAll('.cal-input-nota, .cal-btn-mini').forEach(el => {
            el.disabled = cerrado;
        });
    },

    actualizarBotonesSeleccion() {
        const habilitado = !!(this.filtros.grado && this.filtros.grupo && this.filtros.materia);
        document.getElementById('btn-generar').disabled = !habilitado;
        document.getElementById('btn-abrir-linea').disabled = !habilitado;
        const btnAcuerdo = document.getElementById('btn-agregar-acuerdo');
        if (btnAcuerdo) btnAcuerdo.style.display = habilitado ? '' : 'none';
        this.aplicarRestriccionesPeriodo();
    },

    ocultarTabla() {
        document.getElementById('btn-agregar-acuerdo').style.display = 'none';
        document.getElementById('btn-agregar-actividad').style.display = 'none';
        document.getElementById('btn-guardar-todo').style.display = 'none';
        document.getElementById('cal-ponderacion-bar').style.display = 'none';
        document.getElementById('cal-leyenda').style.display = 'none';
        document.getElementById('cal-tabla-wrapper').innerHTML = `
            <div class="cal-placeholder">
                <i class="fas fa-hand-point-up fa-3x"></i>
                <p>Selecciona Grado, Grupo y Materia; luego usa Abrir / Editar aquí.</p>
            </div>
        `;
        this.acuerdoPdfUrl = null;
        const status = document.getElementById('cal-acuerdo-status');
        const btnVer = document.getElementById('btn-ver-acuerdo');
        if (status) status.textContent = 'No hay PDF cargado para este período.';
        if (btnVer) btnVer.disabled = true;
    },

    async cargarEstadoAcuerdo() {
        const status = document.getElementById('cal-acuerdo-status');
        const btnVer = document.getElementById('btn-ver-acuerdo');
        const { grupo, materia, periodo } = this.filtros;

        this.acuerdoPdfUrl = null;
        if (!status || !btnVer) return;

        if (!grupo || !materia || !periodo) {
            status.textContent = 'Selecciona grupo, materia y período para gestionar el acuerdo.';
            btnVer.disabled = true;
            return;
        }

        try {
            const res = await API.request(`/api/calificaciones/acuerdo-pedagogico?grupo_id=${grupo}&materia_id=${materia}&periodo_id=${periodo}`);
            if (res.existe && res.ver_url) {
                this.acuerdoPdfUrl = res.ver_url;
                status.textContent = `Archivo cargado: ${res.filename || 'acuerdo.pdf'}`;
                btnVer.disabled = false;
            } else {
                status.textContent = 'No hay PDF cargado para este período.';
                btnVer.disabled = true;
            }
        } catch (error) {
            status.textContent = 'No se pudo consultar el acuerdo pedagógico.';
            btnVer.disabled = true;
        }
    },

    seleccionarAcuerdoPdf() {
        if (!this.validarEdicionPeriodo()) return;
        const { grupo, materia, periodo } = this.filtros;
        if (!grupo || !materia || !periodo) {
            mostrarAlerta('Selecciona grupo, materia y período antes de subir el acuerdo.', 'info');
            return;
        }
        const input = document.getElementById('file-acuerdo-pdf');
        if (input) input.click();
    },

    async subirAcuerdoPedagogico() {
        if (!this.validarEdicionPeriodo()) return;

        const input = document.getElementById('file-acuerdo-pdf');
        const archivo = input?.files?.[0];
        if (!archivo) return;

        if (!String(archivo.name || '').toLowerCase().endsWith('.pdf')) {
            mostrarAlerta('Solo se permiten archivos PDF.', 'warning');
            input.value = '';
            return;
        }

        const { grupo, materia, periodo } = this.filtros;
        const formData = new FormData();
        formData.append('grupo_id', grupo);
        formData.append('materia_id', materia);
        formData.append('periodo_id', periodo);
        formData.append('archivo_pdf', archivo);

        const btn = document.getElementById('btn-agregar-acuerdo');
        const textoAnterior = btn ? btn.innerHTML : '';

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando Acuerdo...';
            }

            const response = await fetch('/api/calificaciones/acuerdo-pedagogico', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Error al guardar acuerdo pedagógico');
            }

            mostrarAlerta('Acuerdo pedagógico guardado correctamente.', 'success');
            input.value = '';
            await this.cargarEstadoAcuerdo();
        } catch (error) {
            mostrarAlerta(error.message || 'No se pudo guardar el acuerdo pedagógico.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = textoAnterior;
                this.aplicarRestriccionesPeriodo();
            }
        }
    },

    verAcuerdoPedagogico() {
        if (!this.acuerdoPdfUrl) {
            mostrarAlerta('No hay acuerdo pedagógico cargado para este período.', 'info');
            return;
        }
        window.open(this.acuerdoPdfUrl, '_blank', 'noopener');
    },

    async sincronizarCarpetas() {
        const btn = document.getElementById('btn-sincronizar');
        let refrescar = false;
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando...';

            mostrarAlerta('Sincronizando (puede tardar varios minutos). Puedes seguir trabajando; al finalizar se recarga la página.', 'info');

            const res = await fetch('/api/calificaciones/sincronizar_carpetas', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al sincronizar');

            const creados = data.created_files ? data.created_files.length : 0;
            const errores = data.errors ? data.errors.length : 0;
            mostrarAlerta(`Sincronización de planillas completa. Archivos: ${creados}. Errores: ${errores}.`, errores > 0 ? 'warning' : 'success');

            refrescar = true;
        } catch (error) {
            mostrarAlerta(error.message || 'Error al sincronizar carpetas', 'error');
        } finally {
            if (refrescar) {
                this._recargarModuloPostSync();
            } else {
                this._resetSyncButtons();
            }
        }
    },

    async sincronizarBoletines() {
        const btn = document.getElementById('btn-sincronizar-boletines');
        if (!btn) return;
        let refrescar = false;
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Boletines...';
            mostrarAlerta('Sincronizando boletines (puede tardar varios minutos). Puedes seguir trabajando; al finalizar se recarga la página.', 'info');
            const res = await API.sincronizarBoletinesTodo();
            const bCre = res.archivos_creados || 0;
            const bAct = res.archivos_actualizados || 0;
            const omitidos = res.grupos_omitidos_sin_materias || 0;
            const detalleOmitidos = omitidos
                ? ` Grupos omitidos por no tener materias activas: ${omitidos}.`
                : '';
            mostrarAlerta(`Boletines sincronizados. Nuevos: ${bCre}. Actualizados: ${bAct}.${detalleOmitidos}`, omitidos ? 'warning' : 'success');
            refrescar = true;
        } catch (error) {
            mostrarAlerta(error.message || 'Error al sincronizar boletines', 'error');
        } finally {
            if (refrescar) {
                this._recargarModuloPostSync();
            } else {
                this._resetSyncButtons();
            }
        }
    },

    async descargarPlanillaInstitucional() {
        const { grado, grupo, materia, periodo } = this.filtros;
        
        if (!grupo || !materia || !periodo) {
            mostrarAlerta('Selecciona Grupo, Materia y Periodo para generar la planilla.', 'info');
            return;
        }

        const btn = document.getElementById('btn-generar');
        let refrescar = false;
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

            // Esta es la nueva ruta que conecta con la plantilla física
            const url = `/api/calificaciones/descargar/institucional?grupo_id=${grupo}&materia_id=${materia}&periodo_id=${periodo}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'No se pudo generar la planilla');
            }

            const blob = await response.blob();
            const urlBlob = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = urlBlob;
            
            // Nombre del archivo basado en los filtros
            const nombreArchivo = `Planilla_${this.filtros.grupo}_P${this.filtros.periodo}.xlsx`;
            a.download = nombreArchivo;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(urlBlob);

            mostrarAlerta('Planilla institucional generada con éxito.', 'success');
            refrescar = true;
        } catch (error) {
            console.error(error);
            mostrarAlerta('Error: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-excel"></i> Generar / Descargar';
            if (refrescar) {
                setTimeout(() => this.recargarModulo(), 150);
            }
        }
    },

    async generarPlantillaDesdeBase() {
        const { grupo, materia, periodo } = this.filtros;

        if (!grupo || !materia) {
            mostrarAlerta('Selecciona Grupo y Materia para generar la planilla.', 'info');
            return;
        }

        const btn = document.getElementById('btn-generar');
        let refrescar = false;
        try {
            const periodoSeguro = parseInt(periodo || this.periodos?.[0]?.id_periodo || 1, 10) || 1;
            const fechaHoy = new Date().toISOString().split('T')[0];
            let fechaActividad = fechaHoy;

            try {
                if (window.Swal) {
                    const { isConfirmed, value } = await Swal.fire({
                        title: 'Generar plantilla base',
                        html: `
                            <p style="margin-bottom:8px;">Selecciona la fecha de actividad:</p>
                            <input type='date' id='swal-fecha' class='swal2-input' value='${fechaHoy}'>
                        `,
                        icon: 'question',
                        showCancelButton: true,
                        confirmButtonText: 'Generar y descargar',
                        cancelButtonText: 'Cancelar',
                        focusConfirm: false,
                        preConfirm: () => {
                            const fecha = document.getElementById('swal-fecha')?.value;
                            if (!fecha) {
                                Swal.showValidationMessage('Debes seleccionar una fecha');
                                return false;
                            }
                            return fecha;
                        }
                    });

                    if (!isConfirmed) return;
                    fechaActividad = value || fechaHoy;
                } else {
                    const continuar = confirm('Se generará y descargará la plantilla. ¿Deseas continuar?');
                    if (!continuar) return;
                }
            } catch (uiErr) {
                console.warn('Fallo UI de fecha, usando fallback:', uiErr);
                fechaActividad = prompt('Fecha de actividad (YYYY-MM-DD):', fechaHoy) || fechaHoy;
            }

            fechaActividad = fechaActividad || fechaHoy;
            this.fechaActividadSeleccionada = fechaActividad;

            // Mantener sincronía visual -> Excel: mismo orden mostrado en pantalla.
            const actividadIdsOrden = (this.actividades || []).map(a => parseInt(a.id_actividad, 10)).filter(Number.isFinite);

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generando...';

            let response = await fetch('/api/calificaciones/plantilla/generar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    grupo_id: parseInt(grupo, 10),
                    materia_id: parseInt(materia, 10),
                    periodo_id: periodoSeguro,
                    fecha_actividad: fechaActividad,
                    actividad_ids_order: actividadIdsOrden
                })
            });

            // Fallback para instalaciones que aún usan la ruta GET anterior.
            if (!response.ok) {
                const urlLegacy = `/api/calificaciones/descargar/institucional?grupo_id=${encodeURIComponent(grupo)}&materia_id=${encodeURIComponent(materia)}&periodo_id=${encodeURIComponent(periodoSeguro)}`;
                response = await fetch(urlLegacy, { method: 'GET' });
            }

            if (!response.ok) {
                let errorMsg = 'No se pudo generar la plantilla base';
                try {
                    const dataErr = await response.json();
                    errorMsg = dataErr.error || errorMsg;
                } catch (_) {
                    
                }
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            if (!blob || blob.size === 0) {
                throw new Error('El servidor devolvió un archivo vacío.');
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Planilla_Calificaciones.xlsx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            mostrarAlerta('Plantilla generada y descargada correctamente.', 'success');
            refrescar = true;
        } catch (error) {
            console.error(error);
            mostrarAlerta(error.message || 'Error al generar plantilla base', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-excel"></i> Descargar Excel Físico';
            if (refrescar) {
                setTimeout(() => this.recargarModulo(), 150);
            }
        }
    },

    async cargarTabla() {
        if (!this.filtros.grupo || !this.filtros.materia || !this.filtros.periodo) {
            mostrarAlerta('Selecciona todos los filtros para abrir la planilla', 'info');
            return;
        }

        const wrapper = document.getElementById('cal-tabla-wrapper');
        wrapper.innerHTML = Helpers.loading();
        this.notasModificadas.clear();

        try {
            const res = await API.request(
                `/api/calificaciones/tabla?grupo_id=${this.filtros.grupo}&materia_id=${this.filtros.materia}&periodo_id=${this.filtros.periodo}`
            );

            this.estudiantes = res.estudiantes || [];
            this.actividades = res.actividades || [];
            const notasArr = res.notas || [];
            const totalPond = res.total_ponderacion || 0;

            this.notas = {};
            notasArr.forEach(n => {
                this.notas[`${n.id_estudiante}_${n.id_actividad}`] = n.puntaje_obtenido;
            });

            document.getElementById('btn-agregar-actividad').style.display = '';
            document.getElementById('btn-guardar-todo').style.display = '';
            document.getElementById('cal-ponderacion-bar').style.display = '';
            document.getElementById('cal-leyenda').style.display = '';

            this.actualizarPonderacion(totalPond);
            this.renderTabla();
            this.aplicarRestriccionesPeriodo();
            this.cargarEstadoAcuerdo();
        } catch (error) {
            wrapper.innerHTML = Helpers.error('No se pudieron cargar las notas.');
        }
    },

    renderTabla() {
        const wrapper = document.getElementById('cal-tabla-wrapper');
        if (!this.estudiantes.length) {
            wrapper.innerHTML = `
                <div class="cal-placeholder">
                    <i class="fas fa-user-slash fa-3x"></i>
                    <p>No hay estudiantes activos en este grupo.</p>
                </div>
            `;
            return;
        }

        // Generar opciones del dropdown
        let selectOptions = '<option value="">Ver: Todas las actividades</option>';
        this.actividades.forEach(a => {
            selectOptions += `<option value="${a.id_actividad}">${a.nombre_actividad}</option>`;
        });

        // HTML con dropdown + tabla envuelta en contenedores de overflow
        let html = `
            <div class="cal-tabla-header">
                <select id="cal-activity-filter" class="cal-activity-filter">
                    ${selectOptions}
                </select>
            </div>
            <div class="cal-table-strict">
                <div class="cal-excel-container"><table class="cal-excel-table"><thead><tr>
        `;

        html += '<th class="cal-th-num">#</th>';
        html += '<th class="cal-th-estudiante">Estudiante</th>';

        this.actividades.forEach(a => {
            html += `
                <th class="cal-th-actividad" data-actividad-id="${a.id_actividad}">
                    <div class="cal-actividad-header">
                        <span class="cal-actividad-nombre" title="${a.nombre_actividad}">${a.nombre_actividad}</span>
                        <span class="cal-actividad-meta">${a.tipo_actividad} · ${parseFloat(a.ponderacion).toFixed(2)}%</span>
                        <span class="cal-actividad-meta">Máx: ${parseFloat(a.puntaje_maximo).toFixed(2)}</span>
                        <div class="cal-actividad-acciones">
                            <button class="cal-btn-mini" data-accion="editar" data-id-actividad="${a.id_actividad}" title="Editar"><i class="fas fa-edit"></i></button>
                            <button class="cal-btn-mini cal-btn-mini-rojo" data-accion="eliminar" data-id-actividad="${a.id_actividad}" title="Eliminar"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>
                </th>
            `;
        });

        html += '<th class="cal-th-final">Nota Final</th></tr></thead><tbody>';

        this.estudiantes.forEach((est, idx) => {
            html += `<tr><td class="cal-td-num">${idx + 1}</td>`;
            html += `
                <td class="cal-td-estudiante">
                    <div class="cal-estudiante-cell">
                        <div class="avatar">${Helpers.getIniciales(est.nombre, est.apellido)}</div>
                        <span>${est.apellido}, ${est.nombre}</span>
                    </div>
                </td>
            `;

            let sumaFinal = 0;
            let conNotas = 0;

            this.actividades.forEach(act => {
                const key = `${est.id_estudiante}_${act.id_actividad}`;
                const valor = this.notas[key] !== null && this.notas[key] !== undefined ? this.notas[key] : '';
                let clase = '';

                if (valor !== '') {
                    const sobre5 = (parseFloat(valor) / parseFloat(act.puntaje_maximo)) * 5;
                    if (sobre5 < 3.0) clase = 'cal-nota-bajo';
                    else if (sobre5 < 4.0) clase = 'cal-nota-basico';
                    else if (sobre5 < 4.6) clase = 'cal-nota-alto';
                    else clase = 'cal-nota-superior';

                    sumaFinal += (parseFloat(valor) / parseFloat(act.puntaje_maximo)) * parseFloat(act.ponderacion);
                    conNotas += 1;
                }

                html += `
                    <td class="cal-td-nota ${clase}" data-actividad-id="${act.id_actividad}">
                        <input
                            type="number"
                            class="cal-input-nota"
                            value="${valor}"
                            min="0"
                            max="${act.puntaje_maximo}"
                            step="0.01"
                            data-estudiante="${est.id_estudiante}"
                            data-actividad="${act.id_actividad}"
                            data-max="${act.puntaje_maximo}"
                            placeholder="—"
                        >
                    </td>
                `;
            });

            const pct = conNotas > 0 ? `${sumaFinal.toFixed(2)}%` : '—';
            const sobre5Final = conNotas > 0 ? ((sumaFinal / 100) * 5).toFixed(2) : '—';
            let claseFinal = '';
            if (conNotas > 0) {
                const nf = parseFloat(sobre5Final);
                if (nf < 3.0) claseFinal = 'cal-final-bajo';
                else if (nf < 4.0) claseFinal = 'cal-final-basico';
                else if (nf < 4.6) claseFinal = 'cal-final-alto';
                else claseFinal = 'cal-final-superior';
            }

            html += `
                <td class="cal-td-final ${claseFinal}" data-estudiante="${est.id_estudiante}">
                    <div class="cal-final-cell">
                        <span class="cal-final-pct">${pct}</span>
                        <span class="cal-final-nota">${sobre5Final !== '—' ? `${sobre5Final}/5` : ''}</span>
                    </div>
                </td>
            `;

            html += '</tr>';
        });

        html += '</tbody></table></div></div>';
        wrapper.innerHTML = html;

        this.bindTableEvents();
        wrapper.querySelectorAll('.cal-input-nota').forEach(input => {
            input.addEventListener('blur', (e) => this.onBlurNota(e.target));
            input.addEventListener('keydown', (e) => this.onKeyNota(e, e.target));
        });
    },

    onBlurNota(input) {
        const idEst = input.dataset.estudiante;
        const idAct = input.dataset.actividad;
        const max = parseFloat(input.dataset.max);
        const key = `${idEst}_${idAct}`;
        const raw = input.value.trim();

        if (raw === '') {
            if (this.notas[key] !== null && this.notas[key] !== undefined) {
                this.notas[key] = null;
                this.notasModificadas.add(key);
                this.guardarNotaIndividual(idEst, idAct, null);
            }
            this.actualizarCeldaEstilo(input, null, max);
            this.recalcularFinal(idEst);
            return;
        }

        let num = parseFloat(raw);
        if (Number.isNaN(num)) {
            input.value = '';
            return;
        }

        if (num < 0) num = 0;
        if (num > max) num = max;
        input.value = String(num);

        if (this.notas[key] === num) return;

        this.notas[key] = num;
        this.notasModificadas.add(key);
        this.actualizarCeldaEstilo(input, num, max);
        this.recalcularFinal(idEst);
        this.guardarNotaIndividual(idEst, idAct, num);
    },

    onKeyNota(event, input) {
        if (event.key !== 'Tab' && event.key !== 'Enter') return;

        event.preventDefault();
        input.blur();

        const inputs = Array.from(document.querySelectorAll('.cal-input-nota'));
        const idx = inputs.indexOf(input);
        const cols = this.actividades.length;
        let nextIdx = idx + 1;

        if (event.key === 'Tab' && event.shiftKey) nextIdx = idx - 1;
        else if (event.key === 'Enter' && event.shiftKey) nextIdx = idx - cols;
        else if (event.key === 'Enter') nextIdx = idx + cols;

        if (nextIdx >= 0 && nextIdx < inputs.length) {
            inputs[nextIdx].focus();
            inputs[nextIdx].select();
        }
    },

    bindTableEvents() {
        const wrapper = document.getElementById('cal-tabla-wrapper');
        if (!wrapper) return;
        if (this._tableEventsBound && this._tableWrapper === wrapper) return;

        wrapper.addEventListener('change', (e) => {
            if (e.target && e.target.id === 'cal-activity-filter') {
                this.filterActivities(e.target.value);
            }
        });

        wrapper.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-accion]');
            if (!btn) return;

            const accion = btn.dataset.accion;
            const idAct = parseInt(btn.dataset.idActividad || 0, 10);

            if (accion === 'editar') this.editarActividad(idAct);
            if (accion === 'eliminar') this.eliminarActividad(idAct);
        });

        this._tableEventsBound = true;
        this._tableWrapper = wrapper;
    },

    filterActivities(actividadId) {
        const wrapper = document.getElementById('cal-tabla-wrapper');
        const allActivityHeaders = wrapper.querySelectorAll('.cal-th-actividad');
        const allActivityCells = wrapper.querySelectorAll('.cal-td-nota');

        if (!actividadId) {
            // Mostrar todas las actividades
            allActivityHeaders.forEach(th => th.classList.remove('hidden-column'));
            allActivityCells.forEach(td => td.classList.remove('hidden-column'));
        } else {
            // Mostrar solo la seleccionada, ocultar las demás
            allActivityHeaders.forEach(th => {
                if (th.dataset.actividadId === actividadId) {
                    th.classList.remove('hidden-column');
                } else {
                    th.classList.add('hidden-column');
                }
            });
            allActivityCells.forEach(td => {
                if (td.dataset.actividadId === actividadId) {
                    td.classList.remove('hidden-column');
                } else {
                    td.classList.add('hidden-column');
                }
            });
        }
    },

    actualizarCeldaEstilo(input, valor, max) {
        const td = input.closest('td');
        td.classList.remove('cal-nota-bajo', 'cal-nota-basico', 'cal-nota-alto', 'cal-nota-superior');

        if (valor === null || valor === undefined || valor === '') return;
        const sobre5 = (parseFloat(valor) / max) * 5;
        if (sobre5 < 3.0) td.classList.add('cal-nota-bajo');
        else if (sobre5 < 4.0) td.classList.add('cal-nota-basico');
        else if (sobre5 < 4.6) td.classList.add('cal-nota-alto');
        else td.classList.add('cal-nota-superior');
    },

    recalcularFinal(idEstudiante) {
        let suma = 0;
        let tieneNotas = false;

        this.actividades.forEach(act => {
            const key = `${idEstudiante}_${act.id_actividad}`;
            const val = this.notas[key];
            if (val !== null && val !== undefined) {
                suma += (parseFloat(val) / parseFloat(act.puntaje_maximo)) * parseFloat(act.ponderacion);
                tieneNotas = true;
            }
        });

        const tdFinal = document.querySelector(`.cal-td-final[data-estudiante="${idEstudiante}"]`);
        if (!tdFinal) return;

        tdFinal.classList.remove('cal-final-bajo', 'cal-final-basico', 'cal-final-alto', 'cal-final-superior');
        if (!tieneNotas) {
            tdFinal.innerHTML = '<div class="cal-final-cell"><span class="cal-final-pct">—</span><span class="cal-final-nota"></span></div>';
            return;
        }

        const sobre5 = ((suma / 100) * 5).toFixed(2);
        tdFinal.innerHTML = `
            <div class="cal-final-cell">
                <span class="cal-final-pct">${suma.toFixed(2)}%</span>
                <span class="cal-final-nota">${sobre5}/5</span>
            </div>
        `;

        const nf = parseFloat(sobre5);
        if (nf < 3.0) tdFinal.classList.add('cal-final-bajo');
        else if (nf < 4.0) tdFinal.classList.add('cal-final-basico');
        else if (nf < 4.6) tdFinal.classList.add('cal-final-alto');
        else tdFinal.classList.add('cal-final-superior');
    },

    async guardarNotaIndividual(idEstudiante, idActividad, puntaje) {
        if (!this.validarEdicionPeriodo()) return;
        try {
            await API.request('/api/calificaciones/notas', {
                method: 'POST',
                body: JSON.stringify({
                    id_estudiante: parseInt(idEstudiante, 10),
                    id_actividad: parseInt(idActividad, 10),
                    id_materia: parseInt(this.filtros.materia, 10),
                    id_periodo: parseInt(this.filtros.periodo, 10),
                    puntaje_obtenido: puntaje
                })
            });
            this.notasModificadas.delete(`${idEstudiante}_${idActividad}`);
        } catch (error) {
            mostrarAlerta('Error al guardar nota individual', 'error');
        }
    },

    async guardarTodo() {
        if (!this.validarEdicionPeriodo()) return;
        const inputs = document.querySelectorAll('.cal-input-nota');
        const notas = [];
        inputs.forEach(input => {
            const val = input.value.trim();
            notas.push({
                id_estudiante: parseInt(input.dataset.estudiante, 10),
                id_actividad: parseInt(input.dataset.actividad, 10),
                puntaje_obtenido: val !== '' ? parseFloat(val) : null
            });
        });

        if (!notas.length) {
            mostrarAlerta('No hay notas para guardar', 'info');
            return;
        }

        const btn = document.getElementById('btn-guardar-todo');
        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const res = await API.request('/api/calificaciones/notas/lote', {
                method: 'POST',
                body: JSON.stringify({
                    notas,
                    id_materia: parseInt(this.filtros.materia, 10),
                    id_periodo: parseInt(this.filtros.periodo, 10)
                })
            });

            this.notasModificadas.clear();
            const errCount = res.errores ? res.errores.length : 0;
            mostrarAlerta(`${res.guardadas || 0} nota(s) guardadas${errCount ? `. Errores: ${errCount}` : ''}`, errCount ? 'warning' : 'success');
        } catch (error) {
            mostrarAlerta(error.message || 'Error al guardar todo', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> Guardar Todo';
        }
    },

    abrirModalActividad(idActividad = null) {
        if (!this.validarEdicionPeriodo()) return;
        if (!this.filtros.grupo || !this.filtros.materia) {
            mostrarAlerta('Selecciona grupo y materia antes de crear actividades', 'info');
            return;
        }

        const overlay = document.getElementById('modal-cal-actividad');
        overlay.classList.add('active');
        overlay.style.display = 'flex';

        document.getElementById('form-cal-actividad').reset();
        const fechaInput = document.getElementById('fecha_actividad');
        if (fechaInput) {
            fechaInput.value = this.fechaActividadSeleccionada || new Date().toISOString().split('T')[0];
        }
        document.getElementById('cal-actividad-id').value = idActividad || '';
        document.getElementById('modal-cal-actividad-titulo').textContent = idActividad ? 'Editar Actividad' : 'Nueva Actividad';

        if (!idActividad) return;
        const act = this.actividades.find(a => a.id_actividad === idActividad);
        if (!act) return;

        document.getElementById('cal-act-nombre').value = act.nombre_actividad;
        document.getElementById('cal-act-tipo').value = act.tipo_actividad;
        document.getElementById('cal-act-ponderacion').value = act.ponderacion;
        document.getElementById('cal-act-puntaje-max').value = act.puntaje_maximo;
        if (fechaInput) {
            fechaInput.value = act.fecha_actividad || this.fechaActividadSeleccionada || new Date().toISOString().split('T')[0];
        }
    },

    cerrarModalActividad() {
        const overlay = document.getElementById('modal-cal-actividad');
        overlay.classList.remove('active');
        overlay.style.display = 'none';
    },

    async submitActividad(event) {
        event.preventDefault();

        const idActividad = document.getElementById('cal-actividad-id').value;
        const payload = {
            nombre_actividad: document.getElementById('cal-act-nombre').value.trim(),
            tipo_actividad: document.getElementById('cal-act-tipo').value,
            ponderacion: parseFloat(document.getElementById('cal-act-ponderacion').value),
            puntaje_maximo: parseFloat(document.getElementById('cal-act-puntaje-max').value),
            id_grupo: parseInt(this.filtros.grupo, 10),
            id_materia: parseInt(this.filtros.materia, 10),
            id_periodo: parseInt(this.filtros.periodo, 10),
            fecha_actividad: (document.getElementById('fecha_actividad')?.value || this.fechaActividadSeleccionada || new Date().toISOString().split('T')[0])
        };

        this.fechaActividadSeleccionada = payload.fecha_actividad;

        if (!this.validarEdicionPeriodo()) return;

        if (!payload.nombre_actividad) {
            mostrarAlerta('Ingresa el nombre de la actividad', 'error');
            return;
        }

        try {
            if (idActividad) {
                await API.request(`/api/calificaciones/actividades/${idActividad}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
                mostrarAlerta('Actividad actualizada', 'success');
            } else {
                await API.request('/api/calificaciones/actividades', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                mostrarAlerta('Actividad creada', 'success');
            }

            this.cerrarModalActividad();
            await this.cargarTabla();
        } catch (error) {
            mostrarAlerta(error.message || 'Error al guardar actividad', 'error');
        }
    },

    editarActividad(idActividad) {
        this.abrirModalActividad(idActividad);
    },

    async eliminarActividad(idActividad) {
        if (!this.validarEdicionPeriodo()) return;
        const act = this.actividades.find(a => a.id_actividad === idActividad);
        const nombre = act ? act.nombre_actividad : 'esta actividad';
        if (!confirm(`¿Eliminar "${nombre}"?\nSe eliminarán también las notas asociadas.`)) return;

        try {
            const res = await API.request(`/api/calificaciones/actividades/${idActividad}?id_periodo=${this.filtros.periodo}`, { method: 'DELETE' });
            mostrarAlerta(`Actividad eliminada${res.notas_eliminadas ? `. Notas eliminadas: ${res.notas_eliminadas}` : ''}`, 'success');
            await this.cargarTabla();
        } catch (error) {
            const msg = String(error.message || '').toLowerCase();
            if (msg.includes('no encontrado')) {
                mostrarAlerta('La actividad ya fue eliminada', 'info');
                await this.cargarTabla();
                return;
            }
            mostrarAlerta(error.message || 'Error al eliminar actividad', 'error');
        }
    },

    actualizarPonderacion(total) {
        const valor = document.getElementById('cal-ponderacion-valor');
        const fill = document.getElementById('cal-ponderacion-fill');
        valor.textContent = `${Number(total).toFixed(1)}%`;
        fill.style.width = `${Math.min(Number(total), 100)}%`;

        fill.classList.remove('cal-pond-ok', 'cal-pond-warning', 'cal-pond-danger');
        valor.classList.remove('cal-pond-danger-text');
        if (total > 100) {
            fill.classList.add('cal-pond-danger');
            valor.classList.add('cal-pond-danger-text');
        } else if (total >= 90) {
            fill.classList.add('cal-pond-ok');
        } else {
            fill.classList.add('cal-pond-warning');
        }
    },

    async subirExcel() {
        if (!this.validarEdicionPeriodo()) return;
        const fileInput = document.getElementById('file-excel');
        if (!this.filtros.grado || !this.filtros.grupo || !this.filtros.materia) {
            mostrarAlerta('Selecciona grado, grupo y materia para subir la planilla', 'info');
            return;
        }
        if (!fileInput.files || !fileInput.files[0]) {
            mostrarAlerta('Selecciona un archivo .xlsx', 'info');
            return;
        }

        const formData = new FormData();
        formData.append('grado_id', this.filtros.grado);
        formData.append('grupo_id', this.filtros.grupo);
        formData.append('materia_id', this.filtros.materia);
        formData.append('periodo_id', this.filtros.periodo || 1);
        formData.append('archivo_excel', fileInput.files[0]);

        try {
            const response = await fetch('/api/calificaciones/subir_planilla', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error de servidor');

            mostrarAlerta(`Planilla subida. Notas procesadas: ${data.notas_procesadas || 0}.`, 'success');
            fileInput.value = '';
            const label = document.getElementById('cal-file-label-text');
            if (label) label.textContent = 'Seleccionar archivo .xlsx';
            document.getElementById('btn-subir').disabled = true;

            if (this.filtros.grupo && this.filtros.materia) {
                await this.cargarTabla();
            }
        } catch (error) {
            mostrarAlerta(error.message || 'Excepción de red al subir planilla', 'error');
        }
    }
};

window.CalificacionesModule = CalificacionesModule;