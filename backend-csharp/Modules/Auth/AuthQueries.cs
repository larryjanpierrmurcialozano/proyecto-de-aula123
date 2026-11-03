using ProyectoGrado.Api.Data;
using ProyectoGrado.Api.Modules.Usuarios;
using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Npgsql;

namespace ProyectoGrado.Api.Modules.Auth;

public sealed class AuthQueries(PostgresConnectionFactory factory)
{
    public async Task<AuthenticatedUser?> AuthenticateAsync(
        string email,
        string password,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo,
                   r.nombre_rol, u.is_activo, u.created_at, u.contrasena_hash
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.id_rol
            WHERE u.correo = $1 AND u.is_activo = TRUE
            """;

        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue(email);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var hash = reader.GetString(8);
        if (!BCrypt.Net.BCrypt.Verify(password, hash))
        {
            return null;
        }

        var user = ReadUser(reader);
        var claims = new[]
        {
            new Claim("user_id", user.IdUsuario.ToString()),
            new Claim("user_name", $"{user.Nombre} {user.Apellido}"),
            new Claim("user_email", user.Correo),
            new Claim("user_role", user.NombreRol),
            new Claim(ClaimTypes.NameIdentifier, user.IdUsuario.ToString()),
            new Claim(ClaimTypes.Role, user.NombreRol)
        };

        return new AuthenticatedUser(
            user,
            new ClaimsPrincipal(new ClaimsIdentity(claims, "ProyectoGradoCookie")),
            new AuthenticationProperties { IsPersistent = true });
    }

    public async Task<RegistrationResult> RegisterAsync(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        if (!PasswordPolicy.IsValid(request.Password))
        {
            return new RegistrationResult(false, null, PasswordPolicy.ErrorMessage);
        }

        const string sql = """
            INSERT INTO usuarios
                (documento, nombre, apellido, correo, contrasena_hash, id_rol, is_activo)
            VALUES ($1, $2, $3, $4, $5, 4, TRUE)
            RETURNING id_usuario
            """;

        try
        {
            await using var connection = await factory.OpenConnectionAsync(cancellationToken);
            await using var command = new NpgsqlCommand(sql, connection);
            command.Parameters.AddWithValue(request.Documento);
            command.Parameters.AddWithValue(request.Nombre);
            command.Parameters.AddWithValue(request.Apellido);
            command.Parameters.AddWithValue(request.Email);
            command.Parameters.AddWithValue(BCrypt.Net.BCrypt.HashPassword(request.Password));
            var id = (int)(await command.ExecuteScalarAsync(cancellationToken)
                ?? throw new InvalidOperationException("No se obtuvo el identificador del usuario."));
            return new RegistrationResult(true, id, null);
        }
        catch (PostgresException exception) when (exception.SqlState == "23505")
        {
            return new RegistrationResult(false, null, "El email o documento ya está registrado.");
        }
    }

    public async Task<PasswordChangeResult> ChangePasswordAsync(
        int id,
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        if (!PasswordPolicy.IsValid(request.NewPassword))
        {
            return PasswordChangeResult.InvalidNewPassword;
        }

        const string selectSql = "SELECT contrasena_hash FROM usuarios WHERE id_usuario = $1";
        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var select = new NpgsqlCommand(selectSql, connection);
        select.Parameters.AddWithValue(id);
        var currentHash = (string?)await select.ExecuteScalarAsync(cancellationToken);

        if (currentHash is null)
        {
            return PasswordChangeResult.Unauthenticated;
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, currentHash))
        {
            return PasswordChangeResult.InvalidCurrentPassword;
        }

        const string updateSql = "UPDATE usuarios SET contrasena_hash = $1 WHERE id_usuario = $2";
        await using var update = new NpgsqlCommand(updateSql, connection);
        update.Parameters.AddWithValue(BCrypt.Net.BCrypt.HashPassword(request.NewPassword));
        update.Parameters.AddWithValue(id);
        await update.ExecuteNonQueryAsync(cancellationToken);
        return PasswordChangeResult.Updated;
    }

    public async Task<UsuarioDetail?> GetProfileAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo,
                   r.nombre_rol, u.is_activo, u.created_at
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.id_rol
            WHERE u.id_usuario = $1
            """;

        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue(id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return ReadUser(reader);
    }

    private static UsuarioDetail ReadUser(NpgsqlDataReader reader)
    {
        return new UsuarioDetail(
            reader.GetInt32(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetBoolean(6),
            reader.IsDBNull(7) ? null : reader.GetFieldValue<DateTime>(7));
    }
}
