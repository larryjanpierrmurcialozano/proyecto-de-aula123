// BACKEND MODULE: host ASP.NET Core
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using Npgsql;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using ProyectoGrado.Api.Data;
using ProyectoGrado.Api.Modules.Auth;
using ProyectoGrado.Api.Modules.Academico;
using ProyectoGrado.Api.Modules.Estudiantes;
using ProyectoGrado.Api.Modules.Docentes;
using ProyectoGrado.Api.Modules.Horarios;
using ProyectoGrado.Api.Modules.Usuarios;

var builder = WebApplication.CreateBuilder(args);
if (builder.Environment.IsDevelopment())
{
    var localEnvPath = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", ".env"));
    if (File.Exists(localEnvPath))
    {
        foreach (var line in File.ReadLines(localEnvPath))
        {
            var separator = line.IndexOf('=');
            if (separator <= 0) continue;

            var key = line[..separator].Trim();
            if (key is not ("CSHARP_PROXY_SECRET" or "CSHARP_PROXY_MODULES")) continue;

            var value = line[(separator + 1)..].Trim().Trim('"', '\'');
            builder.Configuration[key] = value;
        }
    }
}
var proxySecret = builder.Configuration["CSHARP_PROXY_SECRET"] ?? string.Empty;
var proxyModules = (builder.Configuration["CSHARP_PROXY_MODULES"] ?? string.Empty)
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    .ToHashSet(StringComparer.OrdinalIgnoreCase);
var proxyModuleRoutes = new Dictionary<string, (string Prefix, string[] Methods)[]>(StringComparer.OrdinalIgnoreCase)
{
    ["estudiantes"] = [("/api/estudiantes", ["GET", "POST", "PUT", "DELETE"])],
    ["academico"] =
    [
        ("/api/grados", ["GET", "POST", "PUT", "DELETE"]),
        ("/api/grupos", ["GET", "POST", "PUT", "DELETE"]),
        ("/api/materias", ["GET", "POST", "PUT", "DELETE"]),
        ("/api/asignaciones-docente", ["POST", "DELETE"])
    ],
    ["docentes"] =
    [
        ("/api/docentes", ["GET"]),
        ("/api/docente/mis-materias", ["GET"]),
        ("/api/docente/mi-horario", ["GET"])
    ],
    ["horarios"] =
    [
        ("/api/horarios", ["GET", "POST", "PUT", "DELETE"]),
        ("/api/niveles", ["GET"])
    ]
};

builder.Services.AddSingleton<PostgresConnectionFactory>();
builder.Services.AddScoped<AuthQueries>();
builder.Services.AddScoped<UsuarioQueries>();
builder.Services.AddScoped<AcademicoQueries>();
builder.Services.AddScoped<EstudianteQueries>();
builder.Services.AddScoped<DocenteQueries>();
builder.Services.AddScoped<HorarioQueries>();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "proyecto_grado_auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddValidation();

var app = builder.Build();
app.Use(async (context, next) =>
{
    var startedAt = System.Diagnostics.Stopwatch.GetTimestamp();
    try
    {
        await next();
    }
    catch
    {
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        }
        app.Logger.LogError(
            "HTTP {Method} {Path} failed",
            context.Request.Method,
            context.Request.Path);
        throw;
    }
    finally
    {
        var elapsedMilliseconds = System.Diagnostics.Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds;
        app.Logger.LogInformation(
            "HTTP {Method} {Path} -> {StatusCode} ({ElapsedMilliseconds:F0} ms)",
            context.Request.Method,
            context.Request.Path,
            context.Response.StatusCode,
            elapsedMilliseconds);
    }
});
app.UseAuthentication();
app.Use(async (context, next) =>
{
    if (!context.Request.Headers.TryGetValue("X-Docstry-Proxy-Secret", out var receivedSecret))
    {
        await next();
        return;
    }

    var expectedBytes = Encoding.UTF8.GetBytes(proxySecret);
    var receivedBytes = Encoding.UTF8.GetBytes(receivedSecret.ToString());
    if (expectedBytes.Length == 0 || expectedBytes.Length != receivedBytes.Length ||
        !CryptographicOperations.FixedTimeEquals(expectedBytes, receivedBytes))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = "Proxy interno no autorizado" });
        return;
    }

    var path = context.Request.Path.Value ?? string.Empty;
    var isHorarioPdf = path.Equals("/api/horarios/exportar-pdf", StringComparison.OrdinalIgnoreCase);
    var allowedPath = !isHorarioPdf && proxyModules
        .Where(proxyModuleRoutes.ContainsKey)
        .SelectMany(module => proxyModuleRoutes[module])
        .Any(route => route.Methods.Contains(context.Request.Method, StringComparer.OrdinalIgnoreCase) &&
                      (path.Equals(route.Prefix, StringComparison.OrdinalIgnoreCase) ||
                       path.StartsWith(route.Prefix + "/", StringComparison.OrdinalIgnoreCase)));
    if (!allowedPath)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        await context.Response.WriteAsJsonAsync(new { error = "Módulo fuera del alcance del proxy" });
        return;
    }

    var userId = context.Request.Headers["X-Authenticated-User-Id"].ToString();
    var userRole = context.Request.Headers["X-Authenticated-User-Role"].ToString();
    if (!int.TryParse(userId, out _) || string.IsNullOrWhiteSpace(userRole))
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await context.Response.WriteAsJsonAsync(new { error = "Identidad de sesión incompleta" });
        return;
    }

    var claims = new List<Claim>
    {
        new("user_id", userId),
        new("user_role", userRole),
        new(ClaimTypes.NameIdentifier, userId),
        new(ClaimTypes.Role, userRole)
    };
    var userName = context.Request.Headers["X-Authenticated-User-Name"].ToString();
    var userEmail = context.Request.Headers["X-Authenticated-User-Email"].ToString();
    if (!string.IsNullOrWhiteSpace(userName)) claims.Add(new Claim("user_name", userName));
    if (!string.IsNullOrWhiteSpace(userEmail)) claims.Add(new Claim("user_email", userEmail));
    context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "FlaskProxy"));

    await next();
});
app.UseAuthorization();

