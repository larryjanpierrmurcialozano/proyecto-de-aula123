# ════════════════════════════════════════════════════════════════════════════════
# FUNCIONES AUXILIARES
# ════════════════════════════════════════════════════════════════════════════════

from flask import jsonify, request, session
from functools import wraps
from datetime import date, datetime
import unicodedata
import bcrypt
from utils.database import get_db


def validar_nombre_persona(valor, campo, obligatorio=False):
    texto = ' '.join(str(valor or '').split())
    if not texto:
        return f'{campo} es obligatorio.' if obligatorio else None

    separadores = " '-’"
    tiene_letra = False
    for indice, caracter in enumerate(texto):
        categoria = unicodedata.category(caracter)
        if categoria.startswith(('L', 'M')):
            tiene_letra = tiene_letra or categoria.startswith('L')
            continue
        if caracter not in separadores:
            return f'{campo}: solo se permiten letras, espacios, apóstrofes o guiones.'
        if (
            indice == 0
            or indice == len(texto) - 1
            or not unicodedata.category(texto[indice - 1]).startswith(('L', 'M'))
            or not unicodedata.category(texto[indice + 1]).startswith(('L', 'M'))
        ):
            return f'{campo}: solo se permiten letras, espacios, apóstrofes o guiones.'
    return None if tiene_letra else f'{campo}: debe contener letras.'


def validar_telefono_numerico(valor, campo='El teléfono'):
    if valor in (None, ''):
        return None
    if any(caracter not in '0123456789' for caracter in str(valor)):
        return f'{campo}: solo se permiten números.'
    return None


def validar_documento_numerico(valor):
    if not isinstance(valor, str) or not valor:
        return 'El documento es obligatorio.'
    if any(caracter not in '0123456789' for caracter in valor):
        return 'El documento solo puede contener números.'
    return None


def validar_fecha_no_futura(valor, campo='La fecha'):
    if valor in (None, ''):
        return None

    texto = str(valor).strip()
    if not texto:
        return None

    try:
        if len(texto) == 10:
            fecha = date.fromisoformat(texto)
            if fecha > date.today():
                return f'{campo} no puede ser futura.'
            return None

        fecha_hora = datetime.fromisoformat(texto.replace('Z', '+00:00'))
    except ValueError:
        return f'{campo} tiene un formato inválido.'

    if fecha_hora.tzinfo is not None:
        fecha_hora = fecha_hora.astimezone().replace(tzinfo=None)
    if fecha_hora > datetime.now():
        return f'{campo} no puede estar en el futuro.'
    return None


def _error_interno(e):
    """Log error internamente y devolver respuesta genérica (sin exponer detalles al cliente)"""
    print(f"[ERROR] Error interno: {e}")
    return jsonify({'error': 'Error interno del servidor'}), 500


def hash_password(password):
    """Hashear contraseña con bcrypt (salt automático incluido)"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password, hashed):
    """Verificar contraseña con bcrypt"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def log_action(id_usuario, accion, descripcion, *, tabla_afectada=None, registro_id=None, ip_address=None, user_agent=None, exito=True):
    """Registro de acciones (con fallback silencioso si la tabla no existe)."""
    try:
        if not ip_address:
            try:
                ip_address = request.remote_addr
            except Exception:
                ip_address = None

        if not user_agent:
            try:
                user_agent = request.headers.get('User-Agent')
            except Exception:
                user_agent = None

        conn = get_db()
        if not conn:
            return
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO log_registro
                (id_usuario, tipo_accion, descripcion, tabla_afectada, registro_id, ip_address, user_agent, timestamp_accion)
            VALUES (%s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
            """,
            (id_usuario, accion, descripcion, tabla_afectada, registro_id, ip_address, user_agent)
        )
        conn.commit()
    except Exception as e:
        print(f"Log error: {e}")
    finally:
        try:
            cursor.close()
            conn.close()
        except Exception:
            pass


def role_required(required_role):
    """Decorador para validar rol en sesión y pasar current_user al handler"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user_role = session.get('user_role')
            if not user_role:
                return jsonify({'error': 'No autorizado'}), 401
            normalized_required = 'server_admin' if required_role == 'admin_server' else required_role
            normalized_user = 'server_admin' if user_role == 'admin_server' else user_role
            if normalized_user != normalized_required:
                return jsonify({'error': 'Permiso denegado'}), 403

            current_user = {
                'id_usuario': session.get('user_id'),
                'nombre': session.get('user_name'),
                'rol': user_role
            }
            return func(current_user, *args, **kwargs)
        return wrapper
    return decorator
