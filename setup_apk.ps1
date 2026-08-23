$resPath = 'C:\Users\Administrator\AndroidStudioProjects\CineNova\app\src\main\res'
$favicon = 'C:\Users\Administrator\.gemini\antigravity\scratch\CineNova\favicon.png'
$folders = 'mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'

foreach ($f in $folders) {
    Copy-Item -Path $favicon -Destination "$resPath\$f\ic_launcher.png" -Force
    Copy-Item -Path $favicon -Destination "$resPath\$f\ic_launcher_round.png" -Force
}

$keytool = 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
& $keytool -genkey -v -keystore 'C:\Users\Administrator\AndroidStudioProjects\CineNova\release.jks' -keyalg RSA -keysize 2048 -validity 10000 -alias cinenova -dname "CN=CineNova,OU=C,O=C,L=D,S=D,C=DZ" -storepass cinenova123 -keypass cinenova123
