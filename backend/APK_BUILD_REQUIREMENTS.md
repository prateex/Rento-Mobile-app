# APK Build Requirements - Setup Guide

Your Rento app is ready for APK compilation, but your system is missing required tools.

## Current Status
✅ React app built to `dist/`
✅ Android project created in `android/`
✅ Web assets synced to Android
⚠️ **Missing: Java Development Kit (JDK)**

## Required Installation

### Option 1: Install JDK Standalone (Recommended)

#### For Windows:

**Step 1: Download JDK 11 or 17**
- Go to https://www.oracle.com/java/technologies/downloads/
- Download "JDK 17.x.x" (or JDK 11) for Windows x64
- Run the installer

**Step 2: Set JAVA_HOME Environment Variable**
1. Open Settings → System → About → Advanced system settings
2. Click "Environment Variables"
3. Click "New..." (under User variables)
4. Variable name: `JAVA_HOME`
5. Variable value: `C:\Program Files\Java\jdk-17` (adjust version number as needed)
6. Click OK and restart your terminal

**Step 3: Verify Installation**
```powershell
java -version
javac -version
```

### Option 2: Let Android Studio Handle It

If you have Android Studio installed:
1. Open Android Studio
2. Go to Tools → SDK Manager → SDK Tools
3. Install "Android SDK Build-Tools" and "NDK"
4. Android Studio will manage JDK for you

### Option 3: Use Docker (No Local Installation)

```bash
docker run --rm -v ${PWD}:/app -w /app/android openjdk:17-slim ./gradlew assembleDebug
```

## After Installing JDK

Once JDK is installed and `JAVA_HOME` is set, run:

```bash
cd "C:\App Project\Rento App Project\Rento-App-03\Rento-App-02zip\WickedBelovedAddition-1zip\WickedBelovedAddition-1\android"
.\gradlew.bat assembleDebug
```

This will generate: `app/build/outputs/apk/debug/app-debug.apk`

## Verify Gradle Setup

Once Java is installed, verify Gradle can find it:

```bash
cd "C:\App Project\Rento App Project\Rento-App-03\Rento-App-02zip\WickedBelovedAddition-1zip\WickedBelovedAddition-1\android"
.\gradlew.bat --version
```

You should see Gradle version and Java version output.

## System Requirements Summary

| Component | Required | Purpose |
|-----------|----------|---------|
| JDK | 11+ | Compile Java/Kotlin code for Android |
| Gradle | 7.4+ | Build system (included in project) |
| Android SDK | Latest | Build Android APK |
| Android NDK | Optional | Native code compilation |

---

**Next Steps:**
1. Install JDK 17 from Oracle or use Android Studio's bundled JDK
2. Set `JAVA_HOME` environment variable
3. Restart terminal and verify with `java -version`
4. Run Gradle build command
