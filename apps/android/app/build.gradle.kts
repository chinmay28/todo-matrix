plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// The app is the web app itself, carried inside the APK: `npm run
// build:android` in the repository root (the PWA bundle without its service
// worker) is copied into assets/web/ and served from there by
// WebViewAssetLoader. There is no server and no network.
//
//   -PwebBuild=false     do not run npm; use the dist-android/ already built
//                        (CI builds the web app first, then the APK)
//   -PnpmCommand=/p/npm  the npm command, if it is not on PATH
//   -PappVersionName=v2026.11.40 -PappVersionCode=40
//                        the release's version and commit count (release.yml)
val repoRoot = rootProject.projectDir.resolve("../..").canonicalFile
val runWebBuild = (findProperty("webBuild") as String?) != "false"
val npmCommand = (findProperty("npmCommand") as String?) ?: "npm"
val webDist = repoRoot.resolve("dist-android")
val webAssets = layout.buildDirectory.dir("generated/webAssets")

android {
    namespace = "io.github.chinmay28.todomatrix"
    compileSdk = 35

    defaultConfig {
        applicationId = "io.github.chinmay28.todomatrix"
        // Android 10: scoped storage and MediaStore.Downloads, so saving a
        // backup needs no storage permission.
        minSdk = 29
        targetSdk = 35
        // Stamped by the release workflow: the release's version as the
        // name, its commit count (which only grows) as the code.
        versionCode = (findProperty("appVersionCode") as String?)?.toInt() ?: 1
        versionName = (findProperty("appVersionName") as String?) ?: "dev"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Signed with the release key when the build is handed one (the
            // release workflow decodes it from the ANDROID_KEYSTORE_* secrets),
            // so every release installs over the last. Without one, the debug
            // key: it sideloads, but it differs from machine to machine, so an
            // APK signed with it never installs over one built elsewhere.
            signingConfig = System.getenv("ANDROID_KEYSTORE")?.takeIf { it.isNotEmpty() }?.let { path ->
                signingConfigs.create("release") {
                    storeFile = file(path)
                    storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                    keyAlias = System.getenv("ANDROID_KEY_ALIAS")?.takeIf { it.isNotEmpty() } ?: "harbor"
                    keyPassword = System.getenv("ANDROID_KEY_PASSWORD")?.takeIf { it.isNotEmpty() }
                        ?: System.getenv("ANDROID_KEYSTORE_PASSWORD")
                }
            } ?: signingConfigs.getByName("debug")
        }
    }

    sourceSets["main"].assets.srcDir(webAssets)

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    lint {
        disable += setOf(
            // allowBackup is off; there is nothing for fullBackupContent to say.
            "DataExtractionRules",
            // Versions move on purpose, together, not whenever lint notices.
            "GradleDependency",
        )
    }
}

val buildWebBundle = tasks.register<Exec>("buildWebBundle") {
    description = "Builds the web app for the APK (npm run build:android)"
    workingDir = repoRoot
    commandLine(npmCommand, "run", "build:android")
    outputs.dir(webDist)
    // The bundle carries the version, which comes from git, not from any
    // input Gradle can see — so never trust a previous run. Vite takes a
    // second or two.
    outputs.upToDateWhen { false }
}

val copyWebBundle = tasks.register<Sync>("copyWebBundle") {
    description = "Copies the web bundle into the APK's assets/web/"
    if (runWebBuild) dependsOn(buildWebBundle)
    from(webDist)
    into(webAssets.map { it.dir("web") })
    doFirst {
        // Without it the APK installs and shows nothing; fail here instead.
        if (!webDist.resolve("index.html").isFile) {
            throw GradleException(
                "no web bundle at $webDist — run `npm ci && npm run build:android` in ${repoRoot.path}" +
                    (if (runWebBuild) "" else " (or drop -PwebBuild=false to let Gradle run it)"),
            )
        }
        // A plain `npm run build` has a service worker, which inside the APK
        // would only be a second cache that could serve a stale bundle.
        if (webDist.resolve("sw.js").exists()) {
            throw GradleException("$webDist has a service worker — it is a PWA build; use `npm run build:android`")
        }
    }
}
tasks.named("preBuild") { dependsOn(copyWebBundle) }

dependencies {
    implementation(project(":core"))
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("com.google.android.material:material:1.12.0")
}
