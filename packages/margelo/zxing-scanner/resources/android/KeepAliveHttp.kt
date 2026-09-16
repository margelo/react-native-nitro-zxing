package com.margelo.plugins.zxing_scanner

import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL

/**
 * A minimal HTTP/1.1 client on one persistent socket, so every scan report is a
 * single round trip on an already-open connection: no DNS, no TCP handshake, no
 * slow start, and no PHP request on the phone in between.
 *
 * It talks to the socket directly rather than through HttpURLConnection because
 * the NativePHP Android scaffold ships a network-security config that forbids
 * cleartext for the Java HTTP stacks, a plugin manifest cannot relax it, and the
 * benchmark server is plain http on the LAN. Raw sockets are not covered by
 * that policy.
 */
internal class KeepAliveHttp(url: String) {
    private val target = URL(url)
    private val port = if (target.port == -1) target.defaultPort else target.port
    private val path = target.file.ifEmpty { "/" }
    private val hostHeader = if (port == 80) target.host else "${target.host}:$port"

    private var socket: Socket? = null
    private var input: DataInputStream? = null
    private var output: OutputStream? = null

    /** Open the connection ahead of the first report so it never pays the handshake. */
    @Synchronized
    fun warm() {
        try {
            if (socket?.isClosed != false) connect()
        } catch (_: IOException) {
        }
    }

    /** POST a JSON body and return the response body, or null when the server could not be reached. */
    @Synchronized
    fun post(json: String): String? {
        val body = json.toByteArray(Charsets.UTF_8)
        val head = "POST $path HTTP/1.1\r\n" +
            "Host: $hostHeader\r\n" +
            "Content-Type: application/json\r\n" +
            "Content-Length: ${body.size}\r\n" +
            "Connection: keep-alive\r\n\r\n"

        // One retry: the server may have closed an idle keep-alive connection.
        repeat(2) {
            try {
                if (socket?.isClosed != false) connect()
                output!!.write(head.toByteArray(Charsets.US_ASCII))
                output!!.write(body)
                output!!.flush()
                return readResponse()
            } catch (_: IOException) {
                close()
            }
        }
        return null
    }

    @Synchronized
    fun close() {
        try { socket?.close() } catch (_: IOException) {}
        socket = null
        input = null
        output = null
    }

    private fun connect() {
        close()
        val s = Socket()
        s.tcpNoDelay = true
        s.soTimeout = 2000
        s.connect(InetSocketAddress(target.host, port), 2000)
        socket = s
        input = DataInputStream(s.getInputStream())
        output = s.getOutputStream()
    }

    private fun readResponse(): String {
        val inp = input ?: throw IOException("not connected")
        val headers = readHeaders(inp)
        val length = Regex("(?im)^content-length:\\s*(\\d+)").find(headers)?.groupValues?.get(1)?.toInt()
        val chunked = Regex("(?im)^transfer-encoding:.*chunked").containsMatchIn(headers)
        val closing = Regex("(?im)^connection:\\s*close").containsMatchIn(headers)

        val body = when {
            chunked -> readChunked(inp)
            length != null -> ByteArray(length).also { inp.readFully(it) }
            else -> inp.readBytes().also { close() }
        }
        if (closing) close()
        return String(body, Charsets.UTF_8)
    }

    private fun readHeaders(inp: InputStream): String {
        val raw = ByteArrayOutputStream()
        var tail = 0
        while (tail != 0x0D0A0D0A) {
            val b = inp.read()
            if (b < 0) throw IOException("connection closed before headers")
            raw.write(b)
            tail = (tail shl 8) or b
        }
        return raw.toString("ISO-8859-1")
    }

    private fun readChunked(inp: DataInputStream): ByteArray {
        val body = ByteArrayOutputStream()
        while (true) {
            val size = readLine(inp).substringBefore(';').trim().toInt(16)
            if (size == 0) {
                while (readLine(inp).isNotEmpty()) { /* trailers */ }
                return body.toByteArray()
            }
            val chunk = ByteArray(size)
            inp.readFully(chunk)
            body.write(chunk)
            readLine(inp)
        }
    }

    private fun readLine(inp: InputStream): String {
        val line = ByteArrayOutputStream()
        while (true) {
            val b = inp.read()
            if (b < 0) throw IOException("connection closed mid-body")
            if (b == '\n'.code) break
            if (b != '\r'.code) line.write(b)
        }
        return line.toString("ISO-8859-1")
    }
}
