#!/usr/bin/env python3
"""
Instalador automático de imports para el proyecto.

Uso:
    python backend/instalador_imports.py [--dry-run]

Opciones:
    --dry-run          Solo lista paquetes que instalaría.
    --ask              Pide confirmación antes de instalar.
    --no-requirements  No instala requirements.txt.
    --force            Fuerza instalación/upgrade.
    --no-force         No fuerza instalación/upgrade.
    --no-libreoffice   No intenta instalar LibreOffice.
    --no-update-libreoffice  No intenta actualizar LibreOffice si ya está instalado.
    --no-libreoffice-path    No intenta agregar LibreOffice al PATH.
    --libreoffice-path-scope {user,system}  Scope del PATH (por defecto: system en Windows).

Funcionamiento básico:
  - Escanea todos los archivos .py del repositorio (salta venv y __pycache__).
  - Extrae nombres de módulos importados.
  - Filtra módulos de la stdlib y módulos locales del proyecto.
  - Para los módulos no instalados, ejecuta `python -m pip install <modulo>`.

Notas:
  - No existe una correspondencia perfecta entre nombre de import y nombre pip
    (ej: `bs4` vs `beautifulsoup4`). Este script intenta instalar usando el
    nombre del paquete igual al nombre del import.
"""

from __future__ import annotations

import argparse
import ast
import importlib.util
import os
import shutil
import subprocess
import sys
from importlib import metadata as importlib_metadata
from pathlib import Path
from typing import Set


ROOT = Path(__file__).resolve().parents[1]

# Mapeo de nombres de importación (código) a nombres de paquetes en (pip)
PACKAGE_MAPPING = {
    "googleapiclient": "google-api-python-client",
    "dotenv": "python-dotenv",
    "bs4": "beautifulsoup4",
    "jwt": "PyJWT",
    "yaml": "PyYAML",
    "PIL": "Pillow"
}


SYSTEM_DEPENDENCIES = {
    "libreoffice": {
        "executables": ["soffice", "soffice.exe"],
        "paths_windows": [
            "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
            "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
        ],
        "install": {
            "winget": ["winget", "install", "-e", "--id", "LibreOffice.LibreOffice"],
            "choco": ["choco", "install", "libreoffice", "-y"],
            "apt": ["sudo", "apt-get", "install", "-y", "libreoffice"],
            "dnf": ["sudo", "dnf", "install", "-y", "libreoffice"],
            "yum": ["sudo", "yum", "install", "-y", "libreoffice"],
            "pacman": ["sudo", "pacman", "-S", "--noconfirm", "libreoffice-fresh"],
            "brew": ["brew", "install", "--cask", "libreoffice"],
        },
        "upgrade": {
            "winget": ["winget", "upgrade", "-e", "--id", "LibreOffice.LibreOffice"],
            "choco": ["choco", "upgrade", "libreoffice", "-y"],
            "apt": ["sudo", "apt-get", "install", "-y", "libreoffice"],
            "dnf": ["sudo", "dnf", "upgrade", "-y", "libreoffice"],
            "yum": ["sudo", "yum", "update", "-y", "libreoffice"],
            "pacman": ["sudo", "pacman", "-Syu", "--noconfirm", "libreoffice-fresh"],
            "brew": ["brew", "upgrade", "--cask", "libreoffice"],
        },
    }
}


def find_py_files(root: Path) -> Set[Path]:
    skip_dirs = {".venv", "venv", "__pycache__", "node_modules", "env"}
    files = set()
    for dirpath, dirnames, filenames in os.walk(root):
        # modify dirnames in-place to skip
        dirnames[:] = [d for d in dirnames if d not in skip_dirs and not d.startswith(".")]
        for f in filenames:
            if f.endswith('.py'):
                files.add(Path(dirpath) / f)
    return files


