import argparse
import getpass
import os
import unicodedata
from pathlib import Path

import bcrypt
import psycopg
from dotenv import load_dotenv


PASSWORD_POLICY_MESSAGE = (
    'La contraseña debe tener al menos 6 caracteres e incluir letras y números.'
)


def password_matches(password, stored_hash):
    if not isinstance(stored_hash, str):
        return False
    try:
        return bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
    except (TypeError, ValueError):
        return False


def password_meets_policy(password):
    return (
        len(password) >= 6
        and any(unicodedata.category(character).startswith('L') for character in password)
        and any(unicodedata.category(character).startswith('N') for character in password)
    )


def main():
    parser = argparse.ArgumentParser(
        description='Actualiza hashes bcrypt de usuarios que comparten la contraseña de prueba indicada.'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Confirma y aplica los cambios; sin esta opción solo muestra cuántas cuentas coinciden.',
    )
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / 'backend' / '.env')
    load_dotenv(project_root / '.env')
    password = getpass.getpass('Contraseña actual de prueba a buscar: ')
    replacement = None
    if args.apply:
        replacement = getpass.getpass('Nueva contraseña para las cuentas coincidentes: ')
        confirmation = getpass.getpass('Confirma la nueva contraseña: ')
        if replacement != confirmation:
            parser.error('Las contraseñas nuevas no coinciden.')
        if not password_meets_policy(replacement):
            parser.error(PASSWORD_POLICY_MESSAGE)

    db_password = os.getenv('DB_PASSWORD') or os.getenv('POSTGRES_PASSWORD')
    if not db_password:
        parser.error('Configura DB_PASSWORD o POSTGRES_PASSWORD en el entorno.')

    connection_options = {
        'host': os.getenv('DB_HOST', os.getenv('POSTGRES_HOST', 'localhost')),
        'port': int(os.getenv('DB_PORT', os.getenv('POSTGRES_PORT', '5432'))),
        'user': os.getenv('DB_USER', os.getenv('POSTGRES_USER', 'docstry_app')),
        'password': db_password,
        'dbname': os.getenv('DB_NAME', os.getenv('POSTGRES_DB', 'anexo_de_datos')),
        'sslmode': os.getenv('DB_SSLMODE', 'prefer'),
    }

    with psycopg.connect(**connection_options) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT id_usuario, contrasena_hash FROM usuarios')
            matching_users = [
                (user_id, stored_hash)
                for user_id, stored_hash in cursor.fetchall()
                if password_matches(password, stored_hash)
            ]

            if not args.apply:
                print(
                    f'Vista previa: {len(matching_users)} cuenta(s) tienen la contraseña indicada. '
                    'No se realizaron cambios. Repite con --apply para actualizarlas.'
                )
                return

            updated_count = 0
            for user_id, stored_hash in matching_users:
                new_hash = bcrypt.hashpw(
                    replacement.encode('utf-8'),
                    bcrypt.gensalt(),
                ).decode('utf-8')
                cursor.execute(
                    """
                    UPDATE usuarios
                    SET contrasena_hash = %s
                    WHERE id_usuario = %s AND contrasena_hash = %s
                    """,
                    (new_hash, user_id, stored_hash),
                )
                updated_count += cursor.rowcount

        connection.commit()

    print(f'Actualización completada: {updated_count} contraseña(s) cambiada(s).')


if __name__ == '__main__':
    main()
