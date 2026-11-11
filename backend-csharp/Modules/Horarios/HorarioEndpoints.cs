// BACKEND MODULE: Horarios
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ProyectoGrado.Api.Modules.Horarios;

public static class HorarioEndpoints
{
    public static IEndpointRouteBuilder MapHorarioEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization();

        // API: GET /api/horarios
        // Funcion: Lista horarios aplicando los filtros recibidos.

        api.MapGet("/horarios", async (
            [FromQuery(Name = "grupo_id")] int? groupId,
            [FromQuery(Name = "grado_id")] int? gradeId,
            [FromQuery(Name = "docente_id")] int? teacherId,
            HorarioQueries queries,
            CancellationToken ct) => Results.Ok(new
            {
                status = "ok",
                horarios = await queries.ListAsync(groupId, gradeId, teacherId, ct)
            }));

        // API: GET /api/horarios/{id:int}
        // Funcion: Obtiene el detalle de un horario por su identificador.

        api.MapGet("/horarios/{id:int}", async (
            int id, HorarioQueries queries, CancellationToken ct) =>
        {
            var horario = await queries.GetAsync(id, ct);
            return horario is null
                ? Results.NotFound(new { error = "Horario no encontrado" })
                : Results.Ok(new { status = "ok", horario });
        });

        // API: POST /api/horarios
        // Funcion: Crea un horario validando cruces de grupo y docente.

        api.MapPost("/horarios", async (
            HorarioRequest request, HttpContext context, HorarioQueries queries, CancellationToken ct) =>
        {
            var result = await queries.CreateAsync(
                request, GetUserId(context), GetForwardedIp(context),
                context.Request.Headers.UserAgent.ToString(), ct);
            return result.Error is not null
                ? Results.Json(new { error = result.Error }, statusCode: result.Status)
                : Results.Json(new { status = "ok", id_horario = result.Id }, statusCode: result.Status);
        });

        // API: PUT /api/horarios/{id:int}
        // Funcion: Actualiza un horario y vuelve a validar sus cruces.

        api.MapPut("/horarios/{id:int}", async (
            int id, HorarioRequest request, HttpContext context,
            HorarioQueries queries, CancellationToken ct) =>
        {
            var result = await queries.UpdateAsync(
                id, request, GetUserId(context), GetForwardedIp(context),
                context.Request.Headers.UserAgent.ToString(), ct);
            if (!result.Found) return Results.NotFound(new { error = "Horario no encontrado" });
            return result.Error is not null
                ? Results.BadRequest(new { error = result.Error })
                : Results.Ok(new { status = "ok" });
        });

        // API: DELETE /api/horarios/{id:int}
        // Funcion: Elimina un horario existente.

        api.MapDelete("/horarios/{id:int}", async (
            int id, HttpContext context, HorarioQueries queries, CancellationToken ct) =>
            await queries.DeleteAsync(
                id, GetUserId(context), GetForwardedIp(context),
                context.Request.Headers.UserAgent.ToString(), ct)
                ? Results.Ok(new { status = "ok" })
                : Results.NotFound(new { error = "Horario no encontrado" }));

        // API: GET /api/horarios/asignaciones-grupo/{groupId:int}
        // Funcion: Lista las asignaciones de horario de un grupo.

        api.MapGet("/horarios/asignaciones-grupo/{groupId:int}", async (
            int groupId, HorarioQueries queries, CancellationToken ct) => Results.Ok(new
            {
                status = "ok",
                asignaciones = await queries.ListGroupAssignmentsAsync(groupId, ct)
            }));

        // API: GET /api/horarios/asignaciones-grado/{gradeId:int}
        // Funcion: Lista las asignaciones de horario de todos los grupos de un grado.

        api.MapGet("/horarios/asignaciones-grado/{gradeId:int}", async (
            int gradeId, HorarioQueries queries, CancellationToken ct) => Results.Ok(new
            {
                status = "ok",
                asignaciones = await queries.ListGradeAssignmentsAsync(gradeId, ct)
            }));

        // API: GET /api/niveles
        // Funcion: Lista los niveles academicos disponibles.

        api.MapGet("/niveles", async (HorarioQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", niveles = await queries.ListLevelsAsync(ct) }));

        return endpoints;
    }

    private static int? GetUserId(HttpContext context)
    {
        var value = context.User.FindFirst("user_id")?.Value ??
                    context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(value, out var userId) ? userId : null;
    }

    private static string? GetForwardedIp(HttpContext context) =>
        context.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim()
        ?? context.Connection.RemoteIpAddress?.ToString();
}