def extract_imports_from_file(path: Path) -> Set[str]:
    try:
        src = path.read_text(encoding='utf-8')
    except Exception:
        return set()
    mods: Set[str] = set()
    try:
        tree = ast.parse(src)
    except Exception:
        return set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for n in node.names:
                mods.add(n.name.split('.')[0])
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                mods.add(node.module.split('.')[0])
    return mods


def is_local_module(name: str, root: Path) -> bool:
    # check for package dir or module file in project
    if (root / f"{name}.py").exists():
        return True
    if (root / name).is_dir():
        return True
    return False


def is_stdlib_module(name: str) -> bool:
    # Prefer sys.stdlib_module_names when available (Py3.10+)
    try:
        import sys
        stdlib = getattr(sys, 'stdlib_module_names', None)
        if stdlib is not None:
            return name in stdlib
    except Exception:
        pass

    # Fallback: use importlib.util.find_spec and inspect origin
    try:
        spec = importlib.util.find_spec(name)
        if spec is None:
            return False
        origin = spec.origin
        if origin is None:
            return True
        origin = str(origin)
        # heurística: si está en site-packages o dist-packages -> no stdlib
        if 'site-packages' in origin or 'dist-packages' in origin:
            return False
        # si el path contiene Python\Lib (Windows) o /lib/pythonX (Unix) -> stdlib
        if 'lib/python' in origin.replace('\\','/') or ('\\Lib\\' in origin):
            return True
    except Exception:
        pass
    return False


def is_installed(name: str) -> bool:
    try:
        return importlib.util.find_spec(name) is not None
    except Exception:
        return False


def is_dist_installed(name: str) -> bool:
    try:
        importlib_metadata.version(name)
        return True
    except importlib_metadata.PackageNotFoundError:
        return False
    except Exception:
        return False


def install_package(name: str, *, upgrade: bool = False) -> bool:
    cmd = [sys.executable, '-m', 'pip', 'install']
    if upgrade:
        cmd.append('--upgrade')
    cmd.append(name)
    try:
        print(f"Ejecutando: {' '.join(cmd)}")
        res = subprocess.run(cmd, check=True)
        return res.returncode == 0
    except subprocess.CalledProcessError:
        return False


def install_requirements_file(path: Path, *, upgrade: bool = False) -> bool:
    if not path.exists():
        return True
    cmd = [sys.executable, '-m', 'pip', 'install']
    if upgrade:
        cmd.append('--upgrade')
    cmd.extend(['-r', str(path)])
    try:
        print(f"Ejecutando: {' '.join(cmd)}")
        res = subprocess.run(cmd, check=True)
        return res.returncode == 0
    except subprocess.CalledProcessError:
        return False


def _parse_requirement_name(line: str) -> str | None:
    raw = line.strip()
    if not raw or raw.startswith('#'):
        return None
    if raw.startswith('-r') or raw.startswith('--'):
        return None

    raw = raw.split('#', 1)[0].strip()
    raw = raw.split(';', 1)[0].strip()
    if not raw:
        return None

    if ' @ ' in raw:
        raw = raw.split(' @ ', 1)[0].strip()

    if '[' in raw:
        raw = raw.split('[', 1)[0].strip()

    for sep in ('==', '>=', '<=', '~=', '!=', '>', '<'):
        if sep in raw:
            raw = raw.split(sep, 1)[0].strip()
            break

    return raw or None


def _parse_requirement_detail(line: str) -> tuple[str | None, str | None]:
    raw = line.strip()
    if not raw or raw.startswith('#'):
        return None, None
    if raw.startswith('-r') or raw.startswith('--'):
        return None, None

    raw = raw.split('#', 1)[0].strip()
    raw = raw.split(';', 1)[0].strip()
    if not raw:
        return None, None

    if ' @ ' in raw:
        name = raw.split(' @ ', 1)[0].strip()
        if '[' in name:
            name = name.split('[', 1)[0].strip()
        return name or None, None

    ops = ('===', '==', '>=', '<=', '~=', '!=', '>', '<')
    op_index = None
    op_used = None
    for op in ops:
        idx = raw.find(op)
        if idx != -1 and (op_index is None or idx < op_index):
            op_index = idx
            op_used = op

    if op_index is None:
        name = raw
        if '[' in name:
            name = name.split('[', 1)[0].strip()
        return name or None, None

    name = raw[:op_index].strip()
    spec = raw[op_index + len(op_used):].strip()
    if '[' in name:
        name = name.split('[', 1)[0].strip()
    if not name:
        return None, None
    return name, f"{op_used}{spec}" if spec else None


