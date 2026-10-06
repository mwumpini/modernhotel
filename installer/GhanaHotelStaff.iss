#define MyAppName "Ghana Hotel Staff"
#define MyAppVersion "0.1.0"

[Setup]
AppId={{B8E4F2C3-5A69-4E2B-8D7F-9C3A1B2E5F88}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
DefaultDirName={localappdata}\{#MyAppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=GhanaHotel-Staff-Setup
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
WizardStyle=modern
InfoAfterFile=staff-after.txt
UninstallDisplayName={#MyAppName}

[Files]
Source: "staff-after.txt"; DestDir: "{app}"; Flags: ignoreversion

[UninstallDelete]
Type: files; Name: "{userdesktop}\Ghana Hotel.url"
Type: files; Name: "{userprograms}\Ghana Hotel Staff\Ghana Hotel.url"
Type: dirifempty; Name: "{userprograms}\Ghana Hotel Staff"

[Code]
var
  UrlPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  UrlPage := CreateInputQueryPage(wpWelcome,
    'Office computer',
    'Where is the hotel system running?',
    'On the office computer, look at the Ghana Hotel System window and type the address shown there. Then click Next.');
  UrlPage.Add('Address:', False);
  UrlPage.Values[0] := 'http://192.168.1.20:3000';
end;

function NormalizeUrl(const Value: String): String;
var
  Url: String;
begin
  Url := Trim(Value);
  if (Length(Url) >= 8) and (CompareText(Copy(Url, 1, 8), 'https://') = 0) then
    Result := Url
  else if (Length(Url) >= 7) and (CompareText(Copy(Url, 1, 7), 'http://') = 0) then
    Result := Url
  else
    Result := 'http://' + Url;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  Url: String;
begin
  Result := True;
  if CurPageID = UrlPage.ID then
  begin
    Url := NormalizeUrl(UrlPage.Values[0]);
    if (Url = 'http://') or (Pos(' ', Url) > 0) then
    begin
      MsgBox('Type the address from the Ghana Hotel System window on the office computer.', mbError, MB_OK);
      Result := False;
    end
    else
      UrlPage.Values[0] := Url;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Body: String;
  ProgramsDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    Body := '[InternetShortcut]' + #13#10 + 'URL=' + UrlPage.Values[0] + #13#10;
    ProgramsDir := ExpandConstant('{userprograms}\Ghana Hotel Staff');
    ForceDirectories(ProgramsDir);
    SaveStringToFile(ExpandConstant('{app}\Ghana Hotel.url'), Body, False);
    SaveStringToFile(ExpandConstant('{userdesktop}\Ghana Hotel.url'), Body, False);
    SaveStringToFile(ProgramsDir + '\Ghana Hotel.url', Body, False);
  end;
end;
