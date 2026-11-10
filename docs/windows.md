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
     perl openssl`, Node 22, Hermes Agent y Claude Code, activa systemd y clona el arnés en `~/hermes-sdd`.
   - Crea la tarea programada **«hermes-sdd WSL»**, que mantiene Ubuntu encendido mientras tienes la sesión abierta.
     Sin ella, WSL apaga Ubuntu al cerrar la última ventana y con él el gateway: dejarían de llegarte las puertas.
   - Con `-NoDormir` (desde un clon: `powershell -ExecutionPolicy Bypass -File windows\instalar.ps1 -NoDormir`),
     además impide que el equipo se suspenda enchufado. Una etapa dura entre 10 y 30 minutos y la suspensión la corta.
5. Lo que el script no puede hacer por ti, porque son tus claves. Abre «Ubuntu» y:

   ```bash
   # 1. Configura Hermes (modelo, clave del proveedor y Telegram en el gateway) siguiendo su guía
   hermes config set kanban.auto_decompose false
   claude                                   # inicia sesión en Claude Code una vez
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
   curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash      # Hermes Agent
   curl -fsSL https://claude.ai/install.sh | bash                          # Claude Code
   printf '[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf             # el gateway como servicio
   ```

   Reinicia Ubuntu para activar systemd: en PowerShell, `wsl --shutdown`.
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

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `$'\r': command not found` al ejecutar un `.sh` | El fichero tiene finales de línea de Windows (CRLF). Clona desde Ubuntu, no desde Windows, con `git config --global core.autocrlf input`. |
| Todo va muy lento | El repo está en `/mnt/c/…`. Muévelo a `~`. |
| No llegan las puertas por Telegram | Ubuntu se apagó. Comprueba que la tarea «hermes-sdd WSL» está activa (Programador de tareas) y ejecuta `hermes gateway restart`. |
| Una etapa se corta a la mitad | El equipo se suspendió. Repite `instalar.ps1 -NoDormir` o desactiva la suspensión enchufado. |
| `Executable doesn't exist … ms-playwright` | Falta el navegador de Playwright. En el proyecto: `npx playwright install --with-deps chromium`. |
| `wsl -l -v` muestra versión 1 | `wsl --set-version Ubuntu 2`. |

## ¿Y sin WSL, en Windows "nativo"?

No está soportado. Hermes sí funciona en Windows nativo, pero allí guarda sus datos en `%LOCALAPPDATA%\hermes` en vez
de `~/.hermes` y el kanban tiene incidencias abiertas (workers que se cuelgan). Además, tres piezas del arnés dependen
de un sistema POSIX:

- `executors/claude.sh` vigila a Claude con grupos de procesos POSIX. En Git Bash no llegan a los procesos nativos de
  Windows, que quedarían huérfanos.
- El plugin (`plugin/hermes-sdd/hsdd_nucleo.py`) usa `fcntl.flock`, que no existe en Windows: no cargaría.
- `instalar.sh` usa `rsync` y enlaces simbólicos. Git for Windows no trae `rsync` y convierte los enlaces en copias.

WSL2 da lo mismo sin tocar nada de eso.
