using Microsoft.AspNetCore.Mvc;
using Npgsql;

namespace ProyectoGrado.Api.Modules.Academico;

public static class AcademicoEndpoints
{
    public static IEndpointRouteBuilder MapAcademicoEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization();

        api.MapGet("/grados", async (AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", grados = await queries.ListGradosAsync(ct) }));

        api.MapPost("/grados", async (
            GradoCreateRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.CreateGradoAsync(request, ct);
            return Results.Json(new { status = "ok" }, statusCode: StatusCodes.Status201Created);
        });

        api.MapGet("/grados/{id:int}", async (int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var grado = await queries.GetGradoAsync(id, ct);
            return grado is null
                ? Results.NotFound(new { error = "No encontrado" })
                : Results.Ok(new { status = "ok", grado });
        });

        api.MapPut("/grados/{id:int}", async (
            int id, GradoCreateRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.UpdateGradoAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

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

        api.MapGet("/grados/{gradoId:int}/grupos", async (
            int gradoId, AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", grupos = await queries.ListGruposByGradoAsync(gradoId, ct) }));

        api.MapGet("/grupos", async (AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", grupos = await queries.ListGruposAsync(ct) }));

        api.MapPost("/grupos", async (
            GrupoRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.CreateGrupoAsync(request, ct);
            return Results.Json(new { status = "ok" }, statusCode: StatusCodes.Status201Created);
        });

        api.MapGet("/grupos/{id:int}", async (int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var grupo = await queries.GetGrupoAsync(id, ct);
            return grupo is null
                ? Results.NotFound(new { error = "No encontrado" })
                : Results.Ok(new { status = "ok", grupo });
        });

        api.MapPut("/grupos/{id:int}", async (
            int id, GrupoRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            await queries.UpdateGrupoAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

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

        api.MapGet("/grupos/{id:int}/estudiantes", async (
            int id, AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", estudiantes = await queries.ListEstudiantesByGrupoAsync(id, ct) }));

        api.MapGet("/materias", async (AcademicoQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", materias = await queries.ListMateriasAsync(ct) }));

        api.MapPost("/materias", async (
            MateriaRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            var id = await queries.CreateMateriaAsync(request, ct);
            return Results.Json(new { status = "ok", id_materia = id }, statusCode: StatusCodes.Status201Created);
        });

        api.MapGet("/materias/{id:int}", async (int id, AcademicoQueries queries, CancellationToken ct) =>
        {
            var materia = await queries.GetMateriaAsync(id, ct);
            return materia is null
                ? Results.NotFound(new { error = "Materia no encontrada" })
                : Results.Ok(new { status = "ok", materia });
        });

        api.MapPut("/materias/{id:int}", async (
            int id, MateriaRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            if (!await queries.MateriaExistsAsync(id, ct))
                return Results.NotFound(new { error = "Materia no encontrada" });
            await queries.UpdateMateriaAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

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

        api.MapPost("/asignaciones-docente", async (
            AsignacionDocenteRequest request, AcademicoQueries queries, CancellationToken ct) =>
        {
            var result = await queries.CreateAsignacionAsync(request, ct);
            if (result.Error is not null)
                return Results.Json(new { error = result.Error }, statusCode: result.Status);
            return Results.Json(new { status = "ok", id_asignacion = result.Id }, statusCode: result.Status);
        });

        api.MapDelete("/asignaciones-docente/{id:int}", async (
            int id, AcademicoQueries queries, CancellationToken ct) =>
            await queries.DeleteAsignacionAsync(id, ct)
                ? Results.Ok(new { status = "ok" })
                : Results.NotFound(new { error = "Asignación no encontrada" }));

        return endpoints;
    }
}
