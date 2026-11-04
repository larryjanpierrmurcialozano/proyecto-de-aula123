using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProyectoGrado.Api.Modules.Academico;

public sealed record GradoCreateRequest
{
    [JsonPropertyName("numero_grado")]
    public int? NumeroGrado { get; init; }

    [JsonPropertyName("orden")]
    public int? Orden { get; init; }

    [JsonPropertyName("id_nivel")]
    public int? IdNivel { get; init; }

    [JsonPropertyName("nombre_grado")]
    public string? NombreGrado { get; init; }
}

public sealed record GrupoRequest
{
    [JsonPropertyName("codigo_grupo"), Required]
    public required string CodigoGrupo { get; init; }

    [JsonPropertyName("id_grado"), Range(1, int.MaxValue)]
    public int IdGrado { get; init; }

    [JsonPropertyName("capacidad_maxima")]
    public int CapacidadMaxima { get; init; }
}

public sealed record MateriaRequest
{
    [JsonPropertyName("nombre_materia"), Required]
    public required string NombreMateria { get; init; }

    [JsonPropertyName("codigo_materia"), Required]
    public required string CodigoMateria { get; init; }

    [JsonPropertyName("intensidad_horaria")]
    public int IntensidadHoraria { get; init; } = 4;

    [JsonPropertyName("descripcion")]
    public string Descripcion { get; init; } = string.Empty;
}

public sealed record AsignacionDocenteRequest
{
    [JsonPropertyName("id_usuario"), Range(1, int.MaxValue)]
    public int IdUsuario { get; init; }

    [JsonPropertyName("id_materia"), Range(1, int.MaxValue)]
    public int IdMateria { get; init; }

    [JsonPropertyName("id_grado"), Range(1, int.MaxValue)]
    public int IdGrado { get; init; }

    [JsonPropertyName("id_grupo"), Range(1, int.MaxValue)]
    public int IdGrupo { get; init; }

    [JsonPropertyName("año_lectivo")]
    public int AñoLectivo { get; init; } = 2026;
}
