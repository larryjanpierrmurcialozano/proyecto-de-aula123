using System.Globalization;
using Npgsql;
using ProyectoGrado.Api.Data;

namespace ProyectoGrado.Api.Modules.Horarios;

public sealed class HorarioQueries(PostgresConnectionFactory factory)
{
    private static readonly string[] Weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListAsync(
        int? groupId, int? gradeId, int? teacherId, CancellationToken ct) => QueryAsync("""
        SELECT h.id_horario, h.id_asignacion, h.id_grupo, h.dia_semana,
               TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
               TO_CHAR(h.hora_fin, 'HH24:MI') AS hora_fin,
               h.numero_bloque, h.aula, h.observaciones,
               g.codigo_grupo, gr.id_grado, gr.nombre_grado,
               m.id_materia, m.nombre_materia,
               u.id_usuario, u.nombre AS docente_nombre, u.apellido AS docente_apellido
        FROM horarios h
        JOIN grupos g ON h.id_grupo = g.id_grupo
        JOIN grados gr ON g.id_grado = gr.id_grado
        JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
        JOIN materias m ON a.id_materia = m.id_materia
        JOIN usuarios u ON a.id_usuario = u.id_usuario
        WHERE ($1::integer IS NULL OR h.id_grupo = $1)
          AND ($2::integer IS NULL OR gr.id_grado = $2)
          AND ($3::integer IS NULL OR u.id_usuario = $3)
        ORDER BY CASE h.dia_semana
            WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3
            WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 ELSE 6 END, h.hora_inicio
        """, ct, groupId, gradeId, teacherId);

    public async Task<Dictionary<string, object?>?> GetAsync(int id, CancellationToken ct) =>
        await QuerySingleAsync("""
            SELECT h.*, TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
                   TO_CHAR(h.hora_fin, 'HH24:MI') AS hora_fin,
                   g.codigo_grupo, m.nombre_materia,
                   u.nombre AS docente_nombre, u.apellido AS docente_apellido
            FROM horarios h
            JOIN grupos g ON h.id_grupo = g.id_grupo
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m ON a.id_materia = m.id_materia
            JOIN usuarios u ON a.id_usuario = u.id_usuario
            WHERE h.id_horario = $1
            """, ct, id);

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListGroupAssignmentsAsync(
        int groupId, CancellationToken ct) => QueryAsync("""
        SELECT a.id_asignacion, a.id_materia, m.nombre_materia,
               a.id_usuario, u.nombre AS docente_nombre, u.apellido AS docente_apellido
        FROM asignaciones_docente a
        JOIN materias m ON a.id_materia = m.id_materia
        JOIN usuarios u ON a.id_usuario = u.id_usuario
        WHERE a.id_grupo = $1 AND a.estado = 'Activa'
        ORDER BY m.nombre_materia
        """, ct, groupId);

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListGradeAssignmentsAsync(
        int gradeId, CancellationToken ct) => QueryAsync("""
        SELECT DISTINCT a.id_asignacion, a.id_materia, m.nombre_materia,
               a.id_usuario, u.nombre AS docente_nombre, u.apellido AS docente_apellido
        FROM asignaciones_docente a
        JOIN materias m ON a.id_materia = m.id_materia
        JOIN usuarios u ON a.id_usuario = u.id_usuario
        WHERE a.id_grado = $1 AND a.estado = 'Activa'
        ORDER BY u.apellido, m.nombre_materia
        """, ct, gradeId);

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListLevelsAsync(CancellationToken ct) =>
        QueryAsync("SELECT * FROM niveles ORDER BY id_nivel", ct);

