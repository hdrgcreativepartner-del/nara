# NARA Android

Native Android WebView shell untuk NARA. Web assets disalin dari root repository saat build, sehingga satu codebase tetap dipakai untuk GitHub Pages/PWA dan APK.

Voice input memakai Android RecognizerIntent melalui bridge `NaraAndroid`. Respons suara memakai Android TextToSpeech.

Build lokal: `gradle -p android :app:assembleDebug`.
