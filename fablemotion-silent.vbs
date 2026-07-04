' Starts the FABLEMOTION director bridge with no visible window.
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "node bridge.mjs", 0, False
