import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const workRoot = path.join(repoRoot, "tmp", "scoutx-companion-packages");
const downloadsRoot = path.join(repoRoot, "public", "downloads");

const payloadFiles = [
  "package.json",
  "scripts/hrworks-automation-bridge.mjs",
  "scripts/hrworksAutomationBridgeConfig.js",
  "scripts/hrworksAutomationBridgeLifecycle.js",
  "scripts/hrworksAutomationBridgePages.js",
  "scripts/hrworksAutomationBridgeResponses.js",
  "scripts/hrworksAutomationBridgeSession.js",
  "e2e/helpers/hrworksAutomation.js",
  "config/hrworks.selectors.json",
];

function packageJsonForCompanion() {
  return JSON.stringify({
    name: "scoutx-companion",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      start: "node scripts/hrworks-automation-bridge.mjs",
    },
    dependencies: {
      "@playwright/test": "^1.54.2",
      playwright: "^1.54.2",
    },
  }, null, 2);
}

async function copyPayload(targetRoot) {
  const payloadRoot = path.join(targetRoot, "payload");
  await mkdir(payloadRoot, { recursive: true });
  for (const relativePath of payloadFiles) {
    const source = path.join(repoRoot, relativePath);
    const target = path.join(payloadRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    if (relativePath === "package.json") {
      await writeFile(target, packageJsonForCompanion());
    } else {
      await cp(source, target);
    }
  }
}

async function zipDirectory(sourceDir, outputPath) {
  await rm(outputPath, { force: true });
  await execFileAsync("zip", ["-qr", outputPath, "."], { cwd: sourceDir });
}

async function buildMacPackage() {
  const root = path.join(workRoot, "scoutx-companion-macos");
  await mkdir(root, { recursive: true });
  await copyPayload(root);
  await writeFile(path.join(root, "install.command"), `#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

APP_DIR="$HOME/Library/Application Support/ScoutX Companion"
LOG_DIR="$HOME/Library/Logs/ScoutX"
LABEL="com.scoutx.hrworks-companion"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
DOMAIN="gui/$(id -u)"
NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"

if [[ -z "$NODE_BIN" || -z "$NPM_BIN" ]]; then
  echo "Node.js und npm muessen installiert sein. Installiere Node.js von https://nodejs.org und starte diesen Installer erneut."
  read -r -p "Enter zum Schliessen..."
  exit 1
fi

mkdir -p "$APP_DIR" "$LOG_DIR" "$HOME/Library/LaunchAgents"
rsync -a --delete payload/ "$APP_DIR/"
cd "$APP_DIR"
"$NPM_BIN" install --no-audit --no-fund

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$APP_DIR/scripts/hrworks-automation-bridge.mjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$APP_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/hrworks-companion.out.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/hrworks-companion.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
</dict>
</plist>
PLIST

chmod 644 "$PLIST_PATH"
launchctl bootout "$DOMAIN" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST_PATH"
launchctl enable "$DOMAIN/$LABEL" >/dev/null 2>&1 || true
launchctl kickstart -k "$DOMAIN/$LABEL"

echo "ScoutX Companion wurde installiert."
curl -fsS --max-time 5 http://127.0.0.1:8791/health >/dev/null && echo "Companion ist erreichbar auf 127.0.0.1:8791."
read -r -p "Enter zum Schliessen..."
`, { mode: 0o755 });
  await writeFile(path.join(root, "uninstall.command"), `#!/usr/bin/env bash
set -euo pipefail
LABEL="com.scoutx.hrworks-companion"
DOMAIN="gui/$(id -u)"
PLIST_PATH="$HOME/Library/LaunchAgents/$LABEL.plist"
APP_DIR="$HOME/Library/Application Support/ScoutX Companion"
launchctl bootout "$DOMAIN" "$PLIST_PATH" >/dev/null 2>&1 || true
rm -f "$PLIST_PATH"
rm -rf "$APP_DIR"
echo "ScoutX Companion wurde entfernt."
read -r -p "Enter zum Schliessen..."
`, { mode: 0o755 });
  await writeFile(path.join(root, "README.txt"), [
    "ScoutX Companion fuer macOS",
    "",
    "1. ZIP entpacken.",
    "2. install.command oeffnen.",
    "3. Danach in ScoutX 'Verbindung erneut pruefen' anklicken.",
    "",
    "Der Companion laeuft lokal auf 127.0.0.1:8791 und startet per LaunchAgent beim Login.",
    "Node.js/npm muessen installiert sein.",
    "",
  ].join("\n"));
  await zipDirectory(root, path.join(downloadsRoot, "scoutx-companion-macos.zip"));
}

async function buildWindowsPackage() {
  const root = path.join(workRoot, "scoutx-companion-windows");
  await mkdir(root, { recursive: true });
  await copyPayload(root);
  await writeFile(path.join(root, "install.bat"), `@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
`);
  await writeFile(path.join(root, "uninstall.bat"), `@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall.ps1"
pause
`);
  await writeFile(path.join(root, "install.ps1"), `$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Join-Path $env:LOCALAPPDATA "ScoutX Companion"
$LogDir = Join-Path $AppDir "logs"
$Node = (Get-Command node -ErrorAction SilentlyContinue).Source
$Npm = (Get-Command npm -ErrorAction SilentlyContinue).Source
if (-not $Node -or -not $Npm) {
  Write-Host "Node.js und npm muessen installiert sein. Installiere Node.js von https://nodejs.org und starte diesen Installer erneut."
  exit 1
}
New-Item -ItemType Directory -Force -Path $AppDir, $LogDir | Out-Null
Copy-Item -Recurse -Force (Join-Path $Root "payload\\*") $AppDir
Push-Location $AppDir
& $Npm install --no-audit --no-fund
Pop-Location
$TaskName = "ScoutX HRworks Companion"
$Script = Join-Path $AppDir "scripts\\hrworks-automation-bridge.mjs"
$Action = New-ScheduledTaskAction -Execute $Node -Argument "\`"$Script\`"" -WorkingDirectory $AppDir
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel LeastPrivilege
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "ScoutX Companion wurde installiert."
Start-Sleep -Seconds 3
try {
  Invoke-RestMethod -Uri "http://127.0.0.1:8791/health" -TimeoutSec 5 | Out-Null
  Write-Host "Companion ist erreichbar auf 127.0.0.1:8791."
} catch {
  Write-Host "Companion startet noch nicht. Pruefe die Windows Aufgabenplanung und die Logs unter $LogDir."
}
`);
  await writeFile(path.join(root, "uninstall.ps1"), `$ErrorActionPreference = "Stop"
$TaskName = "ScoutX HRworks Companion"
$AppDir = Join-Path $env:LOCALAPPDATA "ScoutX Companion"
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $AppDir -ErrorAction SilentlyContinue
Write-Host "ScoutX Companion wurde entfernt."
`);
  await writeFile(path.join(root, "README.txt"), [
    "ScoutX Companion fuer Windows",
    "",
    "1. ZIP entpacken.",
    "2. install.bat oeffnen.",
    "3. Danach in ScoutX 'Verbindung erneut pruefen' anklicken.",
    "",
    "Der Companion laeuft lokal auf 127.0.0.1:8791 und startet per Windows Aufgabenplanung beim Login.",
    "Node.js/npm muessen installiert sein.",
    "",
  ].join("\n"));
  await zipDirectory(root, path.join(downloadsRoot, "scoutx-companion-windows.zip"));
}

await rm(workRoot, { recursive: true, force: true });
await mkdir(downloadsRoot, { recursive: true });
await buildMacPackage();
await buildWindowsPackage();

console.log(`Companion packages written to ${downloadsRoot}`);
