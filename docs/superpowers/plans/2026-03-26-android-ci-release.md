# Android Signed Release CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that builds a signed release APK whenever a `v*` tag is pushed and attaches it to a GitHub Release.

**Architecture:** Two files change — `android/app/build.gradle` gains a signing config that reads credentials from env vars, and a new workflow YAML orchestrates the full build pipeline (Node → Vite → cap sync → Gradle → GitHub Release).

**Tech Stack:** GitHub Actions, Gradle (Groovy DSL), AGP 8.13.0, JDK 17, `softprops/action-gh-releases@v2`

---

## Files touched

| File | Change |
|------|--------|
| `android/app/build.gradle` | Add `signingConfigs.release` block; wire into `buildTypes.release` |
| `.github/workflows/android-release.yml` | New workflow file |

---

## Task 1: Add Gradle signing config

**Files:**
- Modify: `android/app/build.gradle:19-24` (the `buildTypes` block)

- [ ] **Step 1: Add `signingConfigs` block before `buildTypes`**

Open `android/app/build.gradle`. The current `android { }` block looks like this:

```gradle
android {
    namespace = "com.droneblast.app"
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig { ... }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

Insert a `signingConfigs` block **between** `defaultConfig` and `buildTypes`, and add `signingConfig` to the release build type, so it becomes:

```gradle
android {
    namespace = "com.droneblast.app"
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.droneblast.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 1
        versionName "1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions {
            ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
        }
    }
    signingConfigs {
        release {
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("STORE_PASSWORD") ?: ""
            keyAlias System.getenv("KEY_ALIAS") ?: ""
            keyPassword System.getenv("KEY_PASSWORD") ?: ""
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

- [ ] **Step 2: Verify Gradle can parse the file**

```bash
cd /Users/szymonkocot/Projects/fpv-blast/android && ./gradlew tasks --quiet 2>&1 | head -20
```

Expected: list of tasks printed, no `BUILD FAILED` or syntax errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/szymonkocot/Projects/fpv-blast
git add android/app/build.gradle
git commit -m "feat: add Gradle release signing config from env vars"
```

---

## Task 2: Create GitHub Actions release workflow

**Files:**
- Create: `.github/workflows/android-release.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/android-release.yml` with this exact content:

```yaml
name: Android Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - name: Install dependencies
        run: npm ci --legacy-peer-deps

      - name: Build web app
        run: npm run build

      - name: Sync Capacitor
        run: npx cap sync android

      - name: Decode keystore
        run: echo "${{ secrets.KEYSTORE_BASE64 }}" | base64 --decode > /tmp/drone-blast.keystore

      - name: Build release APK
        working-directory: android
        run: ./gradlew assembleRelease
        env:
          KEYSTORE_PATH: /tmp/drone-blast.keystore
          STORE_PASSWORD: ${{ secrets.STORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}

      - name: Upload APK to GitHub Release
        uses: softprops/action-gh-releases@v2
        with:
          files: android/app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 2: Verify YAML is valid**

```bash
cd /Users/szymonkocot/Projects/fpv-blast && npx js-yaml .github/workflows/android-release.yml > /dev/null && echo "YAML valid"
```

Expected: `YAML valid` printed, no errors. (If `js-yaml` isn't available, just visually inspect indentation.)

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/android-release.yml
git commit -m "feat: add GitHub Actions workflow for signed Android release APK"
```

---

## Final verification

- [ ] Push the commits and create a test tag:

```bash
git push origin main
git tag v0.5
git push origin v0.5
```

- [ ] Go to **GitHub → Actions** tab and watch the `Android Release` workflow run.
- [ ] After ~5 minutes, check **GitHub → Releases** — a release named `v0.5` should appear with `app-release.apk` attached.
- [ ] Download and verify the APK installs on an Android device or emulator.
