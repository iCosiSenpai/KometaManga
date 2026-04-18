package snd.komf.app.api

import io.ktor.http.HttpStatusCode
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.serialization.Serializable
import snd.komf.app.config.AppConfig
import snd.komf.app.config.AuthConfig
import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Mac
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class AuthRoutes(
    private val appConfig: Flow<AppConfig>,
    private val onConfigUpdate: suspend (AppConfig) -> Unit,
) {
    companion object {
        private const val PBKDF2_ITERATIONS = 10_000
        private const val HASH_KEY_LENGTH = 256
        private const val SALT_LENGTH = 16
        private const val COOKIE_NAME = "komf-session"
        private const val SESSION_MAX_AGE_SECONDS = 30 * 24 * 3600 // 30 days

        fun hashPassword(password: String, salt: ByteArray? = null): String {
            val actualSalt = salt ?: ByteArray(SALT_LENGTH).also { SecureRandom().nextBytes(it) }
            val spec = PBEKeySpec(password.toCharArray(), actualSalt, PBKDF2_ITERATIONS, HASH_KEY_LENGTH)
            val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
            val hash = factory.generateSecret(spec).encoded
            val saltHex = actualSalt.joinToString("") { "%02x".format(it) }
            val hashHex = hash.joinToString("") { "%02x".format(it) }
            return "$saltHex:$hashHex"
        }

        fun verifyPassword(password: String, stored: String): Boolean {
            if (stored.isBlank()) return false
            val parts = stored.split(":")
            if (parts.size != 2) return false
            val salt = parts[0].chunked(2).map { it.toInt(16).toByte() }.toByteArray()
            val computed = hashPassword(password, salt)
            return computed == stored
        }

        fun generateSessionSecret(): String {
            val bytes = ByteArray(32)
            SecureRandom().nextBytes(bytes)
            return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        }

        fun createSessionToken(username: String, secret: String): String {
            val expiry = System.currentTimeMillis() / 1000 + SESSION_MAX_AGE_SECONDS
            val payload = "$username:$expiry"
            val mac = Mac.getInstance("HmacSHA256")
            mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
            val signature = Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.toByteArray()))
            return Base64.getUrlEncoder().withoutPadding().encodeToString("$payload:$signature".toByteArray())
        }

        fun validateSessionToken(token: String, secret: String): String? {
            if (secret.isBlank()) return null
            return try {
                val decoded = String(Base64.getUrlDecoder().decode(token))
                val parts = decoded.split(":")
                if (parts.size != 3) return null
                val (username, expiryStr, signature) = parts
                val expiry = expiryStr.toLongOrNull() ?: return null
                if (System.currentTimeMillis() / 1000 > expiry) return null

                val payload = "$username:$expiryStr"
                val mac = Mac.getInstance("HmacSHA256")
                mac.init(SecretKeySpec(secret.toByteArray(), "HmacSHA256"))
                val expected = Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.toByteArray()))
                if (signature != expected) return null
                username
            } catch (_: Exception) {
                null
            }
        }
    }

    fun registerRoutes(route: Route) {
        route.route("/auth") {
            get("/status") {
                val config = appConfig.first()
                val authConfigured = config.auth.username.isNotBlank() && config.auth.passwordHash.isNotBlank()

                val authenticated = if (!authConfigured) {
                    true // no auth configured = always authenticated (backwards compat)
                } else {
                    val cookie = call.request.cookies[COOKIE_NAME]
                    cookie != null && validateSessionToken(cookie, config.auth.sessionSecret) != null
                }

                call.respond(AuthStatusResponse(
                    authConfigured = authConfigured,
                    authenticated = authenticated,
                    username = if (authenticated && authConfigured) config.auth.username else null,
                ))
            }

            post("/login") {
                val config = appConfig.first()
                if (config.auth.username.isBlank()) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("message" to "Auth not configured"))
                    return@post
                }

                val body = call.receive<LoginRequest>()
                if (body.username != config.auth.username || !verifyPassword(body.password, config.auth.passwordHash)) {
                    call.respond(HttpStatusCode.Unauthorized, mapOf("message" to "Invalid credentials"))
                    return@post
                }

                val token = createSessionToken(body.username, config.auth.sessionSecret)
                call.response.cookies.append(
                    name = COOKIE_NAME,
                    value = token,
                    maxAge = SESSION_MAX_AGE_SECONDS.toLong(),
                    path = "/",
                    httpOnly = true,
                )
                call.respond(AuthStatusResponse(
                    authConfigured = true,
                    authenticated = true,
                    username = config.auth.username,
                ))
            }

            post("/logout") {
                call.response.cookies.append(
                    name = COOKIE_NAME,
                    value = "",
                    maxAge = 0,
                    path = "/",
                    httpOnly = true,
                )
                call.respond(mapOf("success" to true))
            }

            post("/setup") {
                val config = appConfig.first()
                if (config.auth.username.isNotBlank()) {
                    call.respond(HttpStatusCode.Conflict, mapOf("message" to "Auth already configured"))
                    return@post
                }

                val body = call.receive<SetupAuthRequest>()
                if (body.username.isBlank() || body.password.length < 4) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("message" to "Username required and password must be at least 4 characters"))
                    return@post
                }

                val secret = generateSessionSecret()
                val newAuth = AuthConfig(
                    username = body.username.trim(),
                    passwordHash = hashPassword(body.password),
                    sessionSecret = secret,
                )
                onConfigUpdate(config.copy(auth = newAuth))

                val token = createSessionToken(body.username.trim(), secret)
                call.response.cookies.append(
                    name = COOKIE_NAME,
                    value = token,
                    maxAge = SESSION_MAX_AGE_SECONDS.toLong(),
                    path = "/",
                    httpOnly = true,
                )
                call.respond(AuthStatusResponse(
                    authConfigured = true,
                    authenticated = true,
                    username = body.username.trim(),
                ))
            }

            patch("/update") {
                val config = appConfig.first()
                // Require authenticated
                val cookie = call.request.cookies[COOKIE_NAME]
                if (config.auth.username.isNotBlank()) {
                    if (cookie == null || validateSessionToken(cookie, config.auth.sessionSecret) == null) {
                        call.respond(HttpStatusCode.Unauthorized, mapOf("message" to "Not authenticated"))
                        return@patch
                    }
                }

                val body = call.receive<UpdateAuthRequest>()

                // Verify current password if auth is configured
                if (config.auth.passwordHash.isNotBlank()) {
                    if (body.currentPassword == null || !verifyPassword(body.currentPassword, config.auth.passwordHash)) {
                        call.respond(HttpStatusCode.Forbidden, mapOf("message" to "Current password is incorrect"))
                        return@patch
                    }
                }

                val newUsername = body.newUsername?.trim()?.ifBlank { null } ?: config.auth.username
                val newPasswordHash = if (body.newPassword != null && body.newPassword.length >= 4) {
                    hashPassword(body.newPassword)
                } else {
                    config.auth.passwordHash
                }
                val secret = config.auth.sessionSecret.ifBlank { generateSessionSecret() }

                val newAuth = AuthConfig(
                    username = newUsername,
                    passwordHash = newPasswordHash,
                    sessionSecret = secret,
                )
                onConfigUpdate(config.copy(auth = newAuth))

                // Re-issue session token with potentially new username
                val token = createSessionToken(newUsername, secret)
                call.response.cookies.append(
                    name = COOKIE_NAME,
                    value = token,
                    maxAge = SESSION_MAX_AGE_SECONDS.toLong(),
                    path = "/",
                    httpOnly = true,
                )
                call.respond(AuthStatusResponse(
                    authConfigured = true,
                    authenticated = true,
                    username = newUsername,
                ))
            }
        }
    }
}

@Serializable
data class LoginRequest(val username: String, val password: String)

@Serializable
data class SetupAuthRequest(val username: String, val password: String)

@Serializable
data class UpdateAuthRequest(
    val currentPassword: String? = null,
    val newUsername: String? = null,
    val newPassword: String? = null,
)

@Serializable
data class AuthStatusResponse(
    val authConfigured: Boolean,
    val authenticated: Boolean,
    val username: String? = null,
)
