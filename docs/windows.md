# hermes-sdd en Windows

En Windows, hermes-sdd funciona dentro de **WSL2** (*Windows Subsystem for Linux*): un Ubuntu real que corre dentro de
Windows. Ahí Hermes, Claude Code y los scripts se comportan igual que en Linux o macOS. Tus proyectos viven en ese
Ubuntu, y Telegram y el panel web se usan desde Windows como siempre.

```
 Windows ──────────────────────────────────────────────────────────┐
 │  navegador (panel web, localhost)        Telegram (móvil o PC)  │
 │                                                                 │
 │  ┌─ WSL2 · Ubuntu ───────────────────────────────────────────┐  │
 │  │  Hermes (gateway + kanban)   Claude Code   hermes-sdd     │  │
 │  │  ~/hermes-sdd   ~/.hermes   ~/proyectos/…                 │  │
 │  └───────────────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────────┘
```

## Instalación automática (recomendada)

1. Abre **PowerShell como administrador** (menú Inicio → escribe «PowerShell» → clic derecho → *Ejecutar como
   administrador*).
2. Pega:

   ```powershell
   irm https://raw.githubusercontent.com/noelserdna/hermes-sdd/main/windows/instalar.ps1 | iex
   ```

3. **Si es la primera vez que usas WSL**, Windows instala Ubuntu y puede pedirte reiniciar. Después abre «Ubuntu» desde
   el menú Inicio, elige un usuario y una contraseña (la de `sudo`, apúntala) y **vuelve a ejecutar el paso 2**.
4. El script hace el resto. Puedes repetirlo cuando quieras: lo que ya está hecho se salta.
   - Comprueba que Ubuntu está en WSL2.
   - Dentro de Ubuntu ([`windows/preparar-ubuntu.sh`](../windows/preparar-ubuntu.sh)): instala `git jq rsync python3
     perl openssl`, Node 22, **Docker** (la caja donde trabaja el agente; en macOS es Apple container), Hermes Agent y
     Claude Code; activa systemd, **quita de Ubuntu el PATH de Windows** (si no, puede colarse el `node` o el `docker`
     de Windows) y clona el arnés en `~/hermes-sdd`. Te avisa si git no sabe quién eres.
   - Crea la tarea programada **«hermes-sdd WSL»**, que mantiene Ubuntu encendido mientras tienes la sesión abierta.
     Sin ella, WSL apaga Ubuntu al cerrar la última ventana y con él el gateway: dejarían de llegarte las puertas.
   - Con `-NoDormir` (desde un clon: `powershell -ExecutionPolicy Bypass -File windows\instalar.ps1 -NoDormir`),
     además impide que el equipo se suspenda enchufado. Una etapa dura entre 10 y 30 minutos y la suspensión la corta.
5. Lo que el script no puede hacer por ti, porque son tus claves. Abre «Ubuntu» y:

   ```bash
   # 1. Configura Hermes (modelo, clave del proveedor y Telegram en el gateway) siguiendo su guía
   hermes config set kanban.auto_decompose false
   git config --global user.name "Tu nombre"; git config --global user.email "tu@correo"   # si te lo avisó
   claude                                   # inicia sesión en Claude Code una vez
   claude setup-token                       # el token de la caja: copia la cadena sk-ant-oat01-…
   bash ~/hermes-sdd/caja-token.sh          # y pégala aquí (no se ve); queda en ~/.hermes/hermes-sdd/caja-token (600)
   cd ~/hermes-sdd && bash instalar.sh      # perfiles, plugin y aprobadores.json
   hermes gateway restart
   bash tests/todo.sh                       # todas las pruebas, sin LLM: deben salir "ok"
   ```

## Instalación a mano

Lo mismo, paso a paso, por si prefieres ver cada comando.

1. **WSL2 + Ubuntu.** En PowerShell como administrador: `wsl --install -d Ubuntu`. Reinicia si te lo pide y crea tu
   usuario. Comprueba la versión con `wsl -l -v` (debe poner **2**; Hermes no funciona bien en WSL1).
