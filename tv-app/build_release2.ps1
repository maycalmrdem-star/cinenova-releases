$resPath = 'C:\Users\Administrator\AndroidStudioProjects\CineNova\app\src\main\res'
$icon = 'C:\Users\Administrator\.gemini\antigravity\scratch\CineNova\app-promo.png'
$folders = 'mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'

foreach ($f in $folders) {
    Copy-Item -Path $icon -Destination "$resPath\$f\ic_launcher.png" -Force
    Copy-Item -Path $icon -Destination "$resPath\$f\ic_launcher_round.png" -Force
}

Remove-Item -Path "$resPath\mipmap-anydpi-v26" -Recurse -Force -ErrorAction SilentlyContinue

$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
Set-Location -Path "C:\Users\Administrator\AndroidStudioProjects\CineNova"
.\gradlew.bat clean assembleRelease
