using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace ProyectoGrado.Api.Modules.Horarios;

public static class HorarioEndpoints
{
    public static IEndpointRouteBuilder MapHorarioEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization();

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

        api.MapGet("/horarios/{id:int}", async (
            int id, HorarioQueries queries, CancellationToken ct) =>
        {
            var horario = await queries.GetAsync(id, ct);
            return horario is null
                ? Results.NotFound(new { error = "Horario no encontrado" })
                : Results.Ok(new { status = "ok", horario });
        });

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

        api.MapDelete("/horarios/{id:int}", async (
            int id, HttpContext context, HorarioQueries queries, CancellationToken ct) =>
            await queries.DeleteAsync(
                id, GetUserId(context), GetForwardedIp(context),
                context.Request.Headers.UserAgent.ToString(), ct)
                ? Results.Ok(new { status = "ok" })
                : Results.NotFound(new { error = "Horario no encontrado" }));

        api.MapGet("/horarios/asignaciones-grupo/{groupId:int}", async (
            int groupId, HorarioQueries queries, CancellationToken ct) => Results.Ok(new
            {
                status = "ok",
                asignaciones = await queries.ListGroupAssignmentsAsync(groupId, ct)
            }));

        api.MapGet("/horarios/asignaciones-grado/{gradeId:int}", async (
            int gradeId, HorarioQueries queries, CancellationToken ct) => Results.Ok(new
            {
                status = "ok",
                asignaciones = await queries.ListGradeAssignmentsAsync(gradeId, ct)
            }));

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
