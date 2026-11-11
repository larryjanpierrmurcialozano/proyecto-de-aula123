# BACKEND MODULE: registros
# API legacy de registros de asistencia, mantenida por compatibilidad.
# Las funciones publicas y endpoints de este archivo se documentan junto a su implementacion.

"""Modulo legacy de registros."""
from .routes import registros_bp

__all__ = ['registros_bp']