// API: GET /
// Funcion: Comprueba que el servicio ASP.NET Core esta disponible y devuelve su estado.

app.MapGet("/", () => Results.Ok(new
{
    service = "ProyectoGrado.Api",
    status = "ready",
    migratedFrom = "backend/routes"
}));

app.MapAcademicoEndpoints();
app.MapEstudianteEndpoints();
app.MapDocenteEndpoints();
app.MapHorarioEndpoints();

// API: GET /api/health
// Funcion: Comprueba la conexion con PostgreSQL y devuelve la base de datos activa.

app.MapGet("/api/health", async (PostgresConnectionFactory factory, CancellationToken cancellationToken) =>
{
    try
    {
        await using var connection = await factory.OpenConnectionAsync(cancellationToken);
        await using var command = new NpgsqlCommand("SELECT current_database()", connection);
        var database = (string?)await command.ExecuteScalarAsync(cancellationToken);
        return Results.Ok(new { status = "ok", database });
    }
    catch (NpgsqlException)
    {
        return Results.Problem(
            title: "PostgreSQL no disponible",
            detail: "Verifica el contenedor y la cadena de conexión.",
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
});

// API: GET /api/usuarios
// Funcion: Lista los usuarios registrados junto con su rol.

app.MapGet("/api/usuarios", async (UsuarioQueries queries, CancellationToken cancellationToken) =>
    Results.Ok(await queries.ListAsync(cancellationToken)));

// API: GET /api/usuarios/{id:int}
// Funcion: Obtiene el detalle de un usuario por su identificador.

app.MapGet("/api/usuarios/{id:int}", async (
    int id,
    UsuarioQueries queries,
    CancellationToken cancellationToken) =>
{
    var usuario = await queries.GetAsync(id, cancellationToken);
    return usuario is null ? Results.NotFound(new { error = "Usuario no encontrado" }) : Results.Ok(usuario);
});

// API: GET /api/roles
// Funcion: Lista los roles disponibles para asignar a usuarios.

app.MapGet("/api/roles", async (UsuarioQueries queries, CancellationToken cancellationToken) =>
    Results.Ok(await queries.ListRolesAsync(cancellationToken)));

// API: POST /api/usuarios
// Funcion: Crea un usuario nuevo con sus datos personales, rol y contrasena.

app.MapPost("/api/usuarios", async (
    CreateUsuarioRequest request,
    UsuarioQueries queries,
    CancellationToken cancellationToken) =>
{
    try
    {
        var id = await queries.CreateAsync(request, cancellationToken);
        return Results.Created($"/api/usuarios/{id}", new { status = "ok", id });
    }
    catch (PostgresException exception) when (exception.SqlState == "23505")
    {
        return Results.BadRequest(new { error = "El email o documento ya está registrado." });
    }
});

// API: PUT /api/usuarios/{id:int}
// Funcion: Actualiza los datos, rol, estado y contrasena opcional de un usuario.

app.MapPut("/api/usuarios/{id:int}", async (
    int id,
    UpdateUsuarioRequest request,
    UsuarioQueries queries,
    CancellationToken cancellationToken) =>
{
    try
    {
        return await queries.UpdateAsync(id, request, cancellationToken)
            ? Results.Ok(new { status = "ok" })
            : Results.NotFound(new { error = "Usuario no encontrado" });
    }
    catch (PostgresException exception) when (exception.SqlState == "23505")
    {
        return Results.BadRequest(new { error = "El email o documento ya está registrado." });
    }
});

// API: DELETE /api/usuarios/{id:int}
// Funcion: Elimina un usuario despues de validar sus dependencias y permisos.

app.MapDelete("/api/usuarios/{id:int}", async (
    int id,
    UsuarioQueries queries,
    CancellationToken cancellationToken) =>
{
    return await queries.DeleteAsync(id, cancellationToken)
        ? Results.NoContent()
        : Results.NotFound(new { error = "Usuario no encontrado" });
}).RequireAuthorization(policy => policy.RequireRole("server_admin"));

// API: GET /api/auth/profile
// Funcion: Devuelve el perfil del usuario autenticado a partir de sus claims.

app.MapGet("/api/auth/profile", async (
    HttpContext httpContext,
    AuthQueries queries,
    CancellationToken cancellationToken) =>
{
    if (!int.TryParse(httpContext.User.FindFirst("user_id")?.Value, out var id))
    {
        return Results.Json(new { error = "No autenticado" }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var profile = await queries.GetProfileAsync(id, cancellationToken);
    return profile is null
        ? Results.NotFound(new { error = "Usuario no encontrado" })
        : Results.Ok(new { status = "ok", usuario = profile });
});

// API: POST /api/auth/login
// Funcion: Valida documento y contrasena, y crea la cookie de autenticacion.

app.MapPost("/api/auth/login", async (
    LoginRequest request,
    AuthQueries queries,
    HttpContext httpContext,
    CancellationToken cancellationToken) =>
{
    var user = await queries.AuthenticateAsync(request.Email, request.Password, cancellationToken);
    if (user is null)
    {
        return Results.Json(new { error = "Email o contraseña incorrectos" }, statusCode: StatusCodes.Status401Unauthorized);
    }

    await httpContext.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        user.Principal,
        user.Properties);

    return Results.Ok(new
    {
        status = "ok",
        user_id = user.User.IdUsuario,
        user_name = $"{user.User.Nombre} {user.User.Apellido}",
        user_role = user.User.NombreRol
    });
});

// API: GET /api/auth/check
// Funcion: Comprueba si existe una sesion autenticada y devuelve sus datos basicos.

app.MapGet("/api/auth/check", (HttpContext httpContext) =>
{
    if (httpContext.User.Identity?.IsAuthenticated != true)
    {
        return Results.Json(new { authenticated = false }, statusCode: StatusCodes.Status401Unauthorized);
    }

    return Results.Ok(new
    {
        authenticated = true,
        user_id = httpContext.User.FindFirst("user_id")?.Value,
        user_name = httpContext.User.FindFirst("user_name")?.Value,
        user_email = httpContext.User.FindFirst("user_email")?.Value,
        user_role = httpContext.User.FindFirst("user_role")?.Value
    });
});

// API: POST /api/auth/logout
// Funcion: Cierra la sesion actual y elimina la cookie de autenticacion.

app.MapPost("/api/auth/logout", async (HttpContext httpContext) =>
{
    await httpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok(new { status = "ok" });
});

// API: POST /api/auth/change-password
// Funcion: Verifica la contrasena actual y guarda la nueva contrasena.

app.MapPost("/api/auth/change-password", async (
    ChangePasswordRequest request,
    HttpContext httpContext,
    AuthQueries queries,
    CancellationToken cancellationToken) =>
{
    if (!int.TryParse(httpContext.User.FindFirst("user_id")?.Value, out var id))
    {
        return Results.Json(new { error = "No autenticado" }, statusCode: StatusCodes.Status401Unauthorized);
    }

    var result = await queries.ChangePasswordAsync(id, request, cancellationToken);
    return result switch
    {
        PasswordChangeResult.Unauthenticated => Results.Json(
            new { error = "No autenticado" }, statusCode: StatusCodes.Status401Unauthorized),
        PasswordChangeResult.InvalidCurrentPassword => Results.BadRequest(
            new { error = "Contraseña actual incorrecta" }),
        PasswordChangeResult.InvalidNewPassword => Results.BadRequest(
            new { error = PasswordPolicy.ErrorMessage }),
        _ => Results.Ok(new { status = "ok", message = "Contraseña actualizada" })
    };
});

// API: POST /api/auth/register
// Funcion: Registra un usuario nuevo con el rol de profesor.

app.MapPost("/api/auth/register", async (
    RegisterRequest request,
    AuthQueries queries,
    CancellationToken cancellationToken) =>
{
    var result = await queries.RegisterAsync(request, cancellationToken);
    return result.IsSuccess
        ? Results.Created($"/api/usuarios/{result.UserId}", new
        {
            status = "ok",
            message = "Usuario registrado",
            user_id = result.UserId
        })
        : Results.BadRequest(new { error = result.Error });
});

app.Run();

public partial class Program;
