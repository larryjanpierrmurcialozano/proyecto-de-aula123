# ════════════════════════════════════════════════════════════════════════════════
# CONEXION A BASE DE DATOS — SINGLETON POOL + AUTO-CLEANUP
# ════════════════════════════════════════════════════════════════════════════════

from contextlib import contextmanager
import os
from dotenv import load_dotenv
import psycopg
from psycopg.rows import dict_row

load_dotenv()

db_password = os.getenv('DB_PASSWORD') or os.getenv('POSTGRES_PASSWORD')
if not db_password:
    raise RuntimeError(
        'Falta DB_PASSWORD o POSTGRES_PASSWORD en el entorno de Flask.'
    )

db_config = {
    'host': os.getenv('DB_HOST', os.getenv('POSTGRES_HOST', 'localhost')),
    'port': int(os.getenv('DB_PORT', os.getenv('POSTGRES_PORT', 5432))),
    'user': os.getenv('DB_USER', os.getenv('POSTGRES_USER', 'docstry_app')),
    'password': db_password,
    'database': os.getenv('DB_NAME', os.getenv('POSTGRES_DB', 'anexo_de_datos')),
    'sslmode': os.getenv('DB_SSLMODE', 'prefer')
}

try:
    db_pool = psycopg.Connection.connect(
        host=db_config['host'],
        port=db_config['port'],
        user=db_config['user'],
        password=db_config['password'],
        dbname=db_config['database'],
        sslmode=db_config['sslmode']
    )
    db_pool.close()
    db_pool = True
    print("[OK] Conexion PostgreSQL validada")
except psycopg.Error as e:
    db_pool = None
    print(f"[ERROR] Error conectando a PostgreSQL: {e}")


# ════════════════════════════════════════════════════════════════════════════════
# SafeConnection — Wrapper que previene double-close y permite limpieza
# automatica al final de cada request Flask (teardown_appcontext).
# ════════════════════════════════════════════════════════════════════════════════

class SafeCursor:
    """Adapta la interfaz de cursor usada por las rutas al driver psycopg."""

    def __init__(self, cursor):
        self._cursor = cursor

    @property
    def lastrowid(self):
        """Devuelve el último ID generado por una secuencia PostgreSQL."""
        self._cursor.execute("SELECT LASTVAL() AS id")
        row = self._cursor.fetchone()
        if isinstance(row, dict):
            return next(iter(row.values()))
        return row[0] if row else None

    def __getattr__(self, name):
        return getattr(self._cursor, name)


class SafeConnection:
    """Envuelve una conexion PostgreSQL para centralizar su cierre.

    - Si la ruta llama conn.close(), la conexion se devuelve al pool
      y el flag _closed impide que el teardown la cierre de nuevo.
    - Si la ruta NO llama conn.close() (ej. por excepcion), el teardown
      la cierra automaticamente al final del request.
    """

    def __init__(self, conn):
        self._conn = conn
        self._closed = False

    def close(self):
        if not self._closed:
            self._closed = True
            self._conn.close()

    def cursor(self, *args, dictionary=False, **kwargs):
        if dictionary:
            kwargs['row_factory'] = dict_row
        return SafeCursor(self._conn.cursor(*args, **kwargs))

    def __getattr__(self, name):
        return getattr(self._conn, name)

    def __setattr__(self, name, value):
        if name in ('_conn', '_closed'):
            super().__setattr__(name, value)
        else:
            setattr(self._conn, name, value)


def get_db():
    """Obtiene una conexion REUTILIZABLE del pool singleton.
    La conexion queda registrada para limpieza automatica al final del request."""
    try:
        if not db_pool:
            print("[ERROR] Pool no disponible")
            return None
        if not db_pool:
            print("[ERROR] Conexion PostgreSQL no disponible")
            return None
        raw = psycopg.Connection.connect(
            host=db_config['host'],
            port=db_config['port'],
            user=db_config['user'],
            password=db_config['password'],
            dbname=db_config['database'],
            sslmode=db_config['sslmode']
        )
        conn = SafeConnection(raw)
        # Registrar para cierre automatico al final del request
        try:
            from flask import g, has_request_context
            if has_request_context():
                if not hasattr(g, '_db_conns'):
                    g._db_conns = []
                g._db_conns.append(conn)
        except Exception:
            pass
        return conn
    except psycopg.Error as e:
        print(f"[ERROR] Error obteniendo conexion del pool: {e}")
        return None


def cleanup_db_connections(exception=None):
    """Cierra conexiones que quedaron abiertas al final del request.
    Se registra con app.teardown_appcontext en iniciador.py."""
    try:
        from flask import g
        conns = g.pop('_db_conns', [])
        for c in conns:
            try:
                c.close()
            except Exception:
                pass
    except Exception:
        pass


@contextmanager
def get_db_cursor(dictionary=True):
    """Context manager: abre conexion + cursor y garantiza cierre con try/finally.
    Uso: with get_db_cursor() as (conn, cursor): ..."""
    conn = get_db()
    if not conn:
        raise ConnectionError('Sin conexion a base de datos')
    cursor = conn.cursor(dictionary=dictionary)
    try:
        yield conn, cursor
    finally:
        cursor.close()
        conn.close()
