using System.Security.Claims;

namespace ProyectoGrado.Api.Modules.Docentes;

public static class DocenteEndpoints
{
    public static IEndpointRouteBuilder MapDocenteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization();

        api.MapGet("/docentes", async (DocenteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", docentes = await queries.ListAsync(ct) }));

        api.MapGet("/docentes/disponibles", async (DocenteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", docentes = await queries.ListAvailableAsync(ct) }));

        api.MapGet("/docentes/{id:int}/asignaciones", async (
            int id, DocenteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", asignaciones = await queries.ListAssignmentsAsync(id, ct) }));

        api.MapGet("/docentes/{id:int}/grados-grupos", async (
            int id, DocenteQueries queries, CancellationToken ct) =>
        {
            var result = await queries.ListGradesAndGroupsAsync(id, ct);
            return Results.Ok(new { status = "ok", grados = result.Grados, grupos = result.Grupos });
        });

        api.MapGet("/docente/mis-materias", async (
            HttpContext context, DocenteQueries queries, CancellationToken ct) =>
        {
            if (!TryGetUserId(context, out var userId))
                return Results.Json(new { error = "Identidad de sesión incompleta" }, statusCode: 401);
            return Results.Ok(new { status = "ok", materias = await queries.ListMySubjectsAsync(userId, ct) });
        });

        api.MapGet("/docente/mi-horario", async (
            HttpContext context, DocenteQueries queries, CancellationToken ct) =>
        {
            if (!TryGetUserId(context, out var userId))
                return Results.Json(new { error = "Identidad de sesión incompleta" }, statusCode: 401);
            return Results.Ok(new { status = "ok", horario = await queries.ListMyScheduleAsync(userId, ct) });
        });

        return endpoints;
    }

    private static bool TryGetUserId(HttpContext context, out int userId)
    {
        var value = context.User.FindFirst("user_id")?.Value ??
                    context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(value, out userId);
    }
}
