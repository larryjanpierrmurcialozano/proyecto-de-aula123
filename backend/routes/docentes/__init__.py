# BACKEND MODULE: docentes
# API de docentes, asignaciones y consultas del panel docente.
# Las funciones publicas y endpoints de este archivo se documentan junto a su implementacion.

"""Modulo de docentes."""
from .routes import docentes_bp

__all__ = ['docentes_bp']
