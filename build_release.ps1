Remove-Item -Path "C:\Users\Administrator\AndroidStudioProjects\CineNova\app\src\main\res\mipmap-*\*.webp" -Force
Remove-Item -Path "C:\Users\Administrator\AndroidStudioProjects\CineNova\app\src\main\res\mipmap-*\*.xml" -Force
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
Set-Location -Path "C:\Users\Administrator\AndroidStudioProjects\CineNova"
.\gradlew.bat assembleRelease
