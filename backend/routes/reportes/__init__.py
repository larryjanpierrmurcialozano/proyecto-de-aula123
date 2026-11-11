# BACKEND MODULE: reportes
# API de logs, reportes, boletines y envio de correos.
# Las funciones publicas y endpoints de este archivo se documentan junto a su implementacion.

"""Modulo de reportes y logs."""
from .routes import reportes_bp

__all__ = ['reportes_bp']
