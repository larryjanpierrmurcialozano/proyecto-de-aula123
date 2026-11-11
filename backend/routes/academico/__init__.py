# BACKEND MODULE: academico
# API de grados, grupos, materias y asignaciones docentes.
# Las funciones publicas y endpoints de este archivo se documentan junto a su implementacion.

"""Modulo academico."""
from .routes import academico_bp

__all__ = ['academico_bp']
