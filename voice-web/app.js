/**
 * app.js — Web Voice Frontend for IoT Voice Control.
 *
 * Module owner: Tuấn Anh.
 *
 * Responsibilities (and ONLY these):
 *   - Capture microphone audio via Web Speech API (SpeechRecognition).
 *   - Convert Vietnamese speech to text (lang = "vi-VN").
 *   - Show interim + final transcript.
 *   - Build JSON payload { text: "<recognized text>" }.
 *   - POST the payload to CONFIG.backendEndpoint OR show mock confirmation
 *     when CONFIG.mockMode === true.
 *
 * Explicit NON-responsibilities (handled by other team members):
 *   - intent detection / device extraction / action extraction
 *   - synonym mapping / number parsing
 *   - ThingsBoard integration / RPC / device credentials
 *
 * Architecture:
 *   User voice -> Microphone -> Web Speech API (vi-VN)
 *   -> final transcript -> JSON { text }
 *   -> fetch CONFIG.backendEndpoint  (or mock confirmation)
 *   -> render backend response (display only).
 */

(function () {
    "use strict";

    // ----- Configuration (provided by config.js) -----
    const CONFIG = window.CONFIG || { mockMode: true, backendEndpoint: "", debug: false };

    // ----- DOM references -----
    const els = {
        micBtn:        document.getElementById("micBtn"),
        micHint:       document.getElementById("micHint"),
        statusText:    document.getElementById("statusText"),
        interimBox:    document.getElementById("interimBox"),
        interimText:   document.getElementById("interimText"),
        transcript:    document.getElementById("transcriptInput"),
        payload:       document.getElementById("payloadPreview"),
        sendBtn:       document.getElementById("sendBtn"),
        clearBtn:      document.getElementById("clearBtn"),
        responseBox:   document.getElementById("responseSection"),
        responseBody:  document.getElementById("responseBody"),
        warningBox:    document.getElementById("warningSection"),
        warningText:   document.getElementById("warningText"),
        modeBadge:     document.getElementById("modeBadge")
    };

    // ----- State -----
    const state = {
        recognition: null,
        listening: false,
        finalTranscript: "",
        sending: false
    };

    // ----- Utility: logging -----
    function log(...args) {
        if (CONFIG.debug) {
            // eslint-disable-next-line no-console
            console.log("[voice-web]", ...args);
        }
    }

    // ----- Status helpers -----
    const STATUS = {
        idle:      { text: "Sẵn sàng",          cls: "status-idle" },
        listening: { text: "Đang nghe...",      cls: "status-listening" },
        recognized:{ text: "Nhận diện thành công", cls: "status-success" },
        sending:   { text: "Đang gửi...",      cls: "status-sending" },
        success:   { text: "Đã gửi thành công", cls: "status-success" },
        error:     { text: "Lỗi",               cls: "status-error" }
    };

    function setStatus(key) {
        const s = STATUS[key] || STATUS.idle;
        els.statusText.textContent = s.text;
        els.statusText.className = "status-value " + s.cls;
    }

    // ----- Warning helpers (non-fatal notices) -----
    function showWarning(message) {
        els.warningText.textContent = message;
        els.warningBox.hidden = false;
    }
    function clearWarning() {
        els.warningText.textContent = "";
        els.warningBox.hidden = true;
    }

    // ----- Payload preview -----
    function buildPayload(text) {
        return { text: text };
    }

    function updatePayloadPreview() {
        const text = els.transcript.value.trim();
        const payload = buildPayload(text);
        els.payload.textContent = JSON.stringify(payload, null, 2);
        updateSendButton();
    }

    function updateSendButton() {
        const text = els.transcript.value.trim();
        els.sendBtn.disabled = text.length === 0 || state.sending;
    }

    // ----- Speech Recognition setup -----
    function getSpeechRecognitionCtor() {
        return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function setupRecognition() {
        const Ctor = getSpeechRecognitionCtor();
        if (!Ctor) return null;

        const recognition = new Ctor();
        recognition.lang         = CONFIG.speech.lang;          // "vi-VN"
        recognition.continuous   = CONFIG.speech.continuous;    // false
        recognition.interimResults = CONFIG.speech.interimResults; // true
        recognition.maxAlternatives = CONFIG.speech.maxAlternatives; // 1

        recognition.onstart = handleSpeechStart;
        recognition.onresult = handleSpeechResult;
        recognition.onerror = handleSpeechError;
        recognition.onend = handleSpeechEnd;

        return recognition;
    }

    function isSpeechSupported() {
        return getSpeechRecognitionCtor() !== null;
    }

    // ----- Speech event handlers -----
    function handleSpeechStart() {
        log("SpeechRecognition started");
        state.listening = true;
        state.finalTranscript = "";
        els.interimBox.hidden = true;
        els.interimText.textContent = "";
        els.micBtn.classList.add("listening");
        els.micHint.textContent = "Đang nghe... hãy nói câu lệnh của bạn";
        setStatus("listening");
    }

    function handleSpeechResult(event) {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcriptPart = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                final += transcriptPart;
            } else {
                interim += transcriptPart;
            }
        }

        if (interim) {
            els.interimBox.hidden = false;
            els.interimText.textContent = `"${interim}"`;
            log("interim:", interim);
        }

        if (final) {
            const trimmed = final.trim();
            log("final:", trimmed);
            // Replace textarea content with the latest final transcript.
            // Frontend does NOT do any intent parsing — it just preserves the user's words.
            els.transcript.value = trimmed;
            state.finalTranscript = trimmed;
            updatePayloadPreview();
            setStatus("recognized");
        }
    }

    function handleSpeechError(event) {
        state.listening = false;
        els.micBtn.classList.remove("listening");
        els.micHint.textContent = "Nhấn micro để nói";

        const err = event.error || "unknown";
        log("SpeechRecognition error:", err);

        let message = `Lỗi Speech Recognition: ${err}`;
        switch (err) {
            case "not-allowed":
            case "service-not-allowed":
                message = "Bạn chưa cấp quyền microphone cho trang này. Vui lòng cho phép trong cài đặt trình duyệt rồi thử lại. Bạn vẫn có thể nhập câu lệnh thủ công bên dưới.";
                break;
            case "no-speech":
                message = "Không phát hiện giọng nói. Hãy thử lại và nói rõ hơn.";
                break;
            case "audio-capture":
                message = "Không tìm thấy hoặc không truy cập được microphone. Kiểm tra thiết bị rồi thử lại.";
                break;
            case "network":
                message = "Web Speech API không kết nối được tới Google servers. Mở trang này trong Chrome ngoài sandbox (có Internet) để dùng micro. Trong sandbox, bạn vẫn demo được bằng cách gõ câu lệnh vào ô nhập bên dưới rồi bấm Gửi lệnh.";
                break;
            case "aborted":
                message = "Đã hủy nhận diện giọng nói.";
                break;
            default:
                message = `Lỗi Speech Recognition: ${err}`;
        }

        setStatus("error");
        showWarning(message);
    }

    function handleSpeechEnd() {
        log("SpeechRecognition ended");
        state.listening = false;
        els.micBtn.classList.remove("listening");
        els.micHint.textContent = "Nhấn micro để nói";
        if (els.statusText.textContent === STATUS.listening.text) {
            setStatus("idle");
        }
    }

    // ----- Microphone button -----
    function toggleRecognition() {
        if (!state.recognition) return;
        if (state.listening) {
            try {
                state.recognition.stop();
            } catch (_) { /* ignore */ }
            return;
        }
        try {
            clearWarning();
            state.recognition.start();
        } catch (e) {
            // Some browsers throw if start() is called twice in a row.
            log("recognition.start() failed:", e && e.message);
            showWarning("Không thể bắt đầu nhận diện giọng nói. Hãy thử lại sau ít giây.");
            setStatus("error");
        }
    }

    // ----- Send / Clear -----
    async function sendCommand() {
        if (state.sending) return;
        const text = els.transcript.value.trim();
        if (!text) {
            showWarning("Câu lệnh đang trống. Hãy nói hoặc nhập trước khi gửi.");
            setStatus("error");
            return;
        }

        clearWarning();
        const payload = buildPayload(text);
        log("outgoing payload:", payload);

        if (CONFIG.mockMode) {
            sendMockCommand(payload);
        } else {
            await sendRealCommand(payload);
        }
    }

    function sendMockCommand(payload) {
        state.sending = true;
        setStatus("sending");
        updateSendButton();

        // In mock mode we do NOT contact the backend.
        // We just confirm that the payload is correctly built.
        const pretty = JSON.stringify(payload, null, 2);

        // Use a small delay so the UI can show "Đang gửi..." briefly.
        setTimeout(() => {
            state.sending = false;
            setStatus("success");
            els.responseBody.textContent =
                "Mock mode: payload đã sẵn sàng gửi sang backend.\n\n"
                + "Payload sẽ được gửi tới:\n"
                + CONFIG.backendEndpoint + "\n\n"
                + "Body:\n" + pretty;
            els.responseBox.hidden = false;
            updateSendButton();
            log("mock send complete");
        }, 350);
    }

    async function sendRealCommand(payload) {
        state.sending = true;
        setStatus("sending");
        updateSendButton();

        const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
        let timer = null;
        if (controller && CONFIG.requestTimeoutMs > 0) {
            timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
        }

        try {
            const response = await fetch(CONFIG.backendEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller ? controller.signal : undefined
            });

            // Read body as text first; try JSON parse.
            const raw = await response.text();
            let parsed = null;
            try { parsed = raw ? JSON.parse(raw) : null; } catch (_) { /* leave parsed null */ }

            if (!response.ok) {
                const errMsg = (parsed && (parsed.message || parsed.error))
                    || `HTTP ${response.status} ${response.statusText}`;
                throw new Error(errMsg);
            }

            setStatus("success");
            const display = parsed !== null ? JSON.stringify(parsed, null, 2) : raw;
            els.responseBody.textContent = "Thành công:\n" + display;
            els.responseBox.hidden = false;
            log("backend response:", parsed);
        } catch (err) {
            log("send error:", err);
            setStatus("error");
            const isAbort = err && err.name === "AbortError";
            const message = isAbort
                ? `Backend không phản hồi trong ${CONFIG.requestTimeoutMs}ms.`
                : (err && err.message)
                    ? `Không thể kết nối backend: ${err.message}`
                    : "Không thể kết nối backend.";
            showWarning(message + " (Câu lệnh của bạn vẫn được giữ nguyên trong ô nhập.)");
            els.responseBox.hidden = true;
        } finally {
            if (timer) clearTimeout(timer);
            state.sending = false;
            updateSendButton();
        }
    }

    function clearUI() {
        els.transcript.value = "";
        els.interimText.textContent = "";
        els.interimBox.hidden = true;
        els.responseBody.textContent = "";
        els.responseBox.hidden = true;
        clearWarning();
        state.finalTranscript = "";
        setStatus("idle");
        updatePayloadPreview();
    }

    // ----- Initialization -----
    function applyModeBadge() {
        if (CONFIG.mockMode) {
            els.modeBadge.textContent = "Mock mode";
            els.modeBadge.classList.remove("real");
        } else {
            els.modeBadge.textContent = "Real backend";
            els.modeBadge.classList.add("real");
        }
    }

    function bindEvents() {
        els.micBtn.addEventListener("click", toggleRecognition);
        els.sendBtn.addEventListener("click", sendCommand);
        els.clearBtn.addEventListener("click", clearUI);
        els.transcript.addEventListener("input", updatePayloadPreview);

        // Keyboard shortcut: Ctrl+Shift+M to toggle mic (helps demos).
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.shiftKey && (e.key === "M" || e.key === "m")) {
                e.preventDefault();
                toggleRecognition();
            }
        });
    }

    function init() {
        applyModeBadge();
        bindEvents();
        updatePayloadPreview();
        setStatus("idle");

        if (!isSpeechSupported()) {
            log("SpeechRecognition NOT supported in this browser");
            els.micBtn.disabled = true;
            els.micHint.textContent = "Micro không khả dụng";
            showWarning("Trình duyệt hiện tại không hỗ trợ Speech Recognition. Bạn vẫn có thể nhập lệnh thủ công bằng ô bên dưới.");
            return;
        }

        try {
            state.recognition = setupRecognition();
        } catch (e) {
            log("setupRecognition() failed:", e && e.message);
            els.micBtn.disabled = true;
            showWarning("Không thể khởi tạo Speech Recognition. Vui lòng nhập lệnh thủ công.");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();