Remove-Item -Path "C:\Users\Administrator\AndroidStudioProjects\CineNova\app\src\main\res\mipmap-*\*.png" -Force
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
Set-Location -Path "C:\Users\Administrator\AndroidStudioProjects\CineNova"
.\gradlew.bat clean assembleRelease
