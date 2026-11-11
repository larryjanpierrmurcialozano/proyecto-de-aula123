// BACKEND MODULE: Auth
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication;

namespace ProyectoGrado.Api.Modules.Auth;

/// <summary>Credenciales para iniciar sesión.</summary>
public sealed record LoginRequest
{
    [Required, EmailAddress]
    public required string Email { get; init; }

    [Required]
    public required string Password { get; init; }
}

/// <summary>Datos públicos para registrar un usuario profesor.</summary>
public sealed record RegisterRequest
{
    [Required, MaxLength(100)]
    public required string Nombre { get; init; }

    [Required, MaxLength(100)]
    public required string Apellido { get; init; }

    [Required, EmailAddress, MaxLength(255)]
    public required string Email { get; init; }

    [Required, PasswordPolicy]
    public required string Password { get; init; }

    [Required, MaxLength(100)]
    public required string Documento { get; init; }
}

/// <summary>Contraseña actual y nueva para cambiar las credenciales.</summary>
public sealed record ChangePasswordRequest
{
    [Required]
    public required string CurrentPassword { get; init; }

    [Required, PasswordPolicy]
    public required string NewPassword { get; init; }
}

public sealed class PasswordPolicyAttribute : ValidationAttribute
{
    public PasswordPolicyAttribute() : base(PasswordPolicy.ErrorMessage)
    {
    }

    public override bool IsValid(object? value) =>
        value is null || value is string password && PasswordPolicy.IsValid(password);
}

public static class PasswordPolicy
{
    public const string ErrorMessage = "La contraseña debe tener al menos 6 caracteres e incluir letras y números.";

    public static bool IsValid(string? password)
    {
        if (password is null)
        {
            return false;
        }

        var characters = password.EnumerateRunes().ToArray();
        return characters.Length >= 6 &&
            characters.Any(Rune.IsLetter) &&
            characters.Any(character => Rune.GetUnicodeCategory(character) is
                UnicodeCategory.DecimalDigitNumber or
                UnicodeCategory.LetterNumber or
                UnicodeCategory.OtherNumber);
    }
}

public enum PasswordChangeResult
{
    Updated,
    Unauthenticated,
    InvalidCurrentPassword,
    InvalidNewPassword
}

public sealed record AuthenticatedUser(
    ProyectoGrado.Api.Modules.Usuarios.UsuarioDetail User,
    ClaimsPrincipal Principal,
    AuthenticationProperties Properties);

public sealed record RegistrationResult(bool IsSuccess, int? UserId, string? Error);
