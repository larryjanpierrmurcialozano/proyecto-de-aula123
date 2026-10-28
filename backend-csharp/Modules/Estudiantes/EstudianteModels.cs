using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProyectoGrado.Api.Modules.Estudiantes;

public sealed record EstudianteRequest
{
    [JsonPropertyName("documento"), Required, RegularExpression(@"^[0-9]+$", ErrorMessage = "El documento solo puede contener números.")]
    public required string Documento { get; init; }

    [JsonPropertyName("nombre"), Required, RegularExpression(@"^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$", ErrorMessage = "Los nombres solo pueden contener letras, espacios, apóstrofes o guiones.")]
    public required string Nombre { get; init; }

    [JsonPropertyName("apellido"), Required, RegularExpression(@"^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$", ErrorMessage = "Los apellidos solo pueden contener letras, espacios, apóstrofes o guiones.")]
    public required string Apellido { get; init; }

    [JsonPropertyName("fecha_nacimiento")]
    public DateOnly? FechaNacimiento { get; init; }

    [JsonPropertyName("genero")]
    public string Genero { get; init; } = "M";

    [JsonPropertyName("id_grupo"), Range(1, int.MaxValue), JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int IdGrupo { get; init; }

    [JsonPropertyName("acudiente_nombre"), RegularExpression(@"^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$", ErrorMessage = "El nombre del acudiente solo puede contener letras, espacios, apóstrofes o guiones.")]
    public string? AcudienteNombre { get; init; }

    [JsonPropertyName("acudiente_telefono"), RegularExpression(@"^[0-9]*$", ErrorMessage = "El teléfono del acudiente solo puede contener números.")]
    public string? AcudienteTelefono { get; init; }

    [JsonPropertyName("correo")]
    public string? Correo { get; init; }

    [JsonPropertyName("direccion")]
    public string? Direccion { get; init; }

    [JsonPropertyName("estado")]
    public string Estado { get; init; } = "Activo";
}
