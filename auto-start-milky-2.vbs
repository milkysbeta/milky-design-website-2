Option Explicit

Dim shell, files, projectPath, nodePath, scriptPath, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")

projectPath = files.GetParentFolderName(WScript.ScriptFullName)
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
If Not files.FileExists(nodePath) Then nodePath = "node.exe"

scriptPath = files.BuildPath(projectPath, "tools\auto-start.js")
command = Chr(34) & nodePath & Chr(34) & " " & Chr(34) & scriptPath & Chr(34)

shell.CurrentDirectory = projectPath
shell.Run command, 0, False

