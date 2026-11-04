using System.Security.Claims;

namespace ProyectoGrado.Api.Modules.Estudiantes;

public static class EstudianteEndpoints
{
    public static IEndpointRouteBuilder MapEstudianteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/estudiantes").RequireAuthorization();

        api.MapGet("", async (EstudianteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", estudiantes = await queries.ListAsync(ct) }));

        api.MapGet("/{id:int}", async (int id, EstudianteQueries queries, CancellationToken ct) =>
        {
            var estudiante = await queries.GetAsync(id, ct);
            return Results.Ok(new { status = "ok", estudiante });
        });

        api.MapPost("", async (
            EstudianteRequest request, EstudianteQueries queries, CancellationToken ct) =>
        {
            var id = await queries.CreateAsync(request, ct);
            return Results.Json(new { status = "ok", id }, statusCode: StatusCodes.Status201Created);
        });

        api.MapPut("/{id:int}", async (
            int id, EstudianteRequest request, EstudianteQueries queries, CancellationToken ct) =>
        {
            await queries.UpdateAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

        api.MapDelete("/{id:int}", async (
            int id, HttpContext context, EstudianteQueries queries, CancellationToken ct) =>
        {
            var deleted = await queries.DeleteAsync(
                id,
                context.User.FindFirst("user_id")?.Value ?? context.User.FindFirst(ClaimTypes.NameIdentifier)?.Value,
                context.Connection.RemoteIpAddress?.ToString(),
                context.Request.Headers.UserAgent.ToString(),
                ct);
            return deleted
                ? Results.Ok(new { status = "ok" })
                : Results.NotFound(new { error = "Estudiante no encontrado" });
        });

        return endpoints;
    }
}
