# Checks the Windows executable before CI accepts it: the version and product
# metadata, no DLLs of extra runtimes, and that the app opens its window and
# shows its page. Saves a screenshot of the screen after the start test.
# Product name and window title come from src-tauri/tauri.conf.json.
param(
  [Parameter(Mandatory)] [string] $Path,
  [Parameter(Mandatory)] [string] $Version,
  [string] $ScreenshotPath = 'screenshots/app-start.png'
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms, System.Drawing

$config = Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json
$productName = $config.productName
$windowTitle = $config.app.windows[0].title
# The <h1> of the page shows the app title ('app.title' in src/lib/i18n),
# which is the product name in all languages.
$pageHeading = $productName

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

# Waits until $Condition is true. Fails when the app exits or after 30 seconds.
function Wait-ForApp {
  param($Process, [scriptblock] $Condition, [string] $Description)
  $deadline = (Get-Date).AddSeconds(30)
  while ($true) {
    $Process.Refresh()
    if ($Process.HasExited) {
      throw "The app exited with code $($Process.ExitCode)"
    }
    if (& $Condition) {
      return
    }
    if ((Get-Date) -gt $deadline) {
      throw "The app shows no $Description after 30 seconds"
    }
    Start-Sleep -Seconds 1
  }
}

# WebView2 gives the page content to UI Automation, as to a screen reader.
# A text on the page proves that WebView2 loaded and rendered the frontend.
function Test-PageText {
  param($Process, [string] $Text)
  $automation = [System.Windows.Automation.AutomationElement]
  $condition = [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new($automation::NameProperty, $Text),
    [System.Windows.Automation.PropertyCondition]::new(
      $automation::ControlTypeProperty, [System.Windows.Automation.ControlType]::Text)
  )
  try {
    $window = $automation::FromHandle($Process.MainWindowHandle)
    $null -ne $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
  }
  catch {
    # While the WebView loads, its elements can disappear during the search.
    $false
  }
}

# Never fails: a missing screenshot must not hide the result of the test.
function Save-Screenshot {
  param([string] $Path)
  $bitmap = $null
  $graphics = $null
  try {
    $fullPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    New-Item -ItemType Directory -Force -Path (Split-Path $fullPath) | Out-Null
    $bitmap.Save($fullPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Screenshot: $Path"
  }
  catch {
    Write-Warning "No screenshot: $_"
  }
  finally {
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
  }
}

function Assert-AppStarts {
  $process = Start-Process -FilePath $Path -PassThru
  try {
    Wait-ForApp -Process $process -Description "window '$windowTitle'" -Condition {
      $Process.MainWindowTitle -eq $windowTitle
    }
    Write-Host "The app opened the window '$windowTitle'"

    Wait-ForApp -Process $process -Description "heading '$pageHeading' on the page" -Condition {
      Test-PageText -Process $Process -Text $pageHeading
    }
    Write-Host "The page shows the heading '$pageHeading'"
  }
  finally {
    Save-Screenshot -Path $ScreenshotPath
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  }
}

Assert-VersionInfo
Assert-NoExtraRuntimes
Assert-AppStarts
