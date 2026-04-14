package snd.komf.app.api

import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import snd.komf.app.log.InMemoryLogBuffer

class LogRoutes {
    fun registerRoutes(route: Route) {
        route.get("/logs") {
            val limit = call.request.queryParameters["limit"]?.toIntOrNull() ?: 200
            call.respond(InMemoryLogBuffer.getLast(limit.coerceIn(1, 1000)))
        }
    }
}
