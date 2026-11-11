// BACKEND MODULE: Academico
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ProyectoGrado.Api.Modules.Academico;

public static class AcademicoEndpoints
{
    public static IEndpointRouteBuilder MapAcademicoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization();

        // API: GET /api/grados
        // Funcion: Lista todos los grados academicos.

        api.MapGet("/grados", async (AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", grados = await queries.ListGradosAsync(ct) }));

        // API: POST /api/grados
        // Funcion: Crea un grado academico.

        api.MapPost("/grados", async (
            GradoCreateRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.CreateGradoAsync(request, ct);
            return Results.Json(new { status = "ok" }, statusCode: StatusCodes.Status201Created);
        });

        // API: GET /api/grados/{id:int}
        // Funcion: Obtiene un grado academico por su identificador.

        api.MapGet("/grados/{id:int}", async (int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var grado = await queries.GetGradoAsync(id, ct);
            return grado is null
                ? Results.NotFound(new { error = "No encontrado" })
                : Results.Ok(new { status = "ok", grado });
        });

        // API: PUT /api/grados/{id:int}
        // Funcion: Actualiza los datos de un grado academico.

        api.MapPut("/grados/{id:int}", async (
            int id, GradoCreateRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.UpdateGradoAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

        // API: DELETE /api/grados/{id:int}
        // Funcion: Elimina un grado solo si no tiene grupos ni asignaciones relacionadas.

        api.MapDelete("/grados/{id:int}", async (
            int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var dependencies = await queries.CountGradeDependenciesAsync(id, ct);
            if (dependencies.Groups > 0 || dependencies.Assignments > 0)
            {
                var reasons = new List<string>();
                if (dependencies.Groups > 0) reasons.Add($"{dependencies.Groups} grupo(s) relacionados");
                if (dependencies.Assignments > 0) reasons.Add($"{dependencies.Assignments} asignación(es) de docente relacionadas");
                return Results.BadRequest(new
                {
                    error = "No se puede eliminar grado debido a dependencias: " + string.Join(", ", reasons)
                });
            }

            await queries.DeleteGradoAsync(id, ct);
            return Results.Ok(new { status = "ok" });
        });

        // API: GET /api/grados/{gradoId:int}/grupos
        // Funcion: Lista los grupos pertenecientes a un grado.

        api.MapGet("/grados/{gradoId:int}/grupos", async (
            int gradoId, AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", grupos = await queries.ListGruposByGradoAsync(gradoId, ct) }));

        // API: GET /api/grupos
        // Funcion: Lista todos los grupos academicos.

        api.MapGet("/grupos", async (AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", grupos = await queries.ListGruposAsync(ct) }));

        // API: POST /api/grupos
        // Funcion: Crea un grupo academico.

        api.MapPost("/grupos", async (
            GrupoRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.CreateGrupoAsync(request, ct);
            return Results.Json(new { status = "ok" }, statusCode: StatusCodes.Status201Created);
        });

        // API: GET /api/grupos/{id:int}
        // Funcion: Obtiene un grupo por su identificador.

        api.MapGet("/grupos/{id:int}", async (int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var grupo = await queries.GetGrupoAsync(id, ct);
            return grupo is null
                ? Results.NotFound(new { error = "No encontrado" })
                : Results.Ok(new { status = "ok", grupo });
        });

        // API: PUT /api/grupos/{id:int}
        // Funcion: Actualiza los datos de un grupo.

        api.MapPut("/grupos/{id:int}", async (
            int id, GrupoRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.UpdateGrupoAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

        // API: DELETE /api/grupos/{id:int}
        // Funcion: Elimina un grupo y devuelve un error si conserva estudiantes relacionados.

        api.MapDelete("/grupos/{id:int}", async (
            int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            try
            {
                await queries.DeleteGrupoAsync(id, ct);
                return Results.Ok(new { status = "ok" });
            }
            catch (PostgresException exception) when (exception.SqlState == "23503")
            {
                return Results.BadRequest(new
                {
                    error = "No se puede eliminar sin antes verificar que no hayan estudiantes dentro de este grupo"
                });
            }
        });

        // API: GET /api/grupos/{id:int}/estudiantes
        // Funcion: Lista los estudiantes matriculados en un grupo.

        api.MapGet("/grupos/{id:int}/estudiantes", async (
            int id, AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", estudiantes = await queries.ListEstudiantesByGrupoAsync(id, ct) }));

        // API: GET /api/materias
        // Funcion: Lista las materias registradas.

        api.MapGet("/materias", async (AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", materias = await queries.ListMateriasAsync(ct) }));

        // API: POST /api/materias
        // Funcion: Crea una materia academica.

        api.MapPost("/materias", async (
            MateriaRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            var id = await queries.CreateMateriaAsync(request, ct);
            return Results.Json(new { status = "ok", id_materia = id }, statusCode: StatusCodes.Status201Created);
        });

        // API: GET /api/materias/{id:int}
        // Funcion: Obtiene una materia por su identificador.

        api.MapGet("/materias/{id:int}", async (int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var materia = await queries.GetMateriaAsync(id, ct);
            return materia is null
                ? Results.NotFound(new { error = "Materia no encontrada" })
                : Results.Ok(new { status = "ok", materia });
        });

        // API: PUT /api/materias/{id:int}
        // Funcion: Actualiza los datos de una materia.

        api.MapPut("/materias/{id:int}", async (
            int id, MateriaRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            if (!await queries.MateriaExistsAsync(id, ct))
                return Results.NotFound(new { error = "Materia no encontrada" });
            await queries.UpdateMateriaAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

        // API: DELETE /api/materias/{id:int}
        // Funcion: Elimina una materia solo si no tiene dependencias que lo impidan.

        api.MapDelete("/materias/{id:int}", async (
            int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var blocker = await queries.GetMateriaDeleteBlockerAsync(id, ct);
            if (blocker == "__not_found__")
                return Results.NotFound(new { error = "Materia no encontrada" });
            if (blocker is not null) return Results.BadRequest(new { error = blocker });
            await queries.DeleteMateriaAsync(id, ct);
            return Results.Ok(new { status = "ok" });
        });

        // API: GET /api/materias/{materiaId:int}/docentes-disponibles
        // Funcion: Lista docentes disponibles para asignar una materia, con filtros opcionales de grado y grupo.

        api.MapGet("/materias/{materiaId:int}/docentes-disponibles", async (
            int materiaId,
            [FromQuery(Name = "grado_id")] int? gradoId,
            [FromQuery(Name = "grupo_id")] int? grupoId,
            AcademicoQueries queries,
            CancellationToken ct) => Results.Ok(new
            {
                status = "ok",
                docentes = await queries.ListDocentesDisponiblesAsync(materiaId, gradoId, grupoId, ct)
            }));

        // API: POST /api/asignaciones-docente
        // Funcion: Crea una asignacion de docente a una materia, grado o grupo.

        api.MapPost("/asignaciones-docente", async (
            AsignacionDocenteRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            var result = await queries.CreateAsignacionAsync(request, ct);
            if (result.Error is not null)
                return Results.Json(new { error = result.Error }, statusCode: result.Status);
            return Results.Json(new { status = "ok", id_asignacion = result.Id }, statusCode: result.Status);
        });

        // API: DELETE /api/asignaciones-docente/{id:int}
        // Funcion: Elimina una asignacion docente existente.

        api.MapDelete("/asignaciones-docente/{id:int}", async (
            int id, AcademicoQueries queries, CancellationToken ct) =>
            await queries.DeleteAsignacionAsync(id, ct)
                ? Results.Ok(new { status = "ok" })
                : Results.NotFound(new { error = "Asignación no encontrada" }));

        return endpoints;
    }
}
