#define MyAppName "AGM Sync"
#define MyAppVersion "0.1.0"
#define Dist "..\dist\GhanaHotel"

[Setup]
AppId={{A7C3E1B2-4F58-4D1A-9C6E-8B2F0A1D4E77}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=..\dist
OutputBaseFilename=AGMSync-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern
InfoAfterFile=after-install.txt
UninstallDisplayIcon={app}\node\node.exe

[Files]
Source: "{#Dist}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\Start Hotel System.cmd"; WorkingDir: "{app}"
Name: "{group}\{#MyAppName}"; Filename: "{app}\Start Hotel System.cmd"; WorkingDir: "{app}"
Name: "{group}\Stop {#MyAppName}"; Filename: "{app}\Stop Hotel System.cmd"; WorkingDir: "{app}"
Name: "{commonstartup}\{#MyAppName}"; Filename: "{app}\Start Hotel System.cmd"; WorkingDir: "{app}"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\register.ps1"""; Flags: runhidden waituntilterminated
Filename: "{app}\Start Hotel System.cmd"; Description: "Start the hotel system now"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\unregister.ps1"""; Flags: runhidden waituntilterminated
