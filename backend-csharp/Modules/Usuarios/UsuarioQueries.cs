using ProyectoGrado.Api.Data;

namespace ProyectoGrado.Api.Modules.Usuarios;

public sealed class UsuarioQueries(PostgresConnectionFactory factory)
{
    public async Task<IReadOnlyList<UsuarioListItem>> ListAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo,
                   r.nombre_rol, u.is_activo
            FROM usuarios u
            JOIN roles r ON r.id_rol = u.id_rol
            ORDER BY u.id_usuario
            """;

        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var result = new List<UsuarioListItem>();

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new UsuarioListItem(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetString(5),
                reader.GetBoolean(6)));
        }

        return result;
    }

    public async Task<int> CreateAsync(CreateUsuarioRequest request, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO usuarios
                (documento, nombre, apellido, correo, contrasena_hash, id_rol, is_activo)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id_usuario
            """;
        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue(request.Documento);
        command.Parameters.AddWithValue(request.Nombre);
        command.Parameters.AddWithValue(request.Apellido);
        command.Parameters.AddWithValue(request.Correo);
        command.Parameters.AddWithValue(BCrypt.Net.BCrypt.HashPassword(request.Password));
        command.Parameters.AddWithValue(request.IdRol);
        command.Parameters.AddWithValue(true);
        return (int)(await command.ExecuteScalarAsync(cancellationToken)
            ?? throw new InvalidOperationException("No se obtuvo el identificador del usuario."));
    }

    public async Task<bool> UpdateAsync(int id, UpdateUsuarioRequest request, CancellationToken cancellationToken)
    {
        const string sql = """
            UPDATE usuarios
            SET documento = $1, nombre = $2, apellido = $3, correo = $4,
                id_rol = $5, is_activo = $6,
                contrasena_hash = COALESCE($7, contrasena_hash)
            WHERE id_usuario = $8
            """;
        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue(request.Documento);
        command.Parameters.AddWithValue(request.Nombre);
        command.Parameters.AddWithValue(request.Apellido);
        command.Parameters.AddWithValue(request.Correo);
        command.Parameters.AddWithValue(request.IdRol);
        command.Parameters.AddWithValue(request.IsActivo);
        command.Parameters.AddWithValue(request.Password is null
            ? DBNull.Value
            : BCrypt.Net.BCrypt.HashPassword(request.Password));
        command.Parameters.AddWithValue(id);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken cancellationToken)
    {
        const string sql = "DELETE FROM usuarios WHERE id_usuario = $1";
        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    public async Task<UsuarioDetail?> GetAsync(int id, CancellationToken cancellationToken)
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

    public async Task<IReadOnlyList<RolItem>> ListRolesAsync(CancellationToken cancellationToken)
    {
        const string sql = "SELECT id_rol, nombre_rol, descripcion FROM roles ORDER BY id_rol";
        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new Npgsql.NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var result = new List<RolItem>();

        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(new RolItem(
                reader.GetInt32(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2)));
        }

        return result;
    }
}
