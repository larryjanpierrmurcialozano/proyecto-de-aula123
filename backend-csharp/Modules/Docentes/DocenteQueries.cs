using Npgsql;
using ProyectoGrado.Api.Data;

namespace ProyectoGrado.Api.Modules.Docentes;

public sealed class DocenteQueries(PostgresConnectionFactory factory)
{
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListAsync(CancellationToken ct) => QueryAsync("""
        SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo, u.is_activo,
               COUNT(DISTINCT a.id_asignacion) AS total_asignaciones,
               COUNT(DISTINCT a.id_grado) AS total_grados,
               STRING_AGG(DISTINCT m.nombre_materia, ', ' ORDER BY m.nombre_materia) AS materias,
               STRING_AGG(DISTINCT g.nombre_grado, ', ' ORDER BY g.nombre_grado) AS grados
        FROM usuarios u
        JOIN roles r ON r.id_rol = u.id_rol
        LEFT JOIN asignaciones_docente a ON u.id_usuario = a.id_usuario AND a.estado = 'Activa'
        LEFT JOIN materias m ON a.id_materia = m.id_materia
        LEFT JOIN grados g ON a.id_grado = g.id_grado
        WHERE LOWER(r.nombre_rol) IN ('profesor', 'docente')
        GROUP BY u.id_usuario
        ORDER BY u.apellido, u.nombre
        """, ct);

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListAvailableAsync(CancellationToken ct) => QueryAsync("""
        SELECT u.id_usuario, u.documento, u.nombre, u.apellido, u.correo, u.is_activo
        FROM usuarios u
        JOIN roles r ON r.id_rol = u.id_rol
        WHERE LOWER(r.nombre_rol) IN ('profesor', 'docente') AND u.is_activo = TRUE
        ORDER BY u.apellido, u.nombre
        """, ct);

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListAssignmentsAsync(int userId, CancellationToken ct) => QueryAsync("""
        SELECT a.*, m.nombre_materia, g.nombre_grado, gr.codigo_grupo
        FROM asignaciones_docente a
        JOIN materias m ON a.id_materia = m.id_materia
        JOIN grados g ON a.id_grado = g.id_grado
        JOIN grupos gr ON a.id_grupo = gr.id_grupo
        WHERE a.id_usuario = $1 AND a.estado = 'Activa'
        """, ct, userId);

    public async Task<(IReadOnlyList<Dictionary<string, object?>> Grados,
        IReadOnlyList<Dictionary<string, object?>> Grupos)> ListGradesAndGroupsAsync(
        int userId, CancellationToken ct)
    {
        var grados = await QueryAsync("""
            SELECT g.id_grado, g.nombre_grado, g.numero_grado
            FROM grados g
            WHERE g.id_grado IN (
                SELECT DISTINCT a.id_grado FROM asignaciones_docente a
                WHERE a.id_usuario = $1 AND a.estado = 'Activa'
            )
            ORDER BY g.numero_grado
            """, ct, userId);

        var grupos = await QueryAsync("""
            SELECT gr.id_grupo, gr.codigo_grupo, gr.id_grado,
                   g.nombre_grado, g.numero_grado
            FROM grupos gr
            JOIN grados g ON gr.id_grado = g.id_grado
            WHERE gr.id_grupo IN (
                SELECT DISTINCT a.id_grupo FROM asignaciones_docente a
                WHERE a.id_usuario = $1 AND a.estado = 'Activa'
            )
            ORDER BY g.numero_grado, gr.codigo_grupo
            """, ct, userId);

        return (grados, grupos);
    }

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListMySubjectsAsync(
        int userId, CancellationToken ct) => QueryAsync("""
        SELECT DISTINCT m.id_materia, m.nombre_materia, m.codigo_materia, m.intensidad_horaria,
               STRING_AGG(DISTINCT gr.nombre_grado, ', ' ORDER BY gr.nombre_grado) AS grados
        FROM asignaciones_docente a
        JOIN materias m ON a.id_materia = m.id_materia
        JOIN grados gr ON a.id_grado = gr.id_grado
        WHERE a.id_usuario = $1 AND a.estado = 'Activa'
        GROUP BY m.id_materia
        ORDER BY m.nombre_materia
        """, ct, userId);

    public Task<IReadOnlyList<Dictionary<string, object?>>> ListMyScheduleAsync(
        int userId, CancellationToken ct) => QueryAsync("""
        SELECT h.*, g.codigo_grupo, m.id_materia, m.nombre_materia, gr.nombre_grado,
               TO_CHAR(h.hora_inicio, 'HH24:MI') AS hora_inicio,
               TO_CHAR(h.hora_fin, 'HH24:MI') AS hora_fin
        FROM horarios h
        JOIN grupos g ON h.id_grupo = g.id_grupo
        JOIN grados gr ON g.id_grado = gr.id_grado
        JOIN asignaciones_docente a ON h.id_asignacion = a.id_asignacion
        JOIN materias m ON a.id_materia = m.id_materia
        WHERE a.id_usuario = $1
        ORDER BY CASE h.dia_semana
            WHEN 'Lunes' THEN 1 WHEN 'Martes' THEN 2 WHEN 'Miércoles' THEN 3
            WHEN 'Jueves' THEN 4 WHEN 'Viernes' THEN 5 ELSE 6 END, h.hora_inicio
        """, ct, userId);

    private async Task<IReadOnlyList<Dictionary<string, object?>>> QueryAsync(
        string sql, CancellationToken ct, params object?[] parameters)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        foreach (var parameter in parameters)
            command.Parameters.AddWithValue(parameter ?? DBNull.Value);

        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object?>(StringComparer.Ordinal);
            for (var index = 0; index < reader.FieldCount; index++)
                row[reader.GetName(index)] = reader.IsDBNull(index) ? null : reader.GetValue(index);
            rows.Add(row);
        }
        return rows;
    }
}
