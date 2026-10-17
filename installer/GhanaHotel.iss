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
SetupIconFile=agm-sync.ico
InfoAfterFile=after-install.txt
UninstallDisplayIcon={app}\agm-sync.ico

[Files]
Source: "{#Dist}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "agm-sync.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{commondesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\agm-sync.ico"
Name: "{group}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\agm-sync.ico"
Name: "{commonstartup}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"" serve"; WorkingDir: "{app}"; IconFilename: "{app}\agm-sync.ico"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\register.ps1"""; Flags: runhidden waituntilterminated
Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"""; Description: "Open AGM Sync"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\unregister.ps1"""; Flags: runhidden waituntilterminated
