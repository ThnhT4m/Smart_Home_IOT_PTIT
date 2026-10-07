/**
 * config.js — Centralized configuration for the IoT Voice Control frontend.
 *
 * Tuấn Anh's module. Edit values here to switch environments.
 *
 * - mockMode = true  -> frontend logs payload and shows a "ready" state.
 *                       Use this while Giáp/Khôi are still building the backend.
 * - mockMode = false -> frontend POSTs JSON to backendEndpoint.
 *
 * IMPORTANT:
 *   * Do NOT put ThingsBoard credentials, device tokens, or any API keys here.
 *   * Anything sensitive must live on the backend (Khôi's service).
 */

const CONFIG = {
    // Toggle this to true while developing independently of the backend team.
    mockMode: true,

    // Backend endpoint that Giáp/Khôi will provide.
    // Example production-like value: "http://192.168.1.20:5000/api/voice"
    backendEndpoint: "http://127.0.0.1:5000/api/voice",

    // Request timeout in milliseconds (used by real-mode fetch).
    requestTimeoutMs: 10000,

    // Verbose logging for development.
    debug: true,

    // Speech recognition settings.
    speech: {
        lang: "vi-VN",
        continuous: false,
        interimResults: true,
        maxAlternatives: 1
    }
};

// Make available to other modules (vanilla JS, no bundler).
window.CONFIG = CONFIG;