# Shows why the CDP port of the desktop app did not open. Only for the
# output of a failed test run: it writes text and never fails.
param(
  [Parameter(Mandatory)] [int] $ProcessId,
  [Parameter(Mandatory)] [string] $UserDataFolder
)

$ErrorActionPreference = 'Continue'

Write-Output "== App process $ProcessId"
Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" |
  Format-List ProcessId, Name, CommandLine | Out-String -Width 4096

# The command line shows if WebView2 received --remote-debugging-port and
# --user-data-dir from the environment variables.
Write-Output '== All WebView2 processes'
$webViews = @(Get-CimInstance Win32_Process -Filter "Name = 'msedgewebview2.exe'")
if ($webViews.Count -eq 0) {
  Write-Output '(none)'
}
$webViews | Format-List ProcessId, ParentProcessId, CommandLine |
  Out-String -Width 4096

Write-Output '== TCP ports that WebView2 processes listen on'
$ids = $webViews | ForEach-Object { $_.ProcessId }
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $ids -contains $_.OwningProcess } |
  Format-Table LocalAddress, LocalPort, OwningProcess | Out-String -Width 4096

# An empty folder means that WebView2 did not use WEBVIEW2_USER_DATA_FOLDER.
Write-Output "== Content of $UserDataFolder"
Get-ChildItem -Path $UserDataFolder -Recurse -Depth 1 -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty FullName
