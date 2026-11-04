/* ════════════════════════════════════════════════════════════════════════════════
   JAVASCRIPT - AUTENTICACIÓN (LOGIN Y REGISTRO)
   ════════════════════════════════════════════════════════════════════════════════ */

// Inicializar Notyf para notificaciones
const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [
        {
            type: 'success',
            background: '#10b981',
            icon: '<i class="fas fa-check-circle"></i>'
        },
        {
            type: 'error',
            background: '#dc2626',
            icon: '<i class="fas fa-times-circle"></i>'
        },
        {
            type: 'info',
            background: '#3b82f6',
            icon: '<i class="fas fa-info-circle"></i>'
        }
    ]
});

/* ════════════════════════════════════════════════════════════════════════════════
   UTILIDADES
   ════════════════════════════════════════════════════════════════════════════════ */

/**
 * Toggle visibilidad de contraseña
 */
function togglePassword(fieldId = 'password') {
    const field = document.getElementById(fieldId);
    const button = event.target.closest('.toggle-password');
    const icon = button.querySelector('i');

    if (field.type === 'password') {
        field.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        field.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

/**
 * Validar email
 */
function validateEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

/**
 * Validar contraseña
 */
function validatePassword(password) {
    return Array.from(password).length >= 6 &&
        /\p{L}/u.test(password) &&
        /\p{N}/u.test(password);
}

/**
 * Mostrar error en campo
 */
function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + 'Error');

    if (field) {
        field.classList.add('error');
    }
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
    }
}

/**
 * Limpiar error de campo
 */
function clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const errorElement = document.getElementById(fieldId + 'Error');

    if (field) {
        field.classList.remove('error');
    }
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.classList.remove('show');
    }
}

/**
 * Mostrar error general
 */
function showGeneralError(message) {
    const errorBox = document.getElementById('generalError');
    if (errorBox) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    }
    notyf.error(message);
}

/**
 * Limpiar error general
 */
function clearGeneralError() {
    const errorBox = document.getElementById('generalError');
    if (errorBox) {
        errorBox.style.display = 'none';
        errorBox.textContent = '';
    }
}

/**
 * Deshabilitar botón submit
 */
function disableSubmitButton(button) {
    button.disabled = true;
    button.classList.add('loading');
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
}

/**
 * Habilitar botón submit
 */
function enableSubmitButton(button, text) {
    button.disabled = false;
    button.classList.remove('loading');
    button.innerHTML = text;
}

/* ════════════════════════════════════════════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════════════════════════════════════════════ */

const loginForm = document.getElementById('loginForm');

if (loginForm) {
    // Limpiar errores al escribir
    document.getElementById('email')?.addEventListener('input', () => {
        clearFieldError('email');
        clearGeneralError();
    });

    document.getElementById('password')?.addEventListener('input', () => {
        clearFieldError('password');
        clearGeneralError();
    });

    // Submit del formulario
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        clearGeneralError();

        // Obtener valores
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const remember = document.getElementById('remember').checked;

        // Validar
        let isValid = true;

        if (!email) {
            showFieldError('email', 'El email es requerido');
            isValid = false;
        } else if (!validateEmail(email)) {
            showFieldError('email', 'El email no es válido');
            isValid = false;
        }

        if (!password) {
            showFieldError('password', 'La contraseña es requerida');
            isValid = false;
        }

        if (!isValid) return;

        // Deshabilitar botón
        const submitButton = loginForm.querySelector('.btn-submit');
        const originalText = submitButton.innerHTML;
        disableSubmitButton(submitButton);

        try {
            // Realizar login
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showGeneralError(data.error || 'Error al iniciar sesión');
                enableSubmitButton(submitButton, originalText);
                return;
            }

            // Login exitoso
            notyf.success(`¡Bienvenido ${data.user_name}!`);

            // Guardar en localStorage si recuerda
            if (remember) {
                localStorage.setItem('user_email', email);
                localStorage.setItem('remember_me', 'true');
            }

            // Redirigir al dashboard
            setTimeout(() => {
                window.location.href = '/';
            }, 1500);

        } catch (error) {
            console.error('Error:', error);
            showGeneralError('Error de conexión. Intente nuevamente.');
            enableSubmitButton(submitButton, originalText);
        }
    });

    // Cargar email recordado
    window.addEventListener('load', () => {
        const savedEmail = localStorage.getItem('user_email');
        if (savedEmail) {
            document.getElementById('email').value = savedEmail;
            document.getElementById('remember').checked = true;
        }
    });
}

/* ════════════════════════════════════════════════════════════════════════════════
   REGISTRO
   ════════════════════════════════════════════════════════════════════════════════ */

const registerForm = document.getElementById('registerForm');

if (registerForm) {
    for (const fieldId of ['nombre', 'apellido', 'email', 'documento', 'password', 'confirmPassword']) {
        document.getElementById(fieldId)?.addEventListener('input', () => {
            clearFieldError(fieldId);
            clearGeneralError();
        });
    }

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        clearGeneralError();

        const nombre = document.getElementById('nombre').value.trim();
        const apellido = document.getElementById('apellido').value.trim();
        const documento = document.getElementById('documento').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        let isValid = true;

        if (!nombre) {
            showFieldError('nombre', 'El nombre es requerido');
            isValid = false;
        }

        if (!email) {
            showFieldError('email', 'El email es requerido');
            isValid = false;
        } else if (!validateEmail(email)) {
            showFieldError('email', 'El email no es válido');
            isValid = false;
        }

        if (!apellido) {
            showFieldError('apellido', 'El apellido es requerido');
            isValid = false;
        }

        if (!documento) {
            showFieldError('documento', 'El documento es requerido');
            isValid = false;
        }

        if (!password) {
            showFieldError('password', 'La contraseña es requerida');
            isValid = false;
        } else if (!validatePassword(password)) {
            showFieldError('password', 'La contraseña debe tener al menos 6 caracteres e incluir letras y números.');
            isValid = false;
        }

        if (password !== confirmPassword) {
            showFieldError('confirmPassword', 'Las contraseñas no coinciden');
            isValid = false;
        }

        if (!isValid) return;

        const submitButton = registerForm.querySelector('.btn-submit');
        const originalText = submitButton.innerHTML;
        disableSubmitButton(submitButton);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre,
                    apellido,
                    documento,
                    email,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                showGeneralError(data.error || 'Error al registrar');
                enableSubmitButton(submitButton, originalText);
                return;
            }

            notyf.success('¡Cuenta creada exitosamente!');
            setTimeout(() => {
                window.location.href = '/login';
            }, 1500);

        } catch (error) {
            console.error('Error:', error);
            showGeneralError('Error de conexión. Intente nuevamente.');
            enableSubmitButton(submitButton, originalText);
        }
    });
}

/* ════════════════════════════════════════════════════════════════════════════════
   INICIALIZACIÓN
   ════════════════════════════════════════════════════════════════════════════════ */

console.log('✅ Auth.js cargado correctamente');