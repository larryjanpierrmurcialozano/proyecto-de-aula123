# BACKEND MODULE: horarios
# API de horarios, niveles y asignaciones por grupo o grado.
# Las funciones publicas y endpoints de este archivo se documentan junto a su implementacion.

"""Modulo de horarios."""
from .routes import horarios_bp

__all__ = ['horarios_bp']