    public async Task<(int? Id, string? Error, int Status)> CreateAsync(
        HorarioRequest request, int? userId, string? ip, string? userAgent, CancellationToken ct)
    {
        if (request.IdAsignacion is null or <= 0 || request.IdGrupo is null or <= 0 ||
            string.IsNullOrWhiteSpace(request.DiaSemana) ||
            string.IsNullOrWhiteSpace(request.HoraInicio) || string.IsNullOrWhiteSpace(request.HoraFin))
            return (null, "Faltan campos requeridos para crear el horario", 400);
        if (!Weekdays.Contains(request.DiaSemana, StringComparer.Ordinal))
            return (null, "Día de semana inválido", 400);
        if (!TryParseTime(request.HoraInicio, out var start) || !TryParseTime(request.HoraFin, out var end) || start >= end)
            return (null, "Rango de horas inválido", 400);

        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        var assignment = await QuerySingleAsync(connection, transaction, """
            SELECT id_asignacion, id_usuario FROM asignaciones_docente
            WHERE id_asignacion = $1 AND estado = 'Activa'
            """, ct, request.IdAsignacion.Value);
        if (assignment is null)
            return (null, "Asignación no encontrada o inactiva", 404);
        if (!await ExistsAsync(connection, transaction,
                "SELECT 1 FROM grupos WHERE id_grupo = $1", ct, request.IdGrupo.Value))
            return (null, "Grupo no encontrado", 404);

        var groupConflict = await QuerySingleAsync(connection, transaction, """
            SELECT m.nombre_materia
            FROM horarios h
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m ON a.id_materia = m.id_materia
            WHERE h.id_grupo = $1 AND h.dia_semana = $2
              AND h.hora_inicio < $3 AND h.hora_fin > $4
            LIMIT 1
            """, ct, request.IdGrupo.Value, request.DiaSemana, end, start);
        if (groupConflict is not null)
            return (null, $"Choque de horario: ya existe \"{groupConflict["nombre_materia"]}\" en ese rango de horas", 400);

        var teacherConflict = await QuerySingleAsync(connection, transaction, """
            SELECT g.codigo_grupo, m.nombre_materia
            FROM horarios h
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m ON a.id_materia = m.id_materia
            JOIN grupos g ON h.id_grupo = g.id_grupo
            WHERE a.id_usuario = $1 AND h.dia_semana = $2
              AND h.hora_inicio < $3 AND h.hora_fin > $4
            LIMIT 1
            """, ct, Convert.ToInt32(assignment["id_usuario"]), request.DiaSemana, end, start);
        if (teacherConflict is not null)
            return (null,
                $"El docente ya tiene clase de \"{teacherConflict["nombre_materia"]}\" en {teacherConflict["codigo_grupo"]} a esa hora", 400);

        int id;
        await using (var command = new NpgsqlCommand("""
            INSERT INTO horarios (id_asignacion, id_grupo, dia_semana, hora_inicio, hora_fin, aula, observaciones)
            VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_horario
            """, connection, transaction))
        {
            command.Parameters.AddWithValue(request.IdAsignacion.Value);
            command.Parameters.AddWithValue(request.IdGrupo.Value);
            command.Parameters.AddWithValue(request.DiaSemana);
            command.Parameters.AddWithValue(start);
            command.Parameters.AddWithValue(end);
            command.Parameters.AddWithValue(request.Aula ?? string.Empty);
            command.Parameters.AddWithValue(request.Observaciones ?? string.Empty);
            id = Convert.ToInt32(await command.ExecuteScalarAsync(ct));
        }
        await transaction.CommitAsync(ct);
        await TryLogAsync(userId, "CREATE",
            $"Horario creado (grupo={request.IdGrupo}, dia={request.DiaSemana}, {request.HoraInicio}-{request.HoraFin})",
            id, ip, userAgent, ct);
        return (id, null, 201);
    }

    public async Task<(bool Found, string? Error)> UpdateAsync(
        int id, HorarioRequest request, int? userId, string? ip, string? userAgent, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        var existing = await QuerySingleAsync(connection, transaction,
            "SELECT *, TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio_text, TO_CHAR(hora_fin, 'HH24:MI') AS hora_fin_text FROM horarios WHERE id_horario = $1",
            ct, id);
        if (existing is null) return (false, null);

        var groupId = request.IdGrupo ?? Convert.ToInt32(existing["id_grupo"]);
        var assignmentId = request.IdAsignacion ?? Convert.ToInt32(existing["id_asignacion"]);
        var day = request.DiaSemana ?? existing["dia_semana"]?.ToString() ?? string.Empty;
        var startText = request.HoraInicio ?? existing["hora_inicio_text"]?.ToString() ?? string.Empty;
        var endText = request.HoraFin ?? existing["hora_fin_text"]?.ToString() ?? string.Empty;
        if (!TryParseTime(startText, out var start) || !TryParseTime(endText, out var end) || start >= end)
            return (true, "Rango de horas inválido");

        var conflict = await QuerySingleAsync(connection, transaction, """
            SELECT m.nombre_materia
            FROM horarios h
            JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
            JOIN materias m ON a.id_materia = m.id_materia
            WHERE h.id_grupo = $1 AND h.dia_semana = $2
              AND h.hora_inicio < $3 AND h.hora_fin > $4 AND h.id_horario <> $5
            LIMIT 1
            """, ct, groupId, day, end, start, id);
        if (conflict is not null)
            return (true, $"Choque: ya existe \"{conflict["nombre_materia"]}\" en ese rango");

        await using (var command = new NpgsqlCommand("""
            UPDATE horarios SET id_asignacion = $1, id_grupo = $2, dia_semana = $3,
                hora_inicio = $4, hora_fin = $5, aula = $6, observaciones = $7
            WHERE id_horario = $8
            """, connection, transaction))
        {
            command.Parameters.AddWithValue(assignmentId);
            command.Parameters.AddWithValue(groupId);
            command.Parameters.AddWithValue(day);
            command.Parameters.AddWithValue(start);
            command.Parameters.AddWithValue(end);
            command.Parameters.AddWithValue(request.Aula ?? existing["aula"]?.ToString() ?? string.Empty);
            command.Parameters.AddWithValue(request.Observaciones ?? existing["observaciones"]?.ToString() ?? string.Empty);
            command.Parameters.AddWithValue(id);
            await command.ExecuteNonQueryAsync(ct);
        }
        await transaction.CommitAsync(ct);
        await TryLogAsync(userId, "UPDATE",
            $"Horario actualizado (grupo={groupId}, dia={day}, {startText}-{endText})", id, ip, userAgent, ct);
        return (true, null);
    }

