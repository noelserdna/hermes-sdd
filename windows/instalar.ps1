# Instala hermes-sdd en Windows: WSL2 + Ubuntu y, dentro, todo lo demás (windows/preparar-ubuntu.sh).
#
#   En PowerShell COMO ADMINISTRADOR:
#   irm https://raw.githubusercontent.com/noelserdna/hermes-sdd/main/windows/instalar.ps1 | iex
#
#   o desde un clon:  powershell -ExecutionPolicy Bypass -File windows\instalar.ps1 [-NoDormir] [-Distro Ubuntu]
#
# Se puede repetir: lo que ya está hecho se salta. Pasos:
#   1. WSL2 + Ubuntu (si falta, lo instala; Windows puede pedir reiniciar y Ubuntu, crear tu usuario: luego repite)
#   2. Ubuntu en WSL2 (no WSL1)
#   3. Dentro de Ubuntu: paquetes, Node 22, Hermes, Claude Code, clon en ~/hermes-sdd e instalar.sh
#   4. Reinicia Ubuntu si hace falta para activar systemd
#   5. Tarea programada «hermes-sdd WSL» al iniciar sesión: mantiene Ubuntu (y el gateway) despierto
#   6. -NoDormir: el equipo no se suspende enchufado (una etapa dura de 10 a 30 minutos)
param(
  [string]$Distro = "Ubuntu",
  [string]$Rama = "main",
  [switch]$NoDormir
)
$ErrorActionPreference = "Stop"
$env:WSL_UTF8 = "1"   # wsl.exe -l escribe en UTF-16 si no
function Paso($t) { Write-Host "`n> $t" -ForegroundColor Cyan }
function Ok($t)   { Write-Host "  OK  $t" -ForegroundColor Green }
function Aviso($t){ Write-Host "  !   $t" -ForegroundColor Yellow }
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
  [Security.Principal.WindowsBuiltInRole]::Administrator)

Paso "1/6 WSL2 + $Distro"
$hayWsl = [bool](Get-Command wsl.exe -ErrorAction SilentlyContinue)
$distros = @()
if ($hayWsl) { $distros = (& wsl.exe -l -q 2>$null) | ForEach-Object { $_.Trim([char]0, ' ') } | Where-Object { $_ } }
if (-not ($distros -contains $Distro)) {
  if (-not $admin) { Aviso "Falta $Distro. Abre PowerShell como administrador y repite."; exit 1 }
  & wsl.exe --install -d $Distro
  Aviso "Si Windows pide reiniciar, reinicia. Despues abre '$Distro' desde el menu Inicio, crea tu usuario y contrasena, y vuelve a ejecutar este script."
  exit 0
}
Ok "$Distro instalado"

Paso "2/6 WSL2 (no WSL1)"
$kernel = (& wsl.exe -d $Distro -- uname -r) -join ""
if ($kernel -notmatch "WSL2") {
  & wsl.exe --set-version $Distro 2
  Ok "$Distro pasado a WSL2"
} else { Ok "kernel $kernel" }

Paso "3/6 Dentro de ${Distro}: dependencias, Hermes, Claude Code y hermes-sdd (puede pedir tu contrasena de Ubuntu)"
$url = "https://raw.githubusercontent.com/noelserdna/hermes-sdd/$Rama/windows/preparar-ubuntu.sh"
# Se descarga a un fichero (no curl | bash): así los instaladores que preguntan algo leen del teclado
& wsl.exe -d $Distro --cd "~" -- bash -lc "curl -fsSL $url -o /tmp/hsdd-preparar.sh && bash /tmp/hsdd-preparar.sh"
if ($LASTEXITCODE -ne 0) { Aviso "preparar-ubuntu.sh termino con error ($LASTEXITCODE). Revisa la salida de arriba."; exit $LASTEXITCODE }

Paso "4/6 systemd"
$pid1 = ((& wsl.exe -d $Distro -- ps -p 1 -o comm=) -join "").Trim()
if ($pid1 -ne "systemd") {
  & wsl.exe --terminate $Distro | Out-Null
  Ok "Ubuntu reiniciado para activar systemd"
} else { Ok "activo" }

Paso "5/6 Mantener Ubuntu despierto al iniciar sesion"
$tarea = "hermes-sdd WSL"
try {
  if (-not (Get-ScheduledTask -TaskName $tarea -ErrorAction SilentlyContinue)) {
    $accion = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d $Distro --exec sleep infinity"
    $cuando = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $ajustes = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -Hidden
    Register-ScheduledTask -TaskName $tarea -Action $accion -Trigger $cuando -Settings $ajustes `
      -Description "Mantiene $Distro (y el gateway de Hermes) en marcha para hermes-sdd" | Out-Null
  }
  Start-ScheduledTask -TaskName $tarea
  Ok "tarea '$tarea' activa"
} catch { Aviso "no pude crear la tarea programada ($($_.Exception.Message)). Ver docs/windows.md, apartado 4." }

Paso "6/6 Suspension"
if ($NoDormir) { & powercfg /change standby-timeout-ac 0; Ok "el equipo no se suspende enchufado" }
else { Aviso "Si el equipo se suspende a mitad de una etapa, se corta. Repite con -NoDormir o ajustalo en Configuracion > Energia." }

Write-Host "`nListo. Abre '$Distro' (menu Inicio o 'wsl') y sigue los pasos que haya indicado arriba." -ForegroundColor Green
Write-Host "Panel web: ejecuta 'hermes dashboard' en $Distro y abre en Windows la direccion que muestre (localhost)."
