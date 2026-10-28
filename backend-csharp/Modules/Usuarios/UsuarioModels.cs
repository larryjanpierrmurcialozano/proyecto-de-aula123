using System.ComponentModel.DataAnnotations;

namespace ProyectoGrado.Api.Modules.Usuarios;

/// <summary>Usuario resumido para listados administrativos.</summary>
public sealed record UsuarioListItem(
    int IdUsuario,
    string Documento,
    string Nombre,
    string Apellido,
    string Correo,
    string NombreRol,
    bool IsActivo);

/// <summary>Detalle público de un usuario.</summary>
public sealed record UsuarioDetail(
    int IdUsuario,
    string Documento,
    string Nombre,
    string Apellido,
    string Correo,
    string NombreRol,
    bool IsActivo,
    DateTime? CreatedAt);

/// <summary>Rol disponible para asignar a un usuario.</summary>
public sealed record RolItem(int IdRol, string NombreRol, string? Descripcion);

/// <summary>Datos necesarios para crear un usuario administrativo.</summary>
public sealed record CreateUsuarioRequest
{
    [Required, MaxLength(100), RegularExpression(@"^[0-9]+$", ErrorMessage = "El documento solo puede contener números.")]
    public required string Documento { get; init; }

    [Required, MaxLength(100), RegularExpression(@"^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$", ErrorMessage = "El nombre solo puede contener letras, espacios, apóstrofes o guiones.")]
    public required string Nombre { get; init; }

    [Required, MaxLength(100), RegularExpression(@"^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$", ErrorMessage = "El apellido solo puede contener letras, espacios, apóstrofes o guiones.")]
    public required string Apellido { get; init; }

    [Required, EmailAddress, MaxLength(255)]
    public required string Correo { get; init; }

    [Required, MinLength(6)]
    public required string Password { get; init; }

    [Range(1, int.MaxValue)]
    public int IdRol { get; init; }
}

/// <summary>Datos editables de un usuario.</summary>
public sealed record UpdateUsuarioRequest
{
    [Required, MaxLength(100), RegularExpression(@"^[0-9]+$", ErrorMessage = "El documento solo puede contener números.")]
    public required string Documento { get; init; }

    [Required, MaxLength(100), RegularExpression(@"^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$", ErrorMessage = "El nombre solo puede contener letras, espacios, apóstrofes o guiones.")]
    public required string Nombre { get; init; }

    [Required, MaxLength(100), RegularExpression(@"^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$", ErrorMessage = "El apellido solo puede contener letras, espacios, apóstrofes o guiones.")]
    public required string Apellido { get; init; }

    [Required, EmailAddress, MaxLength(255)]
    public required string Correo { get; init; }

    [Range(1, int.MaxValue)]
    public int IdRol { get; init; }

    public bool IsActivo { get; init; }

    [MinLength(6)]
    public string? Password { get; init; }
}
