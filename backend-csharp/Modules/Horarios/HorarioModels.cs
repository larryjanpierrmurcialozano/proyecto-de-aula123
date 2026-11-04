using System.Text.Json.Serialization;

namespace ProyectoGrado.Api.Modules.Horarios;

public sealed record HorarioRequest
{
    [JsonPropertyName("id_asignacion")]
    public int? IdAsignacion { get; init; }

    [JsonPropertyName("id_grupo")]
    public int? IdGrupo { get; init; }

    [JsonPropertyName("dia_semana")]
    public string? DiaSemana { get; init; }

    [JsonPropertyName("hora_inicio")]
    public string? HoraInicio { get; init; }

    [JsonPropertyName("hora_fin")]
    public string? HoraFin { get; init; }

    [JsonPropertyName("aula")]
    public string? Aula { get; init; }

    [JsonPropertyName("observaciones")]
    public string? Observaciones { get; init; }
}
