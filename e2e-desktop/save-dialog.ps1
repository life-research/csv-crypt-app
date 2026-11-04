# Completes the native "Save as" dialog of the app: keeps the file name that
# the app suggests, saves into $Directory and prints the full path.
# Playwright cannot see native dialogs, only the WebView2 page.
# UI Automation finds the controls by AutomationId and class name, not by
# text, so the Windows language does not matter. It shows the Win32 controls
# of the dialog only as "Pane", without Value and Invoke patterns. So the
# script uses Win32 messages on their window handles.
# Windows must show file name extensions (HideFileExt = 0). Otherwise the
# file name field has no extension, and the file is saved without one.
param(
  [Parameter(Mandatory)] [int] $ProcessId,
  [Parameter(Mandatory)] [string] $Directory,
  [int] $TimeoutSeconds = 30
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

Add-Type -Namespace E2E -Name Win32 -UsingNamespace System.Text -MemberDefinition @'
[DllImport("user32.dll", EntryPoint = "SendMessageW", CharSet = CharSet.Unicode)]
public static extern IntPtr SendString(IntPtr hWnd, uint msg, IntPtr wParam, string lParam);
[DllImport("user32.dll", EntryPoint = "SendMessageW", CharSet = CharSet.Unicode)]
public static extern IntPtr SendBuffer(IntPtr hWnd, uint msg, IntPtr wParam, StringBuilder lParam);
[DllImport("user32.dll", EntryPoint = "SendMessageW")]
public static extern IntPtr SendValue(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
[DllImport("user32.dll", EntryPoint = "PostMessageW")]
public static extern bool PostValue(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
'@

$automation = [System.Windows.Automation.AutomationElement]
$treeScope = [System.Windows.Automation.TreeScope]

# Common item dialog: the file name edit and the Save button. The address
# bar also has the AutomationId 1001, so the class name is necessary.
$fileNameEditId = '1001'
$fileNameEditClass = 'Edit'
$saveButtonId = '1'
$saveButtonClass = 'Button'

$WM_SETTEXT = 0x000C
$WM_GETTEXT = 0x000D
$WM_GETTEXTLENGTH = 0x000E
$BM_CLICK = 0x00F5

# An element with both property values.
function New-Condition {
  param($PropertyA, $ValueA, $PropertyB, $ValueB)
  [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new($PropertyA, $ValueA),
    [System.Windows.Automation.PropertyCondition]::new($PropertyB, $ValueB)
  )
}

function New-ControlCondition {
  param([string] $AutomationId, [string] $ClassName)
  New-Condition ($automation::AutomationIdProperty) $AutomationId `
    ($automation::ClassNameProperty) $ClassName
}

# The window handle of a Win32 control. Zero means: no own window.
function Get-WindowHandle {
  param($Element)
  $handle = [IntPtr] $Element.Current.NativeWindowHandle
  if ($handle -eq [IntPtr]::Zero) {
    throw "The control '$($Element.Current.AutomationId)' has no window handle"
  }
  $handle
}

function Get-WindowText {
  param([IntPtr] $Handle)
  $length = [E2E.Win32]::SendValue($Handle, $WM_GETTEXTLENGTH, [IntPtr]::Zero, [IntPtr]::Zero).ToInt32()
  $buffer = [System.Text.StringBuilder]::new($length + 1)
  $null = [E2E.Win32]::SendBuffer($Handle, $WM_GETTEXT, [IntPtr] $buffer.Capacity, $buffer)
  $buffer.ToString()
}

# Waits until $Find returns a value that is not empty or false. Fails after
# $TimeoutSeconds, with the last error of $Find.
function Wait-For {
  param([scriptblock] $Find, [string] $Description)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastError = $null
  while ($true) {
    try {
      $result = & $Find
      if ($result) {
        return $result
      }
    }
    catch {
      # While the dialog opens, its elements can disappear during the search.
      $lastError = $_
    }
    if ((Get-Date) -gt $deadline) {
      $reason = if ($lastError) { " Last error: $lastError" } else { '' }
      throw "No $Description after $TimeoutSeconds seconds.$reason"
    }
    Start-Sleep -Milliseconds 250
  }
}

# Writes the UI Automation tree below $Element to stderr, so that a failed
# test shows the real controls of the dialog.
function Write-Tree {
  param($Element, [int] $Depth = 0, [int] $MaxDepth = 8)
  $walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
  $info = $Element.Current
  $indent = '  ' * $Depth
  [Console]::Error.WriteLine(
    "$indent$($info.ControlType.ProgrammaticName) id='$($info.AutomationId)' " +
    "class='$($info.ClassName)' name='$($info.Name)'")
  if ($Depth -ge $MaxDepth) {
    return
  }
  $child = $walker.GetFirstChild($Element)
  while ($null -ne $child) {
    Write-Tree -Element $child -Depth ($Depth + 1) -MaxDepth $MaxDepth
    $child = $walker.GetNextSibling($child)
  }
}

# Like Wait-For, but writes the dialog tree before it fails.
function Wait-InDialog {
  param([scriptblock] $Find, [string] $Description)
  try {
    Wait-For -Find $Find -Description $Description
  }
  catch {
    [Console]::Error.WriteLine("== UI Automation tree of the dialog")
    try { Write-Tree -Element $dialog } catch { [Console]::Error.WriteLine("(no tree: $_)") }
    throw
  }
}

$dialogCondition = New-Condition ($automation::ProcessIdProperty) $ProcessId `
  ($automation::ClassNameProperty) '#32770'
$dialog = Wait-For -Description "'Save as' dialog of process $ProcessId" -Find {
  $automation::RootElement.FindFirst($treeScope::Children, $dialogCondition)
}

$fileNameEdit = Wait-InDialog -Description 'file name field' -Find {
  $dialog.FindFirst($treeScope::Descendants,
    (New-ControlCondition $fileNameEditId $fileNameEditClass))
}
$saveButton = Wait-InDialog -Description 'Save button' -Find {
  $dialog.FindFirst($treeScope::Descendants,
    (New-ControlCondition $saveButtonId $saveButtonClass))
}
$fileNameHandle = Get-WindowHandle $fileNameEdit
$saveButtonHandle = Get-WindowHandle $saveButton

$suggestedName = Get-WindowText $fileNameHandle
if ([string]::IsNullOrWhiteSpace($suggestedName)) {
  throw 'The dialog suggests no file name'
}
if (-not [System.IO.Path]::HasExtension($suggestedName)) {
  throw "The file name '$suggestedName' has no extension. " +
    'Windows hides file name extensions: set HideFileExt to 0.'
}
$path = Join-Path (Resolve-Path $Directory) $suggestedName
$null = [E2E.Win32]::SendString($fileNameHandle, $WM_SETTEXT, [IntPtr]::Zero, $path)
# Posted, not sent: the click closes the dialog, and the script must not
# wait for the message loop of the app.
$null = [E2E.Win32]::PostValue($saveButtonHandle, $BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)

# The app writes the file after the dialog closed.
$null = Wait-For -Description "closed dialog" -Find {
  $null -eq $automation::RootElement.FindFirst($treeScope::Children, $dialogCondition)
}
Write-Output $path
