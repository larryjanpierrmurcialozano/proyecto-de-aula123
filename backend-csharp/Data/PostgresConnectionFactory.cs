using Npgsql;

namespace ProyectoGrado.Api.Data;

public sealed class PostgresConnectionFactory(IConfiguration configuration)
{
    private readonly string _connectionString =
        configuration.GetConnectionString("Postgres")
        ?? throw new InvalidOperationException("Falta ConnectionStrings:Postgres.");

    public async Task<NpgsqlConnection> OpenConnectionAsync(CancellationToken cancellationToken)
    {
        var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
