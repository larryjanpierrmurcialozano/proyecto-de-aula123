// BACKEND MODULE: Academico
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProyectoGrado.Api.Modules.Academico;

// Datos recibidos para crear o actualizar un grado.
// "orden" se conserva como alias compatible con el contrato anterior de Flask.
public sealed record GradoCreateRequest
{
    // Numero visible del grado.
    [JsonPropertyName("numero_grado")]
    public int? NumeroGrado { get; init; }

    // Alias antiguo del numero del grado.
    [JsonPropertyName("orden")]
    public int? Orden { get; init; }

    // Nivel educativo al que pertenece el grado.
    [JsonPropertyName("id_nivel")]
    public int? IdNivel { get; init; }

    // Nombre descriptivo del grado.
    [JsonPropertyName("nombre_grado")]
    public string? NombreGrado { get; init; }
}

// Datos necesarios para crear o actualizar un grupo dentro de un grado.
public sealed record GrupoRequest
{
    // Codigo identificador del grupo, por ejemplo "A" o "01".
    [JsonPropertyName("codigo_grupo"), Required]
    public required string CodigoGrupo { get; init; }

    // Grado al que pertenece el grupo.
    [JsonPropertyName("id_grado"), Range(1, int.MaxValue)]
    public int IdGrado { get; init; }

    // Capacidad maxima permitida para el grupo.
    [JsonPropertyName("capacidad_maxima")]
    public int CapacidadMaxima { get; init; }
}

// Datos necesarios para crear o actualizar una materia.
public sealed record MateriaRequest
{
    // Nombre que se muestra en el sistema.
    [JsonPropertyName("nombre_materia"), Required]
    public required string NombreMateria { get; init; }

    // Codigo institucional de la materia.
    [JsonPropertyName("codigo_materia"), Required]
    public required string CodigoMateria { get; init; }

    // Cantidad de horas semanales de la materia.
    [JsonPropertyName("intensidad_horaria")]
    public int IntensidadHoraria { get; init; } = 4;

    // Descripcion adicional de la materia.
    [JsonPropertyName("descripcion")]
    public string Descripcion { get; init; } = string.Empty;
}

// Relaciona un docente, una materia, un grado y un grupo durante un año lectivo.
public sealed record AsignacionDocenteRequest
{
    // Usuario que tiene el rol de docente.
    [JsonPropertyName("id_usuario"), Range(1, int.MaxValue)]
    public int IdUsuario { get; init; }

    // Materia que impartira el docente.
    [JsonPropertyName("id_materia"), Range(1, int.MaxValue)]
    public int IdMateria { get; init; }

    // Grado donde se realiza la asignacion.
    [JsonPropertyName("id_grado"), Range(1, int.MaxValue)]
    public int IdGrado { get; init; }

    // Grupo especifico donde se realiza la asignacion.
    [JsonPropertyName("id_grupo"), Range(1, int.MaxValue)]
    public int IdGrupo { get; init; }

    // Año academico de la asignacion.
    [JsonPropertyName("año_lectivo")]
    public int AñoLectivo { get; init; } = 2026;
}
