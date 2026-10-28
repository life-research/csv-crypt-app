# Checks the Windows executable before CI accepts it: the version and product
# metadata, no DLLs of extra runtimes, and that the app opens its window.
# Product name and window title come from src-tauri/tauri.conf.json.
param(
  [Parameter(Mandatory)] [string] $Path,
  [Parameter(Mandatory)] [string] $Version
)
$ErrorActionPreference = 'Stop'

$config = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
$productName = $config.productName
$windowTitle = $config.app.windows[0].title

function Assert-VersionInfo {
  $info = (Get-Item $Path).VersionInfo
  $expected = [ordered]@{
    ProductName    = $productName
    ProductVersion = $Version
    FileVersion    = $Version
  }
  foreach ($field in $expected.Keys) {
    if ($info.$field -ne $expected[$field]) {
      throw "$field is '$($info.$field)', expected '$($expected[$field])'"
    }
  }
  foreach ($field in 'CompanyName', 'LegalCopyright') {
    if ([string]::IsNullOrWhiteSpace($info.$field)) {
      throw "$field is empty"
    }
  }
  Write-Host "Version info: $($info.ProductName) $($info.ProductVersion), $($info.CompanyName)"
}

function Get-DllDependencies {
  $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  $dumpbin = & $vswhere -latest -products * -find 'VC\Tools\MSVC\**\bin\Hostx64\x64\dumpbin.exe' |
    Select-Object -First 1
  if (-not $dumpbin) {
    throw 'dumpbin.exe not found'
  }
  $output = & $dumpbin /nologo /dependents $Path
  if ($LASTEXITCODE -ne 0) {
    throw "dumpbin failed with exit code $LASTEXITCODE"
  }
  $output | ForEach-Object { $_.Trim() } | Where-Object { $_ -match '\.dll$' }
}

# A clean Windows has neither the Visual C++ runtime nor the WebView2 loader.
# The Universal C runtime (api-ms-win-crt-*.dll) is part of Windows 10 and
# later, so the executable may use it.
function Assert-NoExtraRuntimes {
  $dependencies = Get-DllDependencies
  $extra = $dependencies | Where-Object { $_ -match '^(vcruntime|msvcp|concrt|webview2loader)' }
  if ($extra) {
    throw "The executable needs extra runtime DLLs: $($extra -join ', ')"
  }
  Write-Host "DLL dependencies: $($dependencies -join ', ')"
}

function Assert-AppStarts {
  $process = Start-Process -FilePath $Path -PassThru
  try {
    $deadline = (Get-Date).AddSeconds(30)
    do {
      Start-Sleep -Seconds 1
      $process.Refresh()
      if ($process.HasExited) {
        throw "The app exited with code $($process.ExitCode)"
      }
    } until ($process.MainWindowTitle -eq $windowTitle -or (Get-Date) -gt $deadline)
    if ($process.MainWindowTitle -ne $windowTitle) {
      throw "The app has no window '$windowTitle' after 30 seconds"
    }
    Write-Host "The app started with the window '$windowTitle'"
  }
  finally {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
}

Assert-VersionInfo
Assert-NoExtraRuntimes
Assert-AppStarts
