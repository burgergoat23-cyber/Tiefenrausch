# Bildklicker – Startteil für Windows PowerShell 5.1.
# baue.py setzt den C#-Code unten in den Textblock ein und packt alles in Bildklicker.bat.
$ErrorActionPreference = 'Stop'
try {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    Write-Host 'Bildklicker startet ... dieses Fenster bitte offen lassen.'
    $code = @'
__CSHARP__
'@
    Add-Type -TypeDefinition $code -ReferencedAssemblies System.Windows.Forms, System.Drawing -IgnoreWarnings
    [Bildklicker.Program]::Start()
} catch {
    $msg = $_.Exception.Message
    try {
        [System.Windows.Forms.MessageBox]::Show("Der Bildklicker konnte nicht starten:`n`n$msg", 'Bildklicker') | Out-Null
    } catch {
        Write-Host "Fehler: $msg"
        Read-Host 'Zum Schliessen Enter druecken'
    }
}