2. **Dentro de Ubuntu:**

   ```bash
   sudo apt update && sudo apt install -y git jq rsync python3 perl openssl curl
   # Node 22. El de apt en Ubuntu 24.04 es el 18: el arnés funciona con él, pero Playwright (capturas y vídeos de las demos) no
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
   sudo apt install -y docker.io && sudo usermod -aG docker $USER          # la caja del agente
   curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --non-interactive   # Hermes Agent
   curl -fsSL https://claude.ai/install.sh | bash                          # Claude Code
   printf '[boot]\nsystemd=true\n[interop]\nappendWindowsPath=false\n' | sudo tee -a /etc/wsl.conf   # servicio y PATH limpio
   ```

   Reinicia Ubuntu para que se aplique: en PowerShell, `wsl --terminate Ubuntu`. El instalador de Hermes, sin
   `--non-interactive`, abre su asistente y se queda esperando (la configuración se hace después).
3. **El arnés**: clónalo **dentro de tu home de Ubuntu**, no en `/mnt/c/...`. El disco de Windows es entre 10 y 100
   veces más lento desde WSL y en él `chmod 600` no protege tus claves (el instalador avisa si lo detecta).

   ```bash
   git config --global core.autocrlf input
   cd ~ && git clone https://github.com/noelserdna/hermes-sdd && cd hermes-sdd
   ```

   Después, el paso 5 de la instalación automática.