def _read_requirements(paths: list[Path]) -> Set[str]:
    reqs: Set[str] = set()
    for path in paths:
        if not path.exists():
            continue
        try:
            for line in path.read_text(encoding='utf-8').splitlines():
                name = _parse_requirement_name(line)
                if name:
                    reqs.add(name)
        except Exception:
            continue
    return reqs


def _read_requirements_detail(paths: list[Path]) -> dict[str, str | None]:
    reqs: dict[str, str | None] = {}
    for path in paths:
        if not path.exists():
            continue
        try:
            for line in path.read_text(encoding='utf-8').splitlines():
                name, spec = _parse_requirement_detail(line)
                if not name:
                    continue
                if name in reqs:
                    if reqs[name] is None and spec is not None:
                        reqs[name] = spec
                    continue
                reqs[name] = spec
        except Exception:
            continue
    return reqs


def _is_requirement_satisfied(name: str, spec: str | None) -> bool:
    try:
        installed_version = importlib_metadata.version(name)
    except importlib_metadata.PackageNotFoundError:
        return False
    except Exception:
        return False

    if not spec:
        return True

    normalized = spec.replace(' ', '')
    if normalized.startswith('==='):
        return installed_version == normalized[3:]
    if normalized.startswith('=='):
        return installed_version == normalized[2:]

    return True


def _has_executable(names: list[str]) -> bool:
    for name in names:
        if shutil.which(name):
            return True
    return False


def _find_libreoffice_executable() -> tuple[str | None, bool]:
    dep = SYSTEM_DEPENDENCIES.get("libreoffice")
    if not dep:
        return None, False

    for name in dep.get("executables", []):
        found = shutil.which(name)
        if found:
            return found, True

    if os.name == "nt":
        for raw_path in dep.get("paths_windows", []):
            exe_path = Path(raw_path)
            if exe_path.exists():
                return str(exe_path), False

    return None, False


def _is_windows() -> bool:
    return os.name == "nt"


def _is_admin_windows() -> bool:
    if not _is_windows():
        return False
    try:
        import ctypes
        return bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception:
        return False


def _notify_windows_env_changed() -> None:
    try:
        import ctypes
        HWND_BROADCAST = 0xFFFF
        WM_SETTINGCHANGE = 0x001A
        ctypes.windll.user32.SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            "Environment",
            0x0002,
            5000,
            None
        )
    except Exception:
        return None


def _add_to_windows_path(target_dir: str, scope: str) -> bool:
    if not _is_windows():
        return False

    try:
        import winreg
    except Exception:
        return False

    if scope == "system":
        root = winreg.HKEY_LOCAL_MACHINE
        subkey = r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"
    else:
        root = winreg.HKEY_CURRENT_USER
        subkey = r"Environment"

    try:
        with winreg.OpenKey(root, subkey, 0, winreg.KEY_READ) as key:
            current_path, _ = winreg.QueryValueEx(key, "Path")
    except Exception:
        current_path = ""

    parts = [p for p in str(current_path).split(";") if p]
    normalized_target = os.path.normcase(os.path.normpath(target_dir))
    for p in parts:
        if os.path.normcase(os.path.normpath(p)) == normalized_target:
            return True

    new_value = current_path
    if new_value and not str(new_value).endswith(";"):
        new_value = f"{new_value};"
    new_value = f"{new_value}{target_dir}"

    try:
        with winreg.OpenKey(root, subkey, 0, winreg.KEY_SET_VALUE) as key:
            winreg.SetValueEx(key, "Path", 0, winreg.REG_EXPAND_SZ, new_value)
        _notify_windows_env_changed()
        return True
    except Exception:
        return False


