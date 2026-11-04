# Completes the native "Save as" dialog of the app with UI Automation: keeps
# the file name that the app suggests, saves into $Directory and prints the
# full path. Playwright cannot see native dialogs, only the WebView2 page.
# Finds the controls by AutomationId, not by text, so the Windows language
# does not matter.
param(
  [Parameter(Mandatory)] [int] $ProcessId,
  [Parameter(Mandatory)] [string] $Directory,
  [int] $TimeoutSeconds = 30
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes

$automation = [System.Windows.Automation.AutomationElement]
$treeScope = [System.Windows.Automation.TreeScope]
$controlType = [System.Windows.Automation.ControlType]

# Common item dialog: the file name edit and the Save button.
$fileNameEditId = '1001'
$saveButtonId = '1'

# An element with both property values.
function New-Condition {
  param($PropertyA, $ValueA, $PropertyB, $ValueB)
  [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new($PropertyA, $ValueA),
    [System.Windows.Automation.PropertyCondition]::new($PropertyB, $ValueB)
  )
}

function New-ControlCondition {
  param([string] $AutomationId, $ControlType)
  New-Condition ($automation::AutomationIdProperty) $AutomationId `
    ($automation::ControlTypeProperty) $ControlType
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
    (New-ControlCondition $fileNameEditId ($controlType::Edit)))
}
$saveButton = Wait-InDialog -Description 'Save button' -Find {
  $dialog.FindFirst($treeScope::Descendants,
    (New-ControlCondition $saveButtonId ($controlType::Button)))
}

$value = $fileNameEdit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
$suggestedName = $value.Current.Value
if ([string]::IsNullOrWhiteSpace($suggestedName)) {
  throw 'The dialog suggests no file name'
}
$path = Join-Path (Resolve-Path $Directory) $suggestedName
$value.SetValue($path)
$saveButton.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()

# The app writes the file after the dialog closed.
$null = Wait-For -Description "closed dialog" -Find {
  $null -eq $automation::RootElement.FindFirst($treeScope::Children, $dialogCondition)
}
Write-Output $path