4. **Ubuntu siempre encendido:** crea en el Programador de tareas de Windows una tarea «al iniciar sesión» que ejecute
   `wsl.exe -d Ubuntu --exec sleep infinity`. Para el gateway como servicio de usuario, sigue la guía de Hermes para
   WSL (<https://hermes-agent.nousresearch.com/docs/user-guide/windows-wsl-quickstart>) y ejecuta
   `sudo loginctl enable-linger $USER`.
5. **Suspensión:** Configuración → Sistema → Energía → *Suspender cuando está enchufado: Nunca*, o
   `powercfg /change standby-timeout-ac 0`. En macOS el ejecutor usa `caffeinate`, pero en Linux no existe.

## En el día a día

- **Abrir Ubuntu:** menú Inicio → «Ubuntu», o escribe `wsl` en cualquier terminal.
- **Tus proyectos**, siempre en Ubuntu, por ejemplo `~/proyectos/mi-app`. Desde el Explorador de Windows los ves en
  `\\wsl$\Ubuntu\home\<tu-usuario>`. VS Code los abre con la extensión *WSL* (`code .` desde Ubuntu).
- **Panel web:** `hermes dashboard` en Ubuntu, y en el navegador de Windows abre la dirección que muestre
  (`http://localhost:…`). Si no carga, añade `networkingMode=mirrored` en la sección `[wsl2]` de
  `%UserProfile%\.wslconfig` (Windows 11) y ejecuta `wsl --shutdown`.
- **Playwright** (capturas y vídeos de las demos) necesita su navegador y unas librerías del sistema. Dentro de cada
  proyecto, después de `npm install`: `npx playwright install --with-deps chromium`. La versión del navegador debe
  coincidir con la de Playwright del proyecto, por eso se instala ahí y no de forma global.

## Manejarlo desde otro ordenador por SSH

Si el Windows hace de servidor (Hermes y las etapas allí; tú, o tu Claude Code, en otro ordenador):

1. En PowerShell como administrador, el servidor SSH de Windows y tu clave (con un usuario administrador, la clave va
   en un fichero aparte con permisos estrictos):

   ```powershell
   Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
   Start-Service sshd; Set-Service sshd -StartupType Automatic
   Add-Content C:\ProgramData\ssh\administrators_authorized_keys "<tu clave pública>"
   icacls C:\ProgramData\ssh\administrators_authorized_keys /inheritance:r /grant "*S-1-5-32-544:F" /grant "*S-1-5-18:F"
   # que «ssh» entre directo en Ubuntu, no en cmd:
   New-ItemProperty -Path HKLM:\SOFTWARE\OpenSSH -Name DefaultShell -Value C:\Windows\System32\bash.exe -PropertyType String -Force
   New-ItemProperty -Path HKLM:\SOFTWARE\OpenSSH -Name DefaultShellCommandOption -Value "-c" -PropertyType String -Force
   ```

2. Trampas de ese montaje:
   - `bash.exe` sustituye las `$VARIABLES` antes de que las vea bash: manda los scripts por la entrada,
     `ssh pc 'bash -s' <<'FIN' … FIN`.
   - `scp` no sirve (usa el sftp de Windows): copia con `ssh pc 'cat > fichero' < fichero` o con `rsync`.
   - Lo que dejes en segundo plano muere si WSL apaga Ubuntu: por eso la tarea «hermes-sdd WSL».
   - Con `sudo` sin contraseña para tu usuario (`/etc/sudoers.d/…`) se puede instalar sin estar delante.

## Llevarte Hermes de otro ordenador

Instala como arriba y copia, sin secretos: `~/.hermes/config.yaml`, `SOUL.md`, `memories/` y de
`~/.hermes/hermes-sdd/`: `lecciones/`, `aprobadores.json`, `jev.json`, `mantenimiento.json`, `sdd.json`, `actas/` y
`puertas/`. Después:
- en `aprobadores.json`, el canal `local` y `dashboard` son tu usuario **de Ubuntu** (no el del otro ordenador);
- `encargados.json` apunta a las carpetas de los proyectos del otro ordenador: no lo copies (o déjalo en `{}`);
- en `.env`, quita lo que solo valía allí (rutas `/Users/…`, `TERMINAL_ENV=docker` si no lo usas);
- los secretos (`.env`, `auth.json`) por un canal seguro, con permisos 600; el token de la caja, con `caja-token.sh`;
- un bot de Telegram solo admite **un** gateway: para el del otro ordenador antes de arrancar este.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `$'\r': command not found` al ejecutar un `.sh` | El fichero tiene finales de línea de Windows (CRLF). Clona desde Ubuntu, no desde Windows, con `git config --global core.autocrlf input`. |
| Todo va muy lento | El repo está en `/mnt/c/…`. Muévelo a `~`. |
| No llegan las puertas por Telegram | Ubuntu se apagó. Comprueba que la tarea «hermes-sdd WSL» está activa (Programador de tareas) y ejecuta `hermes gateway restart`. |
| Una etapa se corta a la mitad | El equipo se suspendió. Repite `instalar.ps1 -NoDormir` o desactiva la suspensión enchufado. |
| `Executable doesn't exist … ms-playwright` | Falta el navegador de Playwright. En el proyecto: `npx playwright install --with-deps chromium`. |
| `wsl -l -v` muestra versión 1 | `wsl --set-version Ubuntu 2`. |
| Una etapa falla: «no hay token de Claude para la caja» | `claude setup-token` y `bash ~/hermes-sdd/caja-token.sh`. |
| La caja falla con «Permission denied» en `/salida` | Arnés anterior al 20/11/2026: actualiza (`git pull && bash instalar.sh`); la imagen se construye ahora con tu uid. |
| Un proyecto nuevo falla: «git no sabe quién eres» | `git config --global user.name "…"` y `user.email "…"`. |
| `echo $PATH` en Ubuntu tiene rutas `/mnt/c/…` | Falta `appendWindowsPath=false` en `/etc/wsl.conf` (lo pone `preparar-ubuntu.sh`); `wsl --terminate Ubuntu`. |

## ¿Y sin WSL, en Windows "nativo"?

No está soportado. Hermes sí funciona en Windows nativo, pero allí guarda sus datos en `%LOCALAPPDATA%\hermes` en vez
de `~/.hermes` y el kanban tiene incidencias abiertas (workers que se cuelgan). Además, tres piezas del arnés dependen
de un sistema POSIX:

- `executors/claude.sh` vigila a Claude con grupos de procesos POSIX. En Git Bash no llegan a los procesos nativos de
  Windows, que quedarían huérfanos.
- El plugin (`plugin/hermes-sdd/hsdd_nucleo.py`) usa `fcntl.flock`, que no existe en Windows: no cargaría.
- `instalar.sh` usa `rsync` y enlaces simbólicos. Git for Windows no trae `rsync` y convierte los enlaces en copias.

WSL2 da lo mismo sin tocar nada de eso.
