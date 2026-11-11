// BACKEND MODULE: acceso a datos
// Este archivo define la configuracion, endpoints, modelos o consultas del backend C#.
// Los comentarios de API se colocan junto a cada endpoint para facilitar su ubicacion.

using Npgsql;

namespace ProyectoGrado.Api.Data;

public sealed class PostgresConnectionFactory(IConfiguration configuration)
{
    private readonly string _connectionString = BuildConnectionString(configuration);

    private static string BuildConnectionString(IConfiguration configuration)
    {
        var configuredConnectionString = configuration.GetConnectionString("Postgres");
        var host = GetEnvironmentValue("DB_HOST", "POSTGRES_HOST")
            ?? GetConnectionValue(configuredConnectionString, "Host")
            ?? "localhost";
        var port = GetEnvironmentValue("DB_PORT", "POSTGRES_PORT")
            ?? GetConnectionValue(configuredConnectionString, "Port")
            ?? "5432";
        var database = GetEnvironmentValue("DB_NAME", "POSTGRES_DB")
            ?? GetConnectionValue(configuredConnectionString, "Database")
            ?? "anexo_de_datos";
        var username = GetEnvironmentValue("DB_USER", "POSTGRES_USER")
            ?? GetConnectionValue(configuredConnectionString, "Username")
            ?? "docstry_app";
        var password = GetEnvironmentValue("DB_PASSWORD", "POSTGRES_PASSWORD")
            ?? GetConnectionValue(configuredConnectionString, "Password");

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException(
                "Falta DB_PASSWORD o POSTGRES_PASSWORD para conectarse a PostgreSQL.");
        }

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = host,
            Port = int.Parse(port),
            Database = database,
            Username = username,
            Password = password,
            SslMode = ParseSslMode(
                GetEnvironmentValue("DB_SSLMODE")
                ?? GetConnectionValue(configuredConnectionString, "SSL Mode"))
        };

        return builder.ConnectionString;
    }

    private static string? GetEnvironmentValue(params string[] names)
    {
        foreach (var name in names)
        {
            var value = Environment.GetEnvironmentVariable(name);
            if (!string.IsNullOrWhiteSpace(value)) return value;
        }

        return null;
    }

    private static string? GetConnectionValue(string? connectionString, string key)
    {
        if (string.IsNullOrWhiteSpace(connectionString)) return null;

        var builder = new NpgsqlConnectionStringBuilder(connectionString);
        return builder.TryGetValue(key, out var value) ? value?.ToString() : null;
    }

    private static SslMode ParseSslMode(string? value)
    {
        return string.IsNullOrWhiteSpace(value) || !Enum.TryParse<SslMode>(value, true, out var sslMode)
            ? SslMode.Prefer
            : sslMode;
    }

    public async Task<NpgsqlConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
