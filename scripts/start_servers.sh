#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="${PROJECT_ROOT}/.run"
LOG_DIR="${PROJECT_ROOT}/storage/logs"
PYTHON_PID_FILE="${PID_DIR}/flask.pid"
CSHARP_PID_FILE="${PID_DIR}/csharp.pid"
ENV_FILE="${ENV_FILE:-${PROJECT_ROOT}/.env}"

PYTHON_BIN="${PYTHON_BIN:-${PROJECT_ROOT}/backend/.venv/bin/python}"
CSHARP_PROJECT="${PROJECT_ROOT}/backend-csharp/ProyectoGrado.Api.csproj"
FLASK_BIND="${FLASK_BIND:-0.0.0.0:8000}"
CSHARP_BIND="${CSHARP_BIND:-http://127.0.0.1:5124}"

if [[ ! -f "${ENV_FILE}" && -f "${PROJECT_ROOT}/.env.example" ]]; then
    cp "${PROJECT_ROOT}/.env.example" "${ENV_FILE}"
    echo "Se creo ${ENV_FILE} a partir de .env.example."
fi

if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
fi

export DB_HOST="${DB_HOST:-${POSTGRES_HOST:-localhost}}"
export DB_PORT="${DB_PORT:-${POSTGRES_PORT:-5432}}"
export DB_NAME="${DB_NAME:-${POSTGRES_DB:-anexo_de_datos}}"
export DB_USER="${DB_USER:-${POSTGRES_USER:-}}"
export DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
export CSHARP_API_URL="${CSHARP_API_URL:-http://127.0.0.1:5124}"

save_env_value() {
    local key="$1"
    local value="$2"
    printf '\n%s=%s\n' "${key}" "${value}" >>"${ENV_FILE}"
}

configure_database_credentials() {
    if [[ -z "${DB_USER}" ||
        ( "${DB_USER}" == "docstry_app" &&
          "${DB_PASSWORD}" == "replace_with_a_strong_unique_password" ) ]]; then
        read -r -p "Usuario PostgreSQL [postgres]: " DB_USER
        DB_USER="${DB_USER:-postgres}"
        export DB_USER
        save_env_value "DB_USER" "${DB_USER}"
    fi

    if [[ -z "${DB_PASSWORD}" || "${DB_PASSWORD}" == "replace_with_a_strong_unique_password" ]]; then
        read -r -s -p "Contraseña PostgreSQL: " DB_PASSWORD
        echo
        [[ -n "${DB_PASSWORD}" ]] || {
            echo "Error: la contraseña no puede estar vacia." >&2
            exit 1
        }
        export DB_PASSWORD
        save_env_value "DB_PASSWORD" "${DB_PASSWORD}"
    fi
}

request_database_credentials() {
    local username
    read -r -p "Usuario PostgreSQL [${DB_USER:-postgres}]: " username
    DB_USER="${username:-${DB_USER:-postgres}}"
    export DB_USER
    save_env_value "DB_USER" "${DB_USER}"

    read -r -s -p "Contraseña PostgreSQL: " DB_PASSWORD
    echo
    [[ -n "${DB_PASSWORD}" ]] || {
        echo "Error: la contraseña no puede estar vacia." >&2
        exit 1
    }
    export DB_PASSWORD
    save_env_value "DB_PASSWORD" "${DB_PASSWORD}"
}

validate_existing_postgres() {
    local container_id
    container_id="$(docker ps --filter "ancestor=postgres" --format '{{.ID}}' | head -n 1)"
    [[ -n "${container_id}" ]] || {
        echo "Error: no se encontro un contenedor PostgreSQL ejecutandose." >&2
        echo "Inicia el contenedor existente antes de ejecutar este script." >&2
        exit 1
    }

    if ! docker exec -e "PGPASSWORD=${DB_PASSWORD}" "${container_id}" \
        psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -tAc "SELECT 1" \
        >/dev/null 2>&1; then
        return 1
    fi

    echo "PostgreSQL validado: contenedor ${container_id}, base ${DB_NAME}, usuario ${DB_USER}."
}

require_command() {
    command -v "$1" >/dev/null 2>&1 || {
        echo "Error: no se encontro '$1' en PATH." >&2
        exit 1
    }
}

read_pid() {
    local pid_file="$1"
    [[ -f "${pid_file}" ]] && cat "${pid_file}" || true
}