def _ensure_libreoffice_path(lo_path: str, *, scope: str, dry_run: bool) -> bool:
    if not _is_windows():
        return True
    program_dir = str(Path(lo_path).parent)
    if dry_run:
        print(f"(dry-run) Se agregaria al PATH ({scope}): {program_dir}")
        return True
    ok = _add_to_windows_path(program_dir, scope=scope)
    if ok:
        print(f"LibreOffice agregado al PATH ({scope}). Reinicia la terminal.")
    else:
        print("No se pudo agregar LibreOffice al PATH automaticamente.")
    return ok


def _relaunch_as_admin(argv: list[str]) -> bool:
    if not _is_windows():
        return False
    try:
        import ctypes
        cmd_args = [str(Path(__file__).resolve())]
        for arg in argv:
            if arg != "--elevated":
                cmd_args.append(arg)
        cmd_args.append("--elevated")
        params = subprocess.list2cmdline(cmd_args)
        rc = ctypes.windll.shell32.ShellExecuteW(None, "runas", sys.executable, params, None, 1)
        return rc > 32
    except Exception:
        return False


def _get_libreoffice_version(executable: str) -> str | None:
    try:
        res = subprocess.run(
            [executable, "--version"],
            check=True,
            capture_output=True,
            text=True
        )
        return res.stdout.strip() or res.stderr.strip() or None
    except Exception:
        return None


def _detect_pkg_manager() -> str | None:
    for tool in ("winget", "choco", "apt", "dnf", "yum", "pacman", "brew"):
        if shutil.which(tool):
            return tool
    return None


def _install_system_dependency(dep_key: str, *, dry_run: bool = False) -> bool:
    dep = SYSTEM_DEPENDENCIES.get(dep_key)
    if not dep:
        return False

    manager = _detect_pkg_manager()
    install_map = dep.get("install", {})
    if not manager or manager not in install_map:
        print(f"No se encontró gestor de paquetes compatible para instalar {dep_key}.")
        return False

    cmd = install_map[manager]
    print(f"Ejecutando: {' '.join(cmd)}")
    if dry_run:
        return True

    try:
        res = subprocess.run(cmd, check=True)
        return res.returncode == 0
    except subprocess.CalledProcessError:
        return False


