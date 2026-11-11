# BACKEND MODULE: auth
# API de autenticacion, sesiones, perfil y salud del servicio.
# Las funciones publicas y endpoints de este archivo se documentan junto a su implementacion.

"""Modulo de autenticacion."""
from .routes import auth_bp

__all__ = ['auth_bp']
