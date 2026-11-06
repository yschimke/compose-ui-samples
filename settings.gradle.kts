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
  }
}

rootProject.name = "compose-ui-samples"

// The AndroidX Compose samples — every `androidx.compose` sample tree except material3 — vendored
// from one pinned upstream commit and published as the `compose-ui-samples` system. See
// catalog/build.gradle.kts and catalog/import.json.
include(":catalog")