    public async Task<bool> DeleteAsync(
        int id, int? userId, string? ip, string? userAgent, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("DELETE FROM horarios WHERE id_horario = $1", connection);
        command.Parameters.AddWithValue(id);
        var deleted = await command.ExecuteNonQueryAsync(ct) > 0;
        if (deleted)
            await TryLogAsync(userId, "DELETE", "Horario eliminado", id, ip, userAgent, ct);
        return deleted;
    }

    private async Task TryLogAsync(
        int? userId, string action, string description, int id, string? ip, string? userAgent, CancellationToken ct)
    {
        if (userId is null) return;
        try
        {
            await using var connection = await factory.OpenConnectionAsync(ct);
            await using var command = new NpgsqlCommand("""
                INSERT INTO log_registro
                    (id_usuario, tipo_accion, descripcion, tabla_afectada, registro_id, ip_address, user_agent)
                VALUES ($1, $2, $3, 'horarios', $4, $5, $6)
                """, connection);
            command.Parameters.AddWithValue(userId.Value);
            command.Parameters.AddWithValue(action);
            command.Parameters.AddWithValue(description);
            command.Parameters.AddWithValue(id);
            command.Parameters.AddWithValue((object?)ip ?? DBNull.Value);
            command.Parameters.AddWithValue((object?)userAgent ?? DBNull.Value);
            await command.ExecuteNonQueryAsync(ct);
        }
        catch (Exception)
        {
            // El registro de actividad es auxiliar y no debe revertir la operación principal.
        }
    }

    private async Task<IReadOnlyList<Dictionary<string, object?>>> QueryAsync(
        string sql, CancellationToken ct, params object?[] parameters)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        return await QueryAsync(connection, null, sql, ct, parameters);
    }

    private async Task<IReadOnlyList<Dictionary<string, object?>>> QueryAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, string sql,
        CancellationToken ct, params object?[] parameters)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        AddParameters(command, parameters);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(ct)) rows.Add(ReadRow(reader));
        return rows;
    }

    private async Task<Dictionary<string, object?>?> QuerySingleAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, string sql,
        CancellationToken ct, params object?[] parameters) =>
        (await QueryAsync(connection, transaction, sql, ct, parameters)).FirstOrDefault();

    private async Task<Dictionary<string, object?>?> QuerySingleAsync(
        string sql, CancellationToken ct, params object?[] parameters)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        return (await QueryAsync(connection, null, sql, ct, parameters)).FirstOrDefault();
    }

    private static async Task<bool> ExistsAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, string sql,
        CancellationToken ct, params object?[] parameters)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        AddParameters(command, parameters);
        return await command.ExecuteScalarAsync(ct) is not null;
    }

    private static void AddParameters(NpgsqlCommand command, object?[] parameters)
    {
        foreach (var parameter in parameters)
            command.Parameters.AddWithValue(parameter ?? DBNull.Value);
    }

    private static Dictionary<string, object?> ReadRow(NpgsqlDataReader reader)
    {
        var row = new Dictionary<string, object?>(StringComparer.Ordinal);
        for (var index = 0; index < reader.FieldCount; index++)
            row[reader.GetName(index)] = reader.IsDBNull(index) ? null : reader.GetValue(index);
        return row;
    }

    private static bool TryParseTime(string value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value, ["HH:mm", "HH:mm:ss"], CultureInfo.InvariantCulture,
            DateTimeStyles.None, out time);
}