def _upgrade_system_dependency(dep_key: str, *, dry_run: bool = False) -> bool:
    dep = SYSTEM_DEPENDENCIES.get(dep_key)
    if not dep:
        return False

    manager = _detect_pkg_manager()
    upgrade_map = dep.get("upgrade", {})
    if not manager or manager not in upgrade_map:
        print(f"No se encontró gestor de paquetes compatible para actualizar {dep_key}.")
        return False

    cmd = upgrade_map[manager]
    print(f"Ejecutando: {' '.join(cmd)}")
    if dry_run:
        return True

    try:
        res = subprocess.run(cmd, check=True)
        return res.returncode == 0
    except subprocess.CalledProcessError:
        return False


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description='Instalador automático de imports')
    p.add_argument('--dry-run', action='store_true', help='Solo lista paquetes a instalar')
    p.add_argument('--ask', dest='yes', action='store_false', help='Pide confirmación antes de instalar')
    p.add_argument('--no-requirements', dest='install_requirements', action='store_false', help='No instala requirements.txt')
    p.add_argument('--force', dest='force_all', action='store_true', help='Fuerza instalación/upgrade')
    p.add_argument('--no-force', dest='force_all', action='store_false', help='No fuerza instalación/upgrade')
    p.add_argument('--no-libreoffice', dest='install_libreoffice', action='store_false', help='No intenta instalar LibreOffice')
    p.add_argument('--no-update-libreoffice', dest='update_libreoffice', action='store_false', help='No intenta actualizar LibreOffice si ya está instalado')
    p.add_argument('--no-libreoffice-path', dest='libreoffice_path', action='store_false', help='No intenta agregar LibreOffice al PATH')
    p.add_argument('--libreoffice-path-scope', choices=('user', 'system'), default=None, help='Scope del PATH para LibreOffice')
    p.add_argument('--elevated', action='store_true', help=argparse.SUPPRESS)
    p.add_argument('--root', default=str(ROOT), help='Raíz del proyecto (opcional)')
    p.set_defaults(yes=True, install_requirements=True, force_all=False, install_libreoffice=True, update_libreoffice=True, libreoffice_path=True)
    args = p.parse_args(argv)

    if args.libreoffice_path_scope is None:
        args.libreoffice_path_scope = "system" if _is_windows() else "user"

    preflight_lo_path, preflight_lo_in_path = _find_libreoffice_executable()
    needs_install = args.install_libreoffice and not preflight_lo_path
    needs_path_system = (
        args.libreoffice_path
        and args.libreoffice_path_scope == "system"
        and preflight_lo_path
        and not preflight_lo_in_path
    )
    needs_admin = needs_install or needs_path_system

    print("\n[Preflight] LibreOffice")
    print(f"- Detectado: {'si' if preflight_lo_path else 'no'}")
    if preflight_lo_path:
        print(f"- Ruta: {preflight_lo_path}")
        print(f"- En PATH: {'si' if preflight_lo_in_path else 'no'}")
    print(f"- Instalar LibreOffice: {'si' if args.install_libreoffice else 'no'}")
    print(f"- Agregar PATH: {'si' if args.libreoffice_path else 'no'}")
    if args.libreoffice_path:
        print(f"- PATH scope: {args.libreoffice_path_scope}")
    print(f"- Requiere admin: {'si' if needs_admin and _is_windows() and not args.dry_run else 'no'}")

    if needs_admin and _is_windows() and not args.dry_run:
        if not _is_admin_windows() and not args.elevated:
            print('Se requieren permisos de administrador para instalar LibreOffice o modificar el PATH de sistema.')
            ok = _relaunch_as_admin(sys.argv[1:])
            if ok:
                print('Solicitud de elevacion enviada. Confirma el UAC para continuar.')
                return 0
            print('No se pudo solicitar permisos de administrador.')
            return 2

    root = Path(args.root)
    print(f"Escaneando {root} en busca de archivos .py ...")
    py_files = find_py_files(root)
    print(f"Se encontraron {len(py_files)} archivos .py")

    req_paths = [root / 'requirements.txt', root / 'backend' / 'requirements.txt']
    req_details = _read_requirements_detail(req_paths)
    reqs = set(req_details.keys())
    if reqs:
        print(f"Se encontraron {len(reqs)} paquetes en requirements.txt")

    imports: Set[str] = set()
    for f in sorted(py_files):
        imports.update(extract_imports_from_file(f))

    # filtrar nombres inválidos y propios
    candidates: Set[str] = set()
    for name in imports:
        if not name or name.startswith('_'):
            continue
        if is_local_module(name, root):
            continue
        if is_stdlib_module(name):
            continue
        candidates.add(name)

    if not candidates and not reqs:
        print('No se encontraron paquetes externos para instalar.')

    missing_requirements = []
    for name, spec in req_details.items():
        if not _is_requirement_satisfied(name, spec):
            missing_requirements.append(name)

    requirements_to_install = sorted(reqs) if args.force_all else sorted(missing_requirements)

    to_install = []
    skipped_installed: set[str] = set()
    skipped_requirements: set[str] = set()
    if not args.install_requirements:
        for req in requirements_to_install:
            to_install.append(req)

    for n in sorted(candidates):
        pkg_name = PACKAGE_MAPPING.get(n, n)
        if pkg_name in to_install:
            continue
        if args.install_requirements and pkg_name in reqs:
            skipped_requirements.add(pkg_name)
            continue
        if not args.force_all:
            if is_installed(n) or is_dist_installed(pkg_name):
                skipped_installed.add(pkg_name)
                continue
        to_install.append(pkg_name)

    if not to_install and not args.install_requirements:
        print('Todos los paquetes detectados ya están instalados en el entorno.')

    print('\nPaquetes detectados para instalar:')
    for n in to_install:
        print(' -', n)

    if args.dry_run:
        print('\n--dry-run activado, no se instalará nada.')
        return 0

    if not args.yes:
        ok = input('\nDeseas instalar estos paquetes ahora? [y/N]: ').strip().lower()
        if ok not in ('y', 's', 'si', 'yes'):
            print('Cancelado por usuario.')
            return 1

    req_ok = True
    if args.install_requirements:
        if args.force_all or missing_requirements:
            for req_path in req_paths:
                ok = install_requirements_file(req_path, upgrade=args.force_all)
                req_ok = req_ok and ok
        else:
            print('Requirements ya instalados; se omite instalación.')

    success = []
    fail = []
    for name in to_install:
        print(f'Instalando {name} ...')
        ok = install_package(name, upgrade=args.force_all)
        if ok:
            success.append(name)
        else:
            fail.append(name)

    print('\nResumen:')
    print('Instalados:', ', '.join(success) if success else 'ninguno')
    print('Fallaron:', ', '.join(fail) if fail else 'ninguno')
    if args.install_requirements:
        print('Requirements:', 'OK' if req_ok else 'con fallos')

    # Chequear dependencias del sistema (LibreOffice)
    lo_install_attempted = False
    lo_install_ok = None
    lo_update_attempted = False
    lo_update_ok = None
    lo_path_attempted = False
    lo_path_ok = None
    lo_dep = SYSTEM_DEPENDENCIES.get('libreoffice')
    if lo_dep:
        lo_path, lo_in_path = _find_libreoffice_executable()
        if not lo_path:
            print('\nLibreOffice no está instalado (soffice no encontrado).')
            if args.install_libreoffice:
                if not args.yes:
                    ok = input('Deseas instalar LibreOffice ahora? [y/N]: ').strip().lower()
                    if ok not in ('y', 's', 'si', 'yes'):
                        print('Instalación de LibreOffice cancelada.')
                        return 0 if not fail else 2

                lo_install_attempted = True
                ok = _install_system_dependency('libreoffice', dry_run=args.dry_run)
                lo_install_ok = ok
                if ok:
                    print('LibreOffice instalado correctamente.')
                else:
                    print('No se pudo instalar LibreOffice automáticamente.')
                    print('Instálalo manualmente desde: https://www.libreoffice.org/download/')
            else:
                print('LibreOffice omitido (--no-libreoffice).')
            lo_path, lo_in_path = _find_libreoffice_executable()
        else:
            print(f'\nLibreOffice encontrado: {lo_path}')
            lo_version = _get_libreoffice_version(lo_path)
            if lo_version:
                print(f'Version detectada: {lo_version}')
            if not lo_in_path:
                print('Nota: LibreOffice no está en el PATH. Agrega la carpeta:')
                print('  C:\\Program Files\\LibreOffice\\program')
            if args.update_libreoffice:
                lo_update_attempted = True
                ok = _upgrade_system_dependency('libreoffice', dry_run=args.dry_run)
                lo_update_ok = ok
                if ok:
                    print('Actualización de LibreOffice completada.')
                else:
                    print('No se pudo actualizar LibreOffice automáticamente.')

        if lo_path and args.libreoffice_path and not lo_in_path and _is_windows():
            path_scope = args.libreoffice_path_scope
            if path_scope == "system" and not _is_admin_windows():
                print('PATH de sistema requiere permisos admin. Se intentara PATH de usuario.')
                path_scope = "user"
            lo_path_attempted = True
            lo_path_ok = _ensure_libreoffice_path(lo_path, scope=path_scope, dry_run=args.dry_run)

    remaining_requirements = []
    for name, spec in req_details.items():
        if not _is_requirement_satisfied(name, spec):
            remaining_requirements.append(name)

    final_lo_path, final_lo_in_path = _find_libreoffice_executable()
    not_installed_items = []
    not_installed_items.extend(sorted(fail))
    if args.install_requirements and not req_ok:
        not_installed_items.append('requirements.txt (pip -r)')
    if remaining_requirements:
        not_installed_items.append(f"requirements pendientes: {', '.join(sorted(remaining_requirements))}")
    if lo_dep and args.install_libreoffice and not final_lo_path:
        not_installed_items.append('LibreOffice')
    if lo_dep and args.libreoffice_path and final_lo_path and not final_lo_in_path:
        not_installed_items.append('PATH LibreOffice')
    if lo_update_attempted and lo_update_ok is False:
        not_installed_items.append('Actualizacion LibreOffice')
    if lo_path_attempted and lo_path_ok is False:
        not_installed_items.append('Agregar PATH LibreOffice')

    seen = set()
    not_installed_unique = []
    for item in not_installed_items:
        if item in seen:
            continue
        seen.add(item)
        not_installed_unique.append(item)

    no_impact_items = []
    if skipped_installed:
        no_impact_items.append(f"Paquetes ya instalados: {', '.join(sorted(skipped_installed))}")
    if skipped_requirements:
        no_impact_items.append(f"Paquetes cubiertos por requirements: {', '.join(sorted(skipped_requirements))}")
    if args.install_requirements and req_details and not missing_requirements:
        no_impact_items.append('Requirements ya estaban satisfechos')
    if lo_dep and final_lo_path and args.install_libreoffice and not lo_install_attempted:
        no_impact_items.append('LibreOffice ya estaba instalado')
    if lo_dep and final_lo_path and final_lo_in_path and args.libreoffice_path and not lo_path_attempted:
        no_impact_items.append('LibreOffice ya estaba en PATH')

    all_detected = sorted(set(to_install) | set(reqs))
    print('\n[Resumen final]')
    print(f"- Detectados por requirements: {', '.join(sorted(reqs)) if reqs else 'ninguno'}")
    print(f"- Detectados por imports: {', '.join(sorted(set(to_install) - set(reqs))) if to_install else 'ninguno'}")
    print(f"- Paquetes instalados: {', '.join(success) if success else 'ninguno'}")
    print(f"- No instalados / fallo: {', '.join(not_installed_unique) if not_installed_unique else 'ninguno'}")
    if args.install_requirements:
        print(f"- Requirements (pip -r): {'OK' if req_ok else 'con fallos'}")
    if lo_dep:
        print(f"- LibreOffice detectado: {'si' if final_lo_path else 'no'}")
        if final_lo_path:
            print(f"- LibreOffice en PATH: {'si' if final_lo_in_path else 'no'}")
        if lo_install_attempted:
            print(f"- Instalacion LibreOffice: {'OK' if lo_install_ok else 'fallo'}")
        if lo_update_attempted:
            print(f"- Actualizacion LibreOffice: {'OK' if lo_update_ok else 'fallo'}")
        if lo_path_attempted:
            print(f"- Agregar PATH LibreOffice: {'OK' if lo_path_ok else 'fallo'}")
    if no_impact_items:
        print('- Sin impacto (ya estaba listo o no requeria cambios):')
        for item in no_impact_items:
            print(f"  * {item}")
    else:
        print('- Sin impacto: ninguno')
    return 0 if not fail and req_ok else 2


if __name__ == '__main__':
    raise SystemExit(main())
