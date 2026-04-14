import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinJvm)
    alias(libs.plugins.kotlinSerialization)
    alias(libs.plugins.shadow)
}

group = "io.github.snd-r"
version = "1.0.0"

kotlin {
    jvmToolchain(17)
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        optIn.add("kotlin.time.ExperimentalTime")
    }
}
java {
    targetCompatibility = JavaVersion.VERSION_17
    sourceCompatibility = JavaVersion.VERSION_17
    toolchain {
        languageVersion = JavaLanguageVersion.of(17)
    }
}

dependencies {
    implementation(project(":komf-core"))
    implementation(project(":komf-mediaserver"))
    implementation(project(":komf-notifications"))
    implementation(project(":komf-api-models"))

    implementation(libs.logback.core)
    implementation(libs.logback.classic)
    implementation(libs.slf4j.api)
    implementation(libs.kotlin.logging)

    implementation(libs.kotlinx.datetime)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.ktor.server.core)
    implementation(libs.ktor.server.content.negotiation)
    implementation(libs.ktor.server.cio)
    implementation(libs.ktor.server.cors)
    implementation(libs.ktor.server.default.headers)
    implementation(libs.ktor.server.caching.headers)
    implementation(libs.ktor.server.status.pages)
    implementation(libs.ktor.server.sse)
    implementation(libs.ktor.client.auth)
    implementation(libs.ktor.client.core)
    implementation(libs.ktor.client.content.negotiation)
    implementation(libs.ktor.client.encoding)
    implementation(libs.ktor.client.okhttp)
    implementation(libs.ktor.serialization.kotlinx.json)
    implementation(libs.okhttp)
    implementation(libs.okhttp.sse)
    implementation(libs.okhttp.logging.interceptor)
    implementation(libs.kaml)
}

tasks {
    shadowJar {
        manifest {
            attributes(Pair("Main-Class", "snd.komf.app.ApplicationKt"))
        }
        dependsOn("copyFrontend")
    }
}

val frontendDir = rootProject.file("frontend")
val frontendDist = frontendDir.resolve("dist")
val frontendResources = file("src/main/resources/komelia")

tasks.register<Exec>("buildFrontend") {
    description = "Build frontend with npm"
    workingDir = frontendDir
    inputs.dir(frontendDir.resolve("src"))
    inputs.file(frontendDir.resolve("package.json"))
    inputs.file(frontendDir.resolve("vite.config.ts"))
    outputs.dir(frontendDist)
    commandLine(if (System.getProperty("os.name").lowercase().contains("win")) "cmd" else "sh",
        if (System.getProperty("os.name").lowercase().contains("win")) "/c" else "-c",
        "npm run build")
}

tasks.register<Copy>("copyFrontend") {
    description = "Copy frontend dist into JAR resources"
    dependsOn("buildFrontend")
    from(frontendDist)
    into(frontendResources)
}

tasks.named("processResources") {
    dependsOn("copyFrontend")
}

tasks.register("depsize") {
    description = "Prints dependencies for \"runtime\" configuration"
    doLast {
        listConfigurationDependencies(configurations["runtimeClasspath"])
    }
}

fun listConfigurationDependencies(configuration: Configuration) {
    val formatStr = "%,10.2f"

    val size = configuration.sumOf { it.length() / (1024.0 * 1024.0) }

    val out = StringBuffer()
    out.append("\nConfiguration name: \"${configuration.name}\"\n")
    if (size > 0) {
        out.append("Total dependencies size:".padEnd(65))
        out.append("${String.format(formatStr, size)} Mb\n\n")

        configuration.sortedBy { -it.length() }
            .forEach {
                out.append(it.name.padEnd(65))
                out.append("${String.format(formatStr, (it.length() / 1024.0))} kb\n")
            }
    } else {
        out.append("No dependencies found")
    }
    println(out)
}
