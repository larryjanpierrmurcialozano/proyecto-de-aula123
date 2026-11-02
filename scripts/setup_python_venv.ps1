[CmdletBinding()]
param(
    [string]$VenvPath = ".venv",
    [string]$RequirementsPath = "requirements.txt",
    [string]$PythonCommand = "",
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedVenvPath = Join-Path $projectRoot $VenvPath
$resolvedRequirementsPath = Join-Path $projectRoot $RequirementsPath

if ([string]::IsNullOrWhiteSpace($PythonCommand)) {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        $pythonExecutable = "py"
        $pythonArguments = @()
    }
    elseif (Get-Command python -ErrorAction SilentlyContinue) {
        $pythonExecutable = "python"
        $pythonArguments = @()
    }
    else {
        throw "No se encontró Python. Instálalo y habilita 'Add python.exe to PATH'."
    }
}
else {
    if (-not (Get-Command $PythonCommand -ErrorAction SilentlyContinue)) {
        throw "No se encontró '$PythonCommand'. Instala Python y asegúrate de que esté disponible en PATH."
    }

    $pythonExecutable = $PythonCommand
    $pythonArguments = @()
}

$pythonVersion = & $pythonExecutable @pythonArguments --version 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "No fue posible ejecutar '$pythonExecutable'. Detalle: $pythonVersion"
}

$venvConfigPath = Join-Path $resolvedVenvPath "pyvenv.cfg"
if (Test-Path $venvConfigPath) {
    $homeLine = Get-Content $venvConfigPath | Where-Object { $_ -match "^home\s*=" } | Select-Object -First 1
    if ($homeLine -and $homeLine -match "^home\s*=\s*(.+)$") {
        $originalPythonHome = $Matches[1].Trim()
        if (-not (Test-Path $originalPythonHome)) {
            Write-Host "El entorno virtual apunta a una instalación que no existe en este equipo."
            Write-Host "Recreando '$resolvedVenvPath' con el Python disponible..."
            Remove-Item -LiteralPath $resolvedVenvPath -Recurse -Force
        }
    }
}

if (-not (Test-Path $resolvedVenvPath)) {
    Write-Host "Creando entorno virtual en '$resolvedVenvPath'..."
    & $pythonExecutable @pythonArguments -m venv $resolvedVenvPath
    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible crear el entorno virtual."
    }
}
else {
    Write-Host "El entorno virtual ya existe en '$resolvedVenvPath'."
}

$venvPython = Join-Path $resolvedVenvPath "Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    throw "El ejecutable del entorno virtual no fue encontrado en '$venvPython'."
}

Write-Host "Python detectado: $pythonVersion"
Write-Host "Actualizando pip..."
& $venvPython -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) {
    throw "No fue posible actualizar pip."
}

if (-not $SkipInstall) {
    if (-not (Test-Path $resolvedRequirementsPath)) {
        throw "No se encontró el archivo de dependencias '$resolvedRequirementsPath'."
    }

    Write-Host "Instalando dependencias desde '$resolvedRequirementsPath'..."
    & $venvPython -m pip install -r $resolvedRequirementsPath
    if ($LASTEXITCODE -ne 0) {
        throw "No fue posible instalar las dependencias."
    }
}

Write-Host ""
Write-Host "Entorno virtual preparado correctamente."
Write-Host "Para activarlo en PowerShell ejecuta:"
Write-Host "  .\$VenvPath\Scripts\Activate.ps1"
Write-Host ""
Write-Host "Para usar las dependencias específicas del backend:"
Write-Host "  .\scripts\setup_python_venv.ps1 -RequirementsPath backend\requirements.txt"
