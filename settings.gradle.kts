pluginManagement {
  repositories {
    // Google Maven first, scoped to its own groups: androidx resolves there and never reaches
    // Central or the plugin portal, which answer a miss with HTTP 429 under load instead of the 404
    // that would have moved on. Same layout as yschimke/m3-catalog.
    google {
      mavenContent {
        includeGroupAndSubgroups("androidx")
        includeGroupAndSubgroups("com.android")
        includeGroupAndSubgroups("com.google")
      }
    }
    gradlePluginPortal()
    mavenCentral()
  }
}

// The androidx.dev snapshot build the Android lane renders, pinned in gradle/libs.versions.toml.
// Read from the file because a settings script has no version-catalog accessors.
val androidxSnapshotBuild: String =
  file("gradle/libs.versions.toml").readLines().firstNotNullOf {
    Regex("""^androidxSnapshotBuild\s*=\s*"(\d+)"""").find(it)?.groupValues?.get(1)
  }

dependencyResolutionManagement {
  repositories {
    google {
      mavenContent {
        includeGroupAndSubgroups("androidx")
        includeGroupAndSubgroups("com.android")
        includeGroupAndSubgroups("com.google")
      }
    }
    mavenCentral()
    // ONE pinned AndroidX snapshot build, never `latest` — and SNAPSHOT versions only, so nothing
    // on
    // the desktop lane can resolve from it.
    maven("https://androidx.dev/snapshots/builds/$androidxSnapshotBuild/artifacts/repository") {
      mavenContent {
        snapshotsOnly()
        includeGroupAndSubgroups("androidx")
      }
    }
  }
}

rootProject.name = "compose-ui-samples"

// The AndroidX Compose samples — every `androidx.compose` sample tree except material3 — published
// as ONE catalog, the `compose-ui-samples` system, rendered on two lanes:
//
//   :catalog          DESKTOP (Compose Multiplatform, Skiko). Vendored sources at the commit that
//                     matches the Compose Multiplatform release. The primary bundle.
//   :catalog-android  ANDROID (AndroidX, Robolectric). The compiled `*-samples` artifacts of one
//                     pinned androidx.dev snapshot build. Folded into the same catalog as the
//                     reusable workflow's `extra-module`.
//
// A sample on both lanes is one card with an Android variant; a sample only Android can build is an
// Android-only card. See catalog/build.gradle.kts and catalog-android/build.gradle.kts.
include(":catalog", ":catalog-android")
