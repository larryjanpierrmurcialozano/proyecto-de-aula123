// ════════════════════════════════════════════════════════════════════════════════
// HELPERS DE RENDERIZADO
// Funciones utilitarias para generar HTML reutilizable
// ════════════════════════════════════════════════════════════════════════════════

const Helpers = {
    // Obtener iniciales de un nombre
    getIniciales(nombre, apellido = '') {
        const n = nombre ? nombre.charAt(0).toUpperCase() : '';
        const a = apellido ? apellido.charAt(0).toUpperCase() : '';
        return n + a;
    },

    // Badge de estado activo/inactivo
    badgeEstado(activo) {
        if (activo === 1 || activo === true || activo === 'Activo') {
            return '<span class="badge badge-verde">Activo</span>';
        }
        return '<span class="badge badge-rojo">Inactivo</span>';
    },

    // Badge de rol
    badgeRol(rol) {
        return `<span class="badge badge-cafe">${rol}</span>`;
    },

    // Formatear fecha
    formatearFecha(fecha) {
        if (!fecha) return '-';
        const d = new Date(fecha);
        return d.toLocaleDateString('es-CO');
    },

    // Formatear fecha y hora
    formatearFechaHora(fecha) {
        if (!fecha) return '-';
        const d = new Date(fecha);
        return d.toLocaleString('es-CO');
    },

    // Celda de usuario con avatar
    celdaUsuario(nombre, apellido = '') {
        const iniciales = this.getIniciales(nombre, apellido);
        const nombreCompleto = apellido ? `${nombre} ${apellido}` : nombre;
        return `
            <div class="usuario-cell">
                <div class="avatar">${iniciales}</div>
                <span>${nombreCompleto}</span>
            </div>
        `;
    },

    // Botones de acciones estándar
    botonesAcciones(id, verFn = null, editarFn = null, eliminarFn = null) {
        let html = '<div class="acciones-btns">';
        if (verFn) {
            html += `<button class="btn-accion btn-accion-cafe" title="Ver" onclick="${verFn}(${id})"><i class="fas fa-eye"></i></button>`;
        }
        if (editarFn) {
            html += `<button class="btn-accion btn-accion-verde" title="Editar" onclick="${editarFn}(${id})"><i class="fas fa-edit"></i></button>`;
        }
        if (eliminarFn) {
            html += `<button class="btn-accion btn-accion-rojo" title="Eliminar" onclick="${eliminarFn}(${id})"><i class="fas fa-trash"></i></button>`;
        }
        html += '</div>';
        return html;
    },
    //ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR
    // Mostrar loading //SE ESPERA QUE EL DOCUMENTO CARGUE EN CIERTA CANTIDAD DE SEGUNDOS, SE PENSABA PREPARAR UNA FUNCION 
    // SETTIMEOUT INDIVIDUAL PARA EL MODULO DE ESTUDIANTES, CORRECCIONES QUE NO TIENEN URGENCIAS, SI HAY QUEJAS POR EL TIEMPO
    // DE CARGA DEL MODULO DE ESTUDIANTES, PUES, QUE LA CHUPEN, DESPUES CORREGIMOS ESTO, MAS TARDE REVISAREMOS SI ES POR 
    // DEPENDENCIAS O CAGADAS METIENDO TANTA VAINA DE CARGAS PARA LOS MODULOS, SE PUEDE PROBAR BORRANDO TODOS ESOS, BUEN PLAN,
    // ESO HAREMOS, BORRAREMOS TODOS LOS RELOAD Y LUEGO LOS MIRARE, ESTO SERA DESPUES DE LA ACTUALIZACION DEL BACKEND.
    //ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR
    loading() {
  const favicon = document.getElementById('fas fa-spinner fa-spin fa-3x');
  
  // Tiempo de espera: 5000 milisegundos = 5 segundos
  setTimeout(function() {
    // Cambia la ruta a un nuevo icono o déjalo vacío para que desaparezca
    Helpers-loading.href, "fas fa-spinner fa-spin fa-3x"; 
    console.log("El favicon ha cambiado tras 5 segundos.");
  }, 5);
    },
    loading() {

        return `
            <div class="helper-loading">
                <i class="fas fa-spinner fa-spin fa-3x"></i>
                <p>Cargando datos...</p>
            </div>
        `;
    },
    //ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR//ERROR
    // Mostrar error
    error(mensaje) {
        return `
            <div class="helper-error">
                <i class="fas fa-exclamation-circle fa-3x"></i>
                <p>${mensaje}</p>
                <button class="btn btn-cafe" onclick="location.reload()">
                    <i class="fas fa-sync"></i> Reintentar
                </button>
            </div>
        `;
    },

    // Sin datos
    sinDatos(mensaje = 'No hay datos disponibles') {
        return `
            <div class="helper-sin-datos">
                <i class="fas fa-inbox fa-3x"></i>
                <p>${mensaje}</p>
            </div>
        `;
    },

    // Placeholder para módulos en desarrollo
    enDesarrollo(titulo, icono = 'fa-cogs') {
        return `
            <div class="card">
                <div class="card-header-flex">
                    <h2 class="card-title" style="border:none;margin:0;padding:0;">
                        <i class="fas ${icono}"></i> ${titulo}
                    </h2>
                </div>
                <div class="helper-en-desarrollo">
                    <i class="fas fa-hard-hat fa-4x"></i>
                    <h3>Módulo en desarrollo</h3>
                    <p>Esta sección estará disponible próximamente.</p>
                    <p>Estamos trabajando para traerte la mejor experiencia.</p>
                </div>
            </div>
        `;
    }
};
