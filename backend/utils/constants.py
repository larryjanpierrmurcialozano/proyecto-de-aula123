# ════════════════════════════════════════════════════════════════════════════════
# CONSTANTES GLOBALES
# ════════════════════════════════════════════════════════════════════════════════

ROL_SERVIDOR = 'server_admin'
ROL_RECTOR = 'rector'
ROL_COORDINADOR = 'coordinador'
ROL_PROFESOR = 'Profesor'
ROL_ID_PROFESOR = 4  # id_rol en BD

# Rutas públicas que NO requieren autenticación
RUTAS_PUBLICAS = {
    '/api/auth/login', '/api/auth/register', '/api/auth/check',
    '/api/auth/logout', '/api/health',
    '/', '/bienvenida', '/login', '/register',
    '/favicon.ico'
}

# Roles con permisos administrativos para comunicados
ROLES_ADMIN_COM = ['server_admin', 'rector', 'coordinador']
