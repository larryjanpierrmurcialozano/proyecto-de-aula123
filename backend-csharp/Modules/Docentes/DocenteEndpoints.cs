// BACKEND MODULE: Docentes
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using System.Security.Claims;

namespace ProyectoGrado.Api.Modules.Docentes;

public static class DocenteEndpoints
{
    public static IEndpointRouteBuilder MapDocenteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api").RequireAuthorization();

        // API: GET /api/docentes
        // Funcion: Lista los docentes registrados.

        api.MapGet("/docentes", async (DocenteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", docentes = await queries.ListAsync(ct) }));

        // API: GET /api/docentes/disponibles
        // Funcion: Lista docentes disponibles para nuevas asignaciones.

        api.MapGet("/docentes/disponibles", async (DocenteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", docentes = await queries.ListAvailableAsync(ct) }));

        // API: GET /api/docentes/{id:int}/asignaciones
        // Funcion: Lista las asignaciones academicas de un docente.

        api.MapGet("/docentes/{id:int}/asignaciones", async (
            int id, DocenteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", asignaciones = await queries.ListAssignmentsAsync(id, ct) }));

        // API: GET /api/docentes/{id:int}/grados-grupos
        // Funcion: Lista los grados y grupos asociados a un docente.

        api.MapGet("/docentes/{id:int}/grados-grupos", async (
            int id, DocenteQueries queries, CancellationToken ct) =>
        {
            var result = await queries.ListGradesAndGroupsAsync(id, ct);
            return Results.Ok(new { status = "ok", grados = result.Grados, grupos = result.Grupos });
        });

        // API: GET /api/docente/mis-materias
        // Funcion: Lista las materias asignadas al docente autenticado.

        api.MapGet("/docente/mis-materias", async (
            HttpContext context, DocenteQueries queries, CancellationToken ct) =>
        {
            if (!TryGetUserId(context, out var userId))
                return Results.Json(new { error = "Identidad de sesión incompleta" }, statusCode: 401);
            return Results.Ok(new { status = "ok", materias = await queries.ListMySubjectsAsync(userId, ct) });
        });

        // API: GET /api/docente/mi-horario
        // Funcion: Devuelve el horario del docente autenticado.

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
