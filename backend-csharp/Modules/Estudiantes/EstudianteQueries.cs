using Npgsql;
using NpgsqlTypes;
using ProyectoGrado.Api.Data;

namespace ProyectoGrado.Api.Modules.Estudiantes;

public sealed class EstudianteQueries(PostgresConnectionFactory factory)
{
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListAsync(CancellationToken ct) => QueryAsync("""
        SELECT e.*, g.codigo_grupo, gr.nombre_grado
        FROM estudiantes e
        JOIN grupos g ON e.id_grupo = g.id_grupo
        JOIN grados gr ON g.id_grado = gr.id_grado
        ORDER BY gr.id_grado, g.codigo_grupo, e.apellido
        """, ct);

    public Task<Dictionary<string, object?>?> GetAsync(int id, CancellationToken ct) => QuerySingleAsync("""
        SELECT e.*, g.codigo_grupo, gr.nombre_grado
        FROM estudiantes e
        JOIN grupos g ON e.id_grupo = g.id_grupo
        JOIN grados gr ON g.id_grado = gr.id_grado
        WHERE e.id_estudiante = $1
        """, ct, id);

    public async Task<int> CreateAsync(EstudianteRequest request, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            INSERT INTO estudiantes (
                documento, nombre, apellido, fecha_nacimiento, genero, id_grupo,
                acudiente_nombre, acudiente_telefono, correo, direccion, estado)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Activo')
            RETURNING id_estudiante
            """, connection);
        command.Parameters.AddWithValue(request.Documento);
        command.Parameters.AddWithValue(request.Nombre);
        command.Parameters.AddWithValue(request.Apellido);
        AddNullableDate(command, request.FechaNacimiento);
        command.Parameters.AddWithValue(request.Genero);
        command.Parameters.AddWithValue(request.IdGrupo);
        AddNullableText(command, request.AcudienteNombre);
        AddNullableText(command, request.AcudienteTelefono);
        AddNullableText(command, request.Correo);
        AddNullableText(command, request.Direccion);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    public async Task UpdateAsync(int id, EstudianteRequest request, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            UPDATE estudiantes
            SET documento = $1, nombre = $2, apellido = $3, fecha_nacimiento = $4, genero = $5,
                id_grupo = $6, acudiente_nombre = $7, acudiente_telefono = $8, correo = $9,
                direccion = $10, estado = $11
            WHERE id_estudiante = $12
            """, connection);
        command.Parameters.AddWithValue(request.Documento);
        command.Parameters.AddWithValue(request.Nombre);
        command.Parameters.AddWithValue(request.Apellido);
        AddNullableDate(command, request.FechaNacimiento);
        command.Parameters.AddWithValue(request.Genero);
        command.Parameters.AddWithValue(request.IdGrupo);
        AddNullableText(command, request.AcudienteNombre);
        AddNullableText(command, request.AcudienteTelefono);
        AddNullableText(command, request.Correo);
        AddNullableText(command, request.Direccion);
        command.Parameters.AddWithValue(request.Estado);
        command.Parameters.AddWithValue(id);
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> DeleteAsync(
        int id, string? userId, string? ip, string? userAgent, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);

        await SetLocalAsync(connection, transaction, "app.user_id", userId ?? string.Empty, ct);
        await SetLocalAsync(connection, transaction, "app.ip", ip ?? string.Empty, ct);
        await SetLocalAsync(connection, transaction, "app.agent", userAgent ?? string.Empty, ct);

        await using (var countsCommand = new NpgsqlCommand("""
            SELECT json_build_object(
                'detalle_asistencia', (SELECT COUNT(*) FROM detalle_asistencia WHERE id_estudiante = $1),
                'asistencia', (SELECT COUNT(*) FROM asistencia WHERE id_estudiante = $1),
                'asistencias_por_periodo', (SELECT COUNT(*) FROM asistencias_por_periodo WHERE id_estudiante = $1),
                'justificantes_ausencia', (SELECT COUNT(*) FROM justificantes_ausencia WHERE id_estudiante = $1),
                'reportes_inasistencias', (SELECT COUNT(*) FROM reportes_inasistencias WHERE id_estudiante = $1),
                'observador', (SELECT COUNT(*) FROM observador WHERE id_estudiante = $1),
                'notas', (SELECT COUNT(*) FROM notas WHERE id_estudiante = $1)
            )::text
            """, connection, transaction))
        {
            countsCommand.Parameters.AddWithValue(id);
            var counts = (string?)await countsCommand.ExecuteScalarAsync(ct) ?? "{}";
            await SetLocalAsync(connection, transaction, "app.student_delete_counts", counts, ct);
        }

        var dependentTables = new[]
        {
            "detalle_asistencia", "asistencia", "asistencias_por_periodo",
            "justificantes_ausencia", "reportes_inasistencias", "observador", "notas"
        };
        foreach (var table in dependentTables)
        {
            await using var deleteDependent = new NpgsqlCommand(
                $"DELETE FROM {table} WHERE id_estudiante = $1", connection, transaction);
            deleteDependent.Parameters.AddWithValue(id);
            await deleteDependent.ExecuteNonQueryAsync(ct);
        }

        await using var deleteStudent = new NpgsqlCommand(
            "DELETE FROM estudiantes WHERE id_estudiante = $1", connection, transaction);
        deleteStudent.Parameters.AddWithValue(id);
        var deleted = await deleteStudent.ExecuteNonQueryAsync(ct) > 0;
        if (!deleted)
        {
            await transaction.RollbackAsync(ct);
            return false;
        }

        await transaction.CommitAsync(ct);
        return true;
    }

    private async Task<IReadOnlyList<Dictionary<string, object?>>> QueryAsync(
        string sql, CancellationToken ct, params object?[] parameters)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var parameter in parameters)
            command.Parameters.AddWithValue(parameter ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(ct)) rows.Add(ReadRow(reader));
        return rows;
    }

    private async Task<Dictionary<string, object?>?> QuerySingleAsync(
        string sql, CancellationToken ct, params object?[] parameters)
    {
        var rows = await QueryAsync(sql, ct, parameters);
        return rows.FirstOrDefault();
    }

    private static async Task SetLocalAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction,
        string setting, string value, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand("SELECT set_config($1, $2, true)", connection, transaction);
        command.Parameters.AddWithValue(setting);
        command.Parameters.AddWithValue(value);
        await command.ExecuteScalarAsync(ct);
    }

    private static void AddNullableDate(NpgsqlCommand command, DateOnly? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Date,
            Value = value is null ? DBNull.Value : value.Value
        });

    private static void AddNullableText(NpgsqlCommand command, string? value) =>
        command.Parameters.Add(new NpgsqlParameter
        {
            NpgsqlDbType = NpgsqlDbType.Text,
            Value = value is null ? DBNull.Value : value
        });

    private static Dictionary<string, object?> ReadRow(NpgsqlDataReader reader)
    {
        var row = new Dictionary<string, object?>(StringComparer.Ordinal);
        for (var i = 0; i < reader.FieldCount; i++)
            row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        return row;
    }
}