is_running() {
    local pid="$1"
    [[ -n "${pid}" ]] && kill -0 "${pid}" 2>/dev/null
}

start_service() {
    local name="$1"
    local pid_file="$2"
    shift 2

    local existing_pid
    existing_pid="$(read_pid "${pid_file}")"
    if is_running "${existing_pid}"; then
        echo "${name} ya esta ejecutandose (PID ${existing_pid})."
        return
    fi

    rm -f "${pid_file}"
    "$@" >>"${LOG_DIR}/${name}.log" 2>&1 &
    echo $! >"${pid_file}"
    echo "${name} iniciado (PID $(cat "${pid_file}"))."
}

stop_service() {
    local name="$1"
    local pid_file="$2"
    local pid
    pid="$(read_pid "${pid_file}")"

    if ! is_running "${pid}"; then
        rm -f "${pid_file}"
        echo "${name} no estaba ejecutandose."
        return
    fi

    kill -TERM "${pid}"
    for _ in {1..20}; do
        is_running "${pid}" || break
        sleep 0.5
    done
    if is_running "${pid}"; then
        echo "Error: ${name} no termino despues de 10 segundos." >&2
        return 1
    fi

    rm -f "${pid_file}"
    echo "${name} detenido."
}

start() {
    require_command dotnet
    require_command docker
    [[ -x "${PYTHON_BIN}" ]] || {
        echo "Error: no se encontro Python ejecutable en '${PYTHON_BIN}'." >&2
        echo "Crea el entorno con: python3 -m venv backend/.venv" >&2
        exit 1
    }
    "${PYTHON_BIN}" -m gunicorn --version >/dev/null 2>&1 || {
        echo "Error: Gunicorn no esta instalado en '${PYTHON_BIN}'." >&2
        echo "Instala dependencias con: '${PYTHON_BIN}' -m pip install -r requirements-deploy.txt" >&2
        exit 1
    }
    configure_database_credentials
    if ! validate_existing_postgres; then
        echo "Las credenciales guardadas no coinciden con el contenedor PostgreSQL."
        request_database_credentials
        validate_existing_postgres || {
            echo "No se pudo validar la conexion con '${DB_NAME}'." >&2
            echo "Revisa usuario/contraseña en ${ENV_FILE}." >&2
            exit 1
        }
    fi

    mkdir -p "${PID_DIR}" "${LOG_DIR}"
    dotnet publish "${CSHARP_PROJECT}" --configuration Release --output "${PID_DIR}/csharp" \
        >>"${LOG_DIR}/csharp-build.log" 2>&1
    start_service "flask" "${PYTHON_PID_FILE}" \
        bash -c "cd '${PROJECT_ROOT}/backend' && exec '${PYTHON_BIN}' -m gunicorn --bind '${FLASK_BIND}' --workers \"\${GUNICORN_WORKERS:-2}\" --threads \"\${GUNICORN_THREADS:-4}\" --timeout \"\${GUNICORN_TIMEOUT:-120}\" iniciador:app"
    start_service "csharp" "${CSHARP_PID_FILE}" \
        dotnet "${PID_DIR}/csharp/ProyectoGrado.Api.dll" --urls "${CSHARP_BIND}"

    echo "Flask: http://${FLASK_BIND}"
    echo "C#:    ${CSHARP_BIND}"
    echo "Logs:  ${LOG_DIR}/flask.log y ${LOG_DIR}/csharp.log"
}

stop() {
    stop_service "csharp" "${CSHARP_PID_FILE}"
    stop_service "flask" "${PYTHON_PID_FILE}"
}

status() {
    local flask_pid csharp_pid
    flask_pid="$(read_pid "${PYTHON_PID_FILE}")"
    csharp_pid="$(read_pid "${CSHARP_PID_FILE}")"
    if is_running "${flask_pid}"; then
        echo "Flask: ejecutandose (PID ${flask_pid})"
    else
        echo "Flask: detenido"
    fi
    if is_running "${csharp_pid}"; then
        echo "C#: ejecutandose (PID ${csharp_pid})"
    else
        echo "C#: detenido"
    fi
}

case "${1:-start}" in
    start) start ;;
    stop) stop ;;
    restart) stop; start ;;
    status) status ;;
    *)
        echo "Uso: $0 {start|stop|restart|status}" >&2
        exit 2
        ;;
esac
