// BACKEND MODULE: Academico
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using Npgsql;
using ProyectoGrado.Api.Data;

namespace ProyectoGrado.Api.Modules.Academico;

public sealed class AcademicoQueries(PostgresConnectionFactory factory)
{
    // Lista grados con su nivel y los totales de grupos y estudiantes activos.
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListGradosAsync(CancellationToken ct) =>
        QueryAsync("""
            SELECT g.id_grado, g.nombre_grado, g.numero_grado, n.nombre_nivel AS nivel,
                   COUNT(DISTINCT gr.id_grupo) AS total_grupos,
                   COUNT(DISTINCT e.id_estudiante) AS total_estudiantes
            FROM grados g
            LEFT JOIN niveles n ON g.id_nivel = n.id_nivel
            LEFT JOIN grupos gr ON g.id_grado = gr.id_grado
            LEFT JOIN estudiantes e ON gr.id_grupo = e.id_grupo AND e.estado = 'Activo'
            GROUP BY g.id_grado, n.nombre_nivel
            ORDER BY g.numero_grado
            """, ct);

    // Inserta un grado y devuelve el ID generado por PostgreSQL.
    public async Task<int> CreateGradoAsync(GradoCreateRequest request, CancellationToken ct)
    {
        const string sql = """
            INSERT INTO grados (numero_grado, id_nivel, nombre_grado)
            VALUES ($1, $2, $3)
            RETURNING id_grado
            """;
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue(request.NumeroGrado ?? request.Orden ?? 0);
        command.Parameters.AddWithValue((object?)request.IdNivel ?? DBNull.Value);
        command.Parameters.AddWithValue((object?)request.NombreGrado ?? DBNull.Value);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    // Obtiene un grado junto con el nombre de su nivel educativo.
    public async Task<Dictionary<string, object?>?> GetGradoAsync(int id, CancellationToken ct) =>
        await QuerySingleAsync("""
            SELECT g.*, n.nombre_nivel AS nivel
            FROM grados g
            LEFT JOIN niveles n ON g.id_nivel = n.id_nivel
            WHERE g.id_grado = $1
            """, ct, id);

    // Actualiza numero, nivel y nombre del grado indicado.
    public async Task UpdateGradoAsync(int id, GradoCreateRequest request, CancellationToken ct)
    {
        const string sql = """
            UPDATE grados SET numero_grado = $1, id_nivel = $2, nombre_grado = $3
            WHERE id_grado = $4
            """;
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        command.Parameters.AddWithValue(request.NumeroGrado ?? request.Orden ?? 0);
        command.Parameters.AddWithValue((object?)request.IdNivel ?? DBNull.Value);
        command.Parameters.AddWithValue((object?)request.NombreGrado ?? DBNull.Value);
        command.Parameters.AddWithValue(id);
        await command.ExecuteNonQueryAsync(ct);
    }

    // Cuenta las relaciones que impedirian eliminar el grado de forma segura.
    public async Task<(int Groups, int Assignments)> CountGradeDependenciesAsync(int id, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            SELECT (SELECT COUNT(*) FROM grupos WHERE id_grado = $1),
                   (SELECT COUNT(*) FROM asignaciones_docente WHERE id_grado = $1)
            """, connection);
        command.Parameters.AddWithValue(id);
        await using var reader = await command.ExecuteReaderAsync(ct);
        await reader.ReadAsync(ct);
        return (Convert.ToInt32(reader.GetValue(0)), Convert.ToInt32(reader.GetValue(1)));
    }

    // Elimina el grado; el endpoint debe comprobar antes sus dependencias.
    public async Task<bool> DeleteGradoAsync(int id, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("DELETE FROM grados WHERE id_grado = $1", connection);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteNonQueryAsync(ct) > 0;
    }

    // Lista los grupos pertenecientes a un grado especifico.
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListGruposByGradoAsync(int gradoId, CancellationToken ct) =>
        QueryAsync("""
            SELECT id_grupo, codigo_grupo, capacidad_maxima
            FROM grupos WHERE id_grado = $1 ORDER BY codigo_grupo
            """, ct, gradoId);

    // Lista todos los grupos con su grado y cantidad de estudiantes activos.
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListGruposAsync(CancellationToken ct) =>
        QueryAsync("""
            SELECT g.id_grupo, g.codigo_grupo, g.capacidad_maxima, gr.nombre_grado, gr.id_grado,
                   COUNT(e.id_estudiante) AS total_estudiantes
            FROM grupos g
            JOIN grados gr ON g.id_grado = gr.id_grado
            LEFT JOIN estudiantes e ON g.id_grupo = e.id_grupo AND e.estado = 'Activo'
            GROUP BY g.id_grupo, gr.id_grado, gr.nombre_grado, gr.numero_grado
            ORDER BY gr.numero_grado, g.codigo_grupo
            """, ct);

    // Inserta un grupo y devuelve el ID generado.
    public async Task<int> CreateGrupoAsync(GrupoRequest request, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            INSERT INTO grupos (codigo_grupo, id_grado, capacidad_maxima)
            VALUES ($1, $2, $3) RETURNING id_grupo
            """, connection);
        command.Parameters.AddWithValue(request.CodigoGrupo);
        command.Parameters.AddWithValue(request.IdGrado);
        command.Parameters.AddWithValue(request.CapacidadMaxima);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    // Obtiene un grupo con su grado y el total de estudiantes activos.
    public async Task<Dictionary<string, object?>?> GetGrupoAsync(int id, CancellationToken ct) =>
        await QuerySingleAsync("""
            SELECT g.id_grupo, g.codigo_grupo, g.capacidad_maxima, gr.id_grado, gr.nombre_grado,
                   (SELECT COUNT(*) FROM estudiantes e WHERE e.id_grupo = g.id_grupo AND e.estado = 'Activo') AS total_estudiantes
            FROM grupos g JOIN grados gr ON g.id_grado = gr.id_grado
            WHERE g.id_grupo = $1
            """, ct, id);

    // Actualiza codigo, grado y capacidad del grupo.
    public async Task UpdateGrupoAsync(int id, GrupoRequest request, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            UPDATE grupos SET codigo_grupo = $1, id_grado = $2, capacidad_maxima = $3
            WHERE id_grupo = $4
            """, connection);
        command.Parameters.AddWithValue(request.CodigoGrupo);
        command.Parameters.AddWithValue(request.IdGrado);
        command.Parameters.AddWithValue(request.CapacidadMaxima);
        command.Parameters.AddWithValue(id);
        await command.ExecuteNonQueryAsync(ct);
    }

    // Elimina un grupo; PostgreSQL protege las relaciones que aun existan.
    public async Task<bool> DeleteGrupoAsync(int id, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("DELETE FROM grupos WHERE id_grupo = $1", connection);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteNonQueryAsync(ct) > 0;
    }

    // Lista los estudiantes activos matriculados en un grupo.
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListEstudiantesByGrupoAsync(int grupoId, CancellationToken ct) =>
        QueryAsync("""
            SELECT e.* FROM estudiantes e
            WHERE e.id_grupo = $1 AND e.estado = 'Activo'
            ORDER BY e.apellido, e.nombre
            """, ct, grupoId);

    // Lista materias con docentes activos y grados donde estan asignadas.
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListMateriasAsync(CancellationToken ct) =>
        QueryAsync("""
            SELECT m.*,
                   COUNT(DISTINCT a.id_usuario) AS total_docentes,
                   STRING_AGG(DISTINCT g.id_grado::text, ',' ORDER BY g.id_grado::text) AS grados_ids,
                   STRING_AGG(DISTINCT g.nombre_grado, ', ' ORDER BY g.nombre_grado) AS grados_nombres
            FROM materias m
            LEFT JOIN asignaciones_docente a ON m.id_materia = a.id_materia AND a.estado = 'Activa'
            LEFT JOIN grados g ON a.id_grado = g.id_grado
            WHERE m.codigo_materia != ''
            GROUP BY m.id_materia
            ORDER BY m.nombre_materia
            """, ct);

    // Inserta una materia y devuelve el ID generado.
    public async Task<int> CreateMateriaAsync(MateriaRequest request, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            INSERT INTO materias (nombre_materia, codigo_materia, intensidad_horaria, descripcion)
            VALUES ($1, $2, $3, $4) RETURNING id_materia
            """, connection);
        command.Parameters.AddWithValue(request.NombreMateria);
        command.Parameters.AddWithValue(request.CodigoMateria);
        command.Parameters.AddWithValue(request.IntensidadHoraria);
        command.Parameters.AddWithValue(request.Descripcion);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    // Obtiene una materia y agrega sus docentes asignados activos.
    public async Task<Dictionary<string, object?>?> GetMateriaAsync(int id, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("SELECT * FROM materias WHERE id_materia = $1", connection);
        command.Parameters.AddWithValue(id);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var materia = ReadRow(reader);
        await reader.DisposeAsync();
        var teachers = await QueryAsync("""
            SELECT a.id_asignacion, u.id_usuario, u.nombre, u.apellido, g.nombre_grado,
                   a.estado, a.id_grado, a.id_grupo, gr.codigo_grupo
            FROM asignaciones_docente a
            JOIN usuarios u ON a.id_usuario = u.id_usuario
            JOIN grados g ON a.id_grado = g.id_grado
            JOIN grupos gr ON a.id_grupo = gr.id_grupo
            WHERE a.id_materia = $1 AND a.estado = 'Activa'
            ORDER BY g.numero_grado, gr.codigo_grupo, u.apellido, u.nombre
            """, ct, id);
        materia["docentes"] = teachers;
        return materia;
    }

    // Comprueba si existe una materia antes de actualizarla o eliminarla.
    public async Task<bool> MateriaExistsAsync(int id, CancellationToken ct) =>
        await ScalarIntAsync("SELECT COUNT(*) FROM materias WHERE id_materia = $1", ct, id) > 0;

    // Actualiza nombre, codigo, intensidad horaria y descripcion de la materia.
    public async Task UpdateMateriaAsync(int id, MateriaRequest request, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            UPDATE materias
            SET nombre_materia = $1, codigo_materia = $2, intensidad_horaria = $3, descripcion = $4
            WHERE id_materia = $5
            """, connection);
        command.Parameters.AddWithValue(request.NombreMateria);
        command.Parameters.AddWithValue(request.CodigoMateria);
        command.Parameters.AddWithValue(request.IntensidadHoraria);
        command.Parameters.AddWithValue(request.Descripcion);
        command.Parameters.AddWithValue(id);
        await command.ExecuteNonQueryAsync(ct);
    }

    // Devuelve el motivo que impediria eliminar una materia, o null si puede eliminarse.
    public async Task<string?> GetMateriaDeleteBlockerAsync(int id, CancellationToken ct)
    {
        if (!await MateriaExistsAsync(id, ct)) return "__not_found__";
        if (await ScalarIntAsync("SELECT COUNT(*) FROM asignaciones_docente WHERE id_materia = $1 AND estado = 'Activa'", ct, id) > 0)
            return "No se puede eliminar: la materia tiene asignaciones de docentes activas";
        if (await ScalarIntAsync("SELECT COUNT(*) FROM actividades WHERE id_materia = $1", ct, id) > 0)
            return "No se puede eliminar: existen actividades relacionadas a esta materia. Elimine primero las actividades o las notas asociadas.";
        if (await ScalarIntAsync("SELECT COUNT(*) FROM notas n JOIN actividades a ON n.id_actividad = a.id_actividad WHERE a.id_materia = $1", ct, id) > 0)
            return "No se puede eliminar: existen notas asociadas a actividades de esta materia. Elimine primero esas notas.";
        return null;
    }

    // Elimina definitivamente una materia sin asignaciones, actividades ni notas dependientes.
    public async Task<bool> DeleteMateriaAsync(int id, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("DELETE FROM materias WHERE id_materia = $1", connection);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteNonQueryAsync(ct) > 0;
    }

    // Busca docentes disponibles para una materia y contexto academico concreto.
    public Task<IReadOnlyList<Dictionary<string, object?>>> ListDocentesDisponiblesAsync(
        int materiaId, int? gradoId, int? grupoId, CancellationToken ct) => QueryAsync("""
            SELECT u.id_usuario, CONCAT(u.nombre, ' ', u.apellido) AS nombre_completo, r.nombre_rol
            FROM usuarios u INNER JOIN roles r ON u.id_rol = r.id_rol
            WHERE r.nombre_rol IN ('Profesor', 'profesor', 'Docente', 'docente')
              AND ($2::integer IS NULL OR $3::integer IS NULL OR NOT EXISTS (
                  SELECT 1 FROM asignaciones_docente a
                  WHERE a.id_usuario = u.id_usuario AND a.id_materia = $1
                    AND a.id_grado = $2 AND a.id_grupo = $3 AND a.estado = 'Activa'))
            ORDER BY u.apellido, u.nombre
            """, ct, materiaId, gradoId, grupoId);

    // Valida todas las relaciones y crea una asignacion docente dentro de una transaccion.
    public async Task<(int? Id, string? Error, int Status)> CreateAsignacionAsync(
        AsignacionDocenteRequest request, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        if (!await ExistsAsync(connection, transaction, """
                SELECT 1 FROM usuarios u JOIN roles r ON u.id_rol = r.id_rol
                WHERE u.id_usuario = $1 AND r.nombre_rol IN ('Profesor', 'profesor', 'Docente', 'docente')
                """, ct, request.IdUsuario))
            return (null, "Docente no encontrado o no tiene rol de profesor", 400);
        if (!await ExistsAsync(connection, transaction, "SELECT 1 FROM materias WHERE id_materia = $1", ct, request.IdMateria))
            return (null, "Materia no encontrada", 404);
        if (!await ExistsAsync(connection, transaction, "SELECT 1 FROM grados WHERE id_grado = $1", ct, request.IdGrado))
            return (null, "Grado no encontrado", 404);
        if (!await ExistsAsync(connection, transaction,
                "SELECT 1 FROM grupos WHERE id_grupo = $1 AND id_grado = $2", ct, request.IdGrupo, request.IdGrado))
            return (null, "Grupo no encontrado en este grado", 404);
        if (await ExistsAsync(connection, transaction, """
                SELECT 1 FROM asignaciones_docente
                WHERE id_usuario = $1 AND id_materia = $2 AND id_grado = $3 AND id_grupo = $4 AND estado = 'Activa'
                """, ct, request.IdUsuario, request.IdMateria, request.IdGrado, request.IdGrupo))
            return (null, "Este docente ya está asignado a esta materia en este grado y grupo", 400);
        if (await ExistsAsync(connection, transaction, """
                SELECT 1 FROM asignaciones_docente
                WHERE id_materia = $1 AND id_grado = $2 AND id_grupo = $3 AND estado = 'Activa'
                """, ct, request.IdMateria, request.IdGrado, request.IdGrupo))
            return (null, "Ya existe un docente asignado a esta materia en este grado y grupo. Solo puede haber uno.", 400);

        await using var command = new NpgsqlCommand("""
            INSERT INTO asignaciones_docente (id_usuario, id_materia, id_grado, id_grupo, año_lectivo, estado)
            VALUES ($1, $2, $3, $4, $5, 'Activa')
            ON CONFLICT (id_usuario, id_materia, id_grado, id_grupo)
            DO UPDATE SET estado = 'Activa', año_lectivo = EXCLUDED.año_lectivo
            RETURNING id_asignacion
            """, connection, transaction);
        command.Parameters.AddWithValue(request.IdUsuario);
        command.Parameters.AddWithValue(request.IdMateria);
        command.Parameters.AddWithValue(request.IdGrado);
        command.Parameters.AddWithValue(request.IdGrupo);
        command.Parameters.AddWithValue(request.AñoLectivo);
        var id = Convert.ToInt32(await command.ExecuteScalarAsync(ct));
        await transaction.CommitAsync(ct);
        return (id, null, 201);
    }

    // Desactiva una asignacion sin borrar su historial.
    public async Task<bool> DeleteAsignacionAsync(int id, CancellationToken ct)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand("""
            UPDATE asignaciones_docente SET estado = 'Inactiva' WHERE id_asignacion = $1
            """, connection);
        command.Parameters.AddWithValue(id);
        return await command.ExecuteNonQueryAsync(ct) > 0;
    }

    // Ejecuta una consulta parametrizada y convierte todas sus filas a diccionarios.
    private async Task<IReadOnlyList<Dictionary<string, object?>>> QueryAsync(
        string sql, CancellationToken ct, params object?[] parameters)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        AddParameters(command, parameters);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<Dictionary<string, object?>>();
        while (await reader.ReadAsync(ct)) rows.Add(ReadRow(reader));
        return rows;
    }

    // Ejecuta una consulta parametrizada y devuelve solo la primera fila.
    private async Task<Dictionary<string, object?>?> QuerySingleAsync(
        string sql, CancellationToken ct, params object?[] parameters)
    {
        var rows = await QueryAsync(sql, ct, parameters);
        return rows.FirstOrDefault();
    }

    // Ejecuta una consulta escalar cuyo resultado se interpreta como entero.
    private async Task<int> ScalarIntAsync(string sql, CancellationToken ct, params object?[] parameters)
    {
        await using var connection = await factory.OpenConnectionAsync(ct);
        await using var command = new NpgsqlCommand(sql, connection);
        AddParameters(command, parameters);
        return Convert.ToInt32(await command.ExecuteScalarAsync(ct));
    }

    // Comprueba la existencia de una fila usando la transaccion activa.
    private static async Task<bool> ExistsAsync(
        NpgsqlConnection connection, NpgsqlTransaction transaction, string sql,
        CancellationToken ct, params object?[] parameters)
    {
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        AddParameters(command, parameters);
        return await command.ExecuteScalarAsync(ct) is not null;
    }

    // Agrega valores como parametros para evitar interpolar datos de la solicitud.
    private static void AddParameters(NpgsqlCommand command, object?[] parameters)
    {
        foreach (var parameter in parameters)
            command.Parameters.AddWithValue(parameter ?? DBNull.Value);
    }

    // Convierte la fila actual de PostgreSQL a la forma JSON usada por la API.
    private static Dictionary<string, object?> ReadRow(NpgsqlDataReader reader)
    {
        var row = new Dictionary<string, object?>(StringComparer.Ordinal);
        for (var i = 0; i < reader.FieldCount; i++)
            row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
        return row;
    }
}
