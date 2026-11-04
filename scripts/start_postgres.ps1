[CmdletBinding()]
param(
    [string]$Password = "",
    [int]$Port = 5432,
    [string]$SchemaBackupPath = "scripts\database\initial_schema.dump"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$configPath = Join-Path $projectRoot ".env.docker"
$configTemplatePath = Join-Path $projectRoot ".env.docker.example"
$composePath = Join-Path $projectRoot "docker-compose.postgres.yml"
$schemaBackup = Join-Path $projectRoot $SchemaBackupPath

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker no está instalado o no está disponible en PATH."
}

if (-not (Test-Path $schemaBackup)) {
    throw "No se encontró el respaldo de estructura en '$schemaBackup'."
}

if (-not (Test-Path $configPath)) {
    Copy-Item -LiteralPath $configTemplatePath -Destination $configPath
}

$config = Get-Content -LiteralPath $configPath
$databaseName = ($config | Where-Object { $_ -match "^POSTGRES_DB=" } | Select-Object -First 1).Substring("POSTGRES_DB=".Length)
$databaseUser = ($config | Where-Object { $_ -match "^POSTGRES_USER=" } | Select-Object -First 1).Substring("POSTGRES_USER=".Length)
if ([string]::IsNullOrWhiteSpace($Password)) {
    $passwordLine = $config | Where-Object { $_ -match "^POSTGRES_PASSWORD=" } | Select-Object -First 1
    $configuredPassword = if ($passwordLine) { $passwordLine.Substring("POSTGRES_PASSWORD=".Length) } else { "" }

    if ([string]::IsNullOrWhiteSpace($configuredPassword) -or $configuredPassword -eq "replace_with_a_strong_unique_password") {
        $randomBytes = [byte[]](1..32 | ForEach-Object { Get-Random -Maximum 256 })
        $Password = [Convert]::ToBase64String($randomBytes).Replace("+", "-").Replace("/", "_").TrimEnd("=")
    }
    else {
        $Password = $configuredPassword
    }
}

$updatedConfig = foreach ($line in $config) {
    if ($line -match "^POSTGRES_PASSWORD=") {
        "POSTGRES_PASSWORD=$Password"
    }
    elseif ($line -match "^POSTGRES_PORT=") {
        "POSTGRES_PORT=$Port"
    }
    else {
        $line
    }
}
Set-Content -LiteralPath $configPath -Value $updatedConfig -Encoding utf8

Push-Location $projectRoot
try {
    docker compose --env-file $configPath -f $composePath up -d --wait
    if ($LASTEXITCODE -ne 0) {
        throw "Docker Compose no pudo iniciar PostgreSQL."
    }

    $containerId = docker compose --env-file $configPath -f $composePath ps -q postgres
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($containerId)) {
        throw "No fue posible obtener el contenedor PostgreSQL."
    }
    $containerId = $containerId.Trim()

    $schemaInitialized = docker exec $containerId psql -U $databaseUser -d $databaseName -tAc "SELECT to_regclass('public._proyecto_schema_initialized') IS NOT NULL;" 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible comprobar el estado del esquema PostgreSQL."
    }

    if ($schemaInitialized.Trim() -ne "t") {
        Write-Host "Creando tablas y objetos desde '$SchemaBackupPath' (sin datos)..."
        docker cp $schemaBackup "${containerId}:/tmp/initial_schema.dump"
        if ($LASTEXITCODE -ne 0) {
            throw "No fue posible copiar el respaldo de estructura al contenedor."
        }

        docker exec $containerId pg_restore `
            --username=$databaseUser `
            --dbname=$databaseName `
            --schema-only `
            --no-owner `
            --no-acl `
            --exit-on-error `
            /tmp/initial_schema.dump
        if ($LASTEXITCODE -ne 0) {
            throw "No fue posible crear la estructura de la base de datos."
        }

        docker exec $containerId psql -U $databaseUser -d $databaseName -c "CREATE TABLE IF NOT EXISTS public._proyecto_schema_initialized (id boolean PRIMARY KEY DEFAULT true CHECK (id));"
        if ($LASTEXITCODE -ne 0) {
            throw "No fue posible registrar la inicialización del esquema."
        }

        docker exec $containerId rm -f /tmp/initial_schema.dump
    }
    else {
        Write-Host "La estructura de PostgreSQL ya está creada; no se cargaron datos."
    }

    Write-Host ""
    Write-Host "PostgreSQL está ejecutándose en localhost:$Port."
    Write-Host "Base de datos: $databaseName"
    Write-Host "La estructura de tablas fue preparada sin registros."
    Write-Host "Usuario: $databaseUser"
    Write-Host "La contraseña quedó guardada en .env.docker (archivo ignorado por Git)."
    Write-Host ""
    Write-Host "Para detener el contenedor:"
    Write-Host "  docker compose --env-file .env.docker -f docker-compose.postgres.yml down"
}
finally {
    Pop-Location
}
