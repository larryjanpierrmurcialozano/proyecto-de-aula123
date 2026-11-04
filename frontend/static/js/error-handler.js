// ════════════════════════════════════════════════════════════════════════════════
// SISTEMA GLOBAL DE NOTIFICACIONES Y ERRORES
// Complementa error-handler.css
// ════════════════════════════════════════════════════════════════════════════════

const Notificaciones = {
    _container: null,

    _getContainer() {
        if (!this._container) {
            this._container = document.querySelector('.notification-container');
            if (!this._container) {
                this._container = document.createElement('div');
                this._container.className = 'notification-container';
                document.body.appendChild(this._container);
            }
        }
        return this._container;
    },

    /**
     * Muestra una notificación tipo toast
     * @param {string} titulo - Título de la notificación
     * @param {string} mensaje - Mensaje descriptivo
     * @param {'success'|'error'|'warning'|'info'} tipo - Tipo de notificación
     * @param {number} duracion - Milisegundos antes de cerrar (0 = no cierra)
     */
    mostrar(titulo, mensaje, tipo = 'info', duracion = 5000) {
        const container = this._getContainer();

        const iconos = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const noti = document.createElement('div');
        noti.className = `notification notification-${tipo}`;
        noti.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${iconos[tipo] || iconos.info}</span>
                <div class="notification-text">
                    <span class="notification-title">${titulo}</span>
                    <p class="notification-message">${mensaje}</p>
                </div>
                <button class="notification-close">&times;</button>
            </div>
            ${duracion > 0 ? `<div class="notification-progress" style="animation: notification-progress ${duracion}ms linear forwards;"></div>` : ''}
        `;

        container.appendChild(noti);

        // Animar entrada
        requestAnimationFrame(() => noti.classList.add('show'));

        // Cerrar al hacer clic en X
        const cerrar = () => {
            noti.classList.remove('show');
            setTimeout(() => noti.remove(), 300);
        };

        noti.querySelector('.notification-close').addEventListener('click', cerrar);

        // Auto-cerrar
        if (duracion > 0) {
            setTimeout(cerrar, duracion);
        }

        return noti;
    },

    exito(titulo, mensaje, duracion) {
        return this.mostrar(titulo, mensaje, 'success', duracion);
    },

    error(titulo, mensaje, duracion) {
        return this.mostrar(titulo, mensaje, 'error', duracion);
    },

    advertencia(titulo, mensaje, duracion) {
        return this.mostrar(titulo, mensaje, 'warning', duracion);
    },

    info(titulo, mensaje, duracion) {
        return this.mostrar(titulo, mensaje, 'info', duracion);
    }
};

// ════════════════════════════════════════════════════════════════════════════════
// DIÁLOGO DE CONFIRMACIÓN
// ════════════════════════════════════════════════════════════════════════════════

const Confirmacion = {
    /**
     * Muestra un diálogo de confirmación
     * @param {string} titulo
     * @param {string} mensaje
     * @param {Function} onConfirmar
     * @param {string} textoConfirmar - Texto del botón confirmar
     * @param {string} textoCancelar - Texto del botón cancelar
     */
    mostrar(titulo, mensaje, onConfirmar, textoConfirmar = 'Confirmar', textoCancelar = 'Cancelar') {
        const backdrop = document.createElement('div');
        backdrop.className = 'confirmation-backdrop';
        backdrop.innerHTML = `
            <div class="confirmation-dialog">
                <div class="confirmation-header">
                    <h2>${titulo}</h2>
                    <button class="btn-close">&times;</button>
                </div>
                <div class="confirmation-body">
                    <p>${mensaje}</p>
                </div>
                <div class="confirmation-footer">
                    <button class="btn btn-cancelar" style="background: #ecf0f1; color: #2c3e50;">${textoCancelar}</button>
                    <button class="btn btn-confirmar" style="background: #c0392b; color: white;">${textoConfirmar}</button>
                </div>
            </div>
        `;

        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add('show'));

        const cerrar = () => {
            backdrop.classList.remove('show');
            backdrop.classList.add('hide');
            setTimeout(() => backdrop.remove(), 300);
        };

        backdrop.querySelector('.btn-close').addEventListener('click', cerrar);
        backdrop.querySelector('.btn-cancelar').addEventListener('click', cerrar);
        backdrop.querySelector('.btn-confirmar').addEventListener('click', () => {
            cerrar();
            if (onConfirmar) onConfirmar();
        });

        // Cerrar al hacer clic fuera
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) cerrar();
        });
    }
};

// ════════════════════════════════════════════════════════════════════════════════
// CARGADOR GLOBAL
// ════════════════════════════════════════════════════════════════════════════════

const Cargador = {
    _loader: null,

    mostrar(mensaje = 'Cargando...') {
        if (this._loader) return;
        this._loader = document.createElement('div');
        this._loader.className = 'global-loader';
        this._loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner"></div>
                <p>${mensaje}</p>
            </div>
        `;
        document.body.appendChild(this._loader);
        requestAnimationFrame(() => this._loader.classList.add('active'));
    },

    ocultar() {
        if (!this._loader) return;
        this._loader.classList.remove('active');
        const ref = this._loader;
        this._loader = null;
        setTimeout(() => ref.remove(), 300);
    }
};
