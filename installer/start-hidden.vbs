Option Explicit
Dim shell, fso, folder, extra
Set shell = CreateObject("Wscript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
extra = ""
If WScript.Arguments.Count > 0 Then
  If WScript.Arguments(0) = "serve" Then extra = " --background"
End If
shell.Run """" & folder & "\node\node.exe"" """ & folder & "\launcher.mjs""" & extra, 0, False
