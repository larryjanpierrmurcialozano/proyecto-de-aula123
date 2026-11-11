// BACKEND MODULE: Estudiantes
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using System.Security.Claims;

namespace ProyectoGrado.Api.Modules.Estudiantes;

public static class EstudianteEndpoints
{
    public static IEndpointRouteBuilder MapEstudianteEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var api = endpoints.MapGroup("/api/estudiantes").RequireAuthorization();

        // API: GET /api/estudiantes
        // Funcion: Lista los estudiantes registrados.

        api.MapGet("", async (EstudianteQueries queries, CancellationToken ct) =>
            Results.Ok(new { status = "ok", estudiantes = await queries.ListAsync(ct) }));

        // API: GET /api/estudiantes/{id:int}
        // Funcion: Obtiene un estudiante por su identificador.

        api.MapGet("/{id:int}", async (int id, EstudianteQueries queries, CancellationToken ct) =>
        {
            var estudiante = await queries.GetAsync(id, ct);
            return Results.Ok(new { status = "ok", estudiante });
        });

        // API: POST /api/estudiantes
        // Funcion: Crea un estudiante nuevo.

        api.MapPost("", async (
            EstudianteRequest request, EstudianteQueries queries, CancellationToken ct) =>
        {
            var id = await queries.CreateAsync(request, ct);
            return Results.Json(new { status = "ok", id }, statusCode: StatusCodes.Status201Created);
        });

        // API: PUT /api/estudiantes/{id:int}
        // Funcion: Actualiza los datos de un estudiante.

        api.MapPut("/{id:int}", async (
            int id, EstudianteRequest request, EstudianteQueries queries, CancellationToken ct) =>
        {
            await queries.UpdateAsync(id, request, ct);
            return Results.Ok(new { status = "ok" });
        });

        // API: DELETE /api/estudiantes/{id:int}
        // Funcion: Elimina un estudiante y registra la identidad y el origen de la solicitud.

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
