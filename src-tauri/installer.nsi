!include "MUI2.nsh"
!include "x64.nsh"

Name "DestTraky"
OutFile "../release/DestTraky_1.0.0_x64-setup.exe"
Unicode True
SetCompressor /SOLID lzma
InstallDir "$LOCALAPPDATA\Programs\DestTraky"
InstallDirRegKey HKCU "Software\DestTraky" "InstallDir"
RequestExecutionLevel user

!define MUI_ABORTWARNING
!define MUI_ICON "icons/icon.ico"
!define MUI_UNICON "icons/icon.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\DestTraky.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch DestTraky"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

Section "DestTraky" SecMain
  SectionIn RO
  SetOutPath "$INSTDIR"

  File "/oname=DestTraky.exe" "../target/x86_64-pc-windows-msvc/release/pulsetrack.exe"
  File "/oname=icon.ico" "icons/icon.ico"

  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Start Menu & Desktop Shortcuts
  CreateDirectory "$SMPROGRAMS\DestTraky"
  CreateShortCut "$SMPROGRAMS\DestTraky\DestTraky.lnk" "$INSTDIR\DestTraky.exe" "" "$INSTDIR\icon.ico"
  CreateShortCut "$SMPROGRAMS\DestTraky\Uninstall DestTraky.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\icon.ico"
  CreateShortCut "$DESKTOP\DestTraky.lnk" "$INSTDIR\DestTraky.exe" "" "$INSTDIR\icon.ico"

  ; Add/Remove Programs (Per-User HKCU)
  WriteRegStr HKCU "Software\DestTraky" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky" "DisplayName" "DestTraky"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky" "Publisher" "DestTraky"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky" "NoRepair" 1
SectionEnd

Section "Uninstall"
  Delete "$INSTDIR\DestTraky.exe"
  Delete "$INSTDIR\icon.ico"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$DESKTOP\DestTraky.lnk"
  Delete "$SMPROGRAMS\DestTraky\DestTraky.lnk"
  Delete "$SMPROGRAMS\DestTraky\Uninstall DestTraky.lnk"
  RMDir "$SMPROGRAMS\DestTraky"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DestTraky"
  DeleteRegKey HKCU "Software\DestTraky"
SectionEnd
