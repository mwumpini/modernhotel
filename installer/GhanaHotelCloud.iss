#define MyAppName "AGM Sync Cloud"
#define MyAppVersion "0.1.0"
#define Dist "..\dist\GhanaHotel"

[Setup]
AppId={{B8D4E2C3-5A69-4E2B-8D7F-9C3A1B2E5F88}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=..\dist
OutputBaseFilename=AGMSync-Cloud-Premises-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
WizardStyle=modern
SetupIconFile=agm-sync.ico
InfoAfterFile=cloud\after.txt
UninstallDisplayIcon={app}\agm-sync.ico

[Files]
Source: "{#Dist}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "agm-sync.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "cloud\sync-mode.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{commondesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\agm-sync.ico"
Name: "{group}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"""; WorkingDir: "{app}"; IconFilename: "{app}\agm-sync.ico"
Name: "{commonstartup}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"" serve"; WorkingDir: "{app}"; IconFilename: "{app}\agm-sync.ico"

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\register.ps1"""; Flags: runhidden waituntilterminated
Filename: "{sys}\wscript.exe"; Parameters: """{app}\start-hidden.vbs"""; Description: "Open AGM Sync Cloud"; Flags: postinstall nowait skipifsilent

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\unregister.ps1"""; Flags: runhidden waituntilterminated
