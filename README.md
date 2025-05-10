sırayla çalıştır

```
git clone https://github.com/Kutay07/Crodinger.git
```

```
cd Crodinger
```

** `google-services.json` dosyasını bu dizine at **

```
npx expo prebuild
```

```
npx expo run:android
```	

build almak için 

```
cd android
```

```
./gradlew.bat assembleRelease
```

apk dosyası şu dizinde oluşur: `android/app/build/outputs/apk/release/app-release.apk`

