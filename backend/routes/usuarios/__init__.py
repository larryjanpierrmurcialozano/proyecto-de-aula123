# BACKEND MODULE: usuarios
# API de usuarios, roles y administracion de cuentas.
# Las funciones publicas y endpoints de este archivo se documentan junto a su implementacion.

"""Modulo de usuarios."""
from .routes import usuarios_bp

__all__ = ['usuarios_bp']
