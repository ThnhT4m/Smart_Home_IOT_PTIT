// Static / smoke test for app.js + config.js — verifies key invariants
// without needing a browser. Run with: node test/smoke.js
//
// We can't fully exercise DOM/Web Speech API without a browser, but we can:
//   - parse config.js + app.js without syntax errors (already done by node --check)
//   - ensure required IDs/strings exist in HTML and JS
//   - ensure no banned intent/device/action logic appears in frontend
//   - ensure no ThingsBoard credential strings are present in frontend

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css  = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const js   = fs.readFileSync(path.join(root, "app.js"), "utf8");
const cfg  = fs.readFileSync(path.join(root, "config.js"), "utf8");
const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
const contract = fs.readFileSync(path.join(root, "docs/integration-contract.md"), "utf8");

const failures = [];
function assert(cond, msg) {
    if (!cond) failures.push(msg);
    else console.log("  ok  " + msg);
}

console.log("== File presence ==");
["index.html","styles.css","app.js","config.js","README.md","docs/integration-contract.md"].forEach(p => {
    assert(fs.existsSync(path.join(root, p)), p + " exists");
});

console.log("== HTML structure ==");
[
    'id="micBtn"',
    'id="statusText"',
    'id="interimText"',
    'id="transcriptInput"',
    'id="payloadPreview"',
    'id="sendBtn"',
    'id="clearBtn"',
    'id="responseSection"',
    'id="responseBody"',
    'id="warningSection"',
    'src="config.js"',
    'src="app.js"'
].forEach(s => assert(html.includes(s), 'HTML contains ' + s));

console.log("== JS structural ==");
[
    'window.SpeechRecognition || window.webkitSpeechRecognition',
    'recognition.lang         = CONFIG.speech.lang',
    'recognition.continuous',
    'recognition.interimResults',
    'recognition.maxAlternatives',
    'recognition.onstart',
    'recognition.onerror',
    'recognition.onresult',
    'recognition.onend',
    'not-allowed',
    'no-speech',
    'audio-capture',
    'network',
    'aborted',
    'showWarning(',
    'isSpeechSupported',
    'toggleRecognition',
    'sendCommand',
    'sendMockCommand',
    'sendRealCommand',
    'clearUI',
    'updatePayloadPreview',
    'mockMode',
    'backendEndpoint'
].forEach(s => assert(js.includes(s), 'app.js contains ' + s));

console.log("== No intent / device extraction ==");
// Tuấn Anh must NOT classify device or action as code.
// These tokens must NOT appear as actual classification logic (not just comments).
const banned = [
    /device\s*[:=]\s*["']fan["']/i,
    /action\s*[:=]\s*["']on["']/i,
    /method\s*[:=]\s*["']setFan["']/i,
    /intent\s*[:=]/i
];
banned.forEach(re => {
    assert(!re.test(js), 'app.js does NOT contain ' + re);
});

console.log("== No ThingsBoard credentials ==");
// Verify there are no credential-shaped strings (URL?token=..., password=..., etc.).
const credentialLeaks = [
    /(token|password|secret)\s*[:=]\s*["'][^"']{6,}["']/i,
    /https?:\/\/[^"\s]*token=[^"\s]+/i
];
const cfgOrJs = cfg + "\n" + js;
let credFail = false;
credentialLeaks.forEach(re => {
    if (re.test(cfgOrJs)) credFail = true;
});
assert(!credFail, "no token/password/secret credentials leaked in config.js or app.js");
// Sanity: app.js / config.js may MENTION ThingsBoard in comments, but should not embed creds.
assert(!/thingsboard\.com/i.test(cfgOrJs), "no thingsboard.com URL embedded");
assert(!/TENANT_ID|ACCESS_TOKEN/i.test(cfgOrJs), "no TENANT_ID / ACCESS_TOKEN hardcoded");

console.log("== Mock mode default ==");
assert(/mockMode:\s*true/.test(cfg), "mockMode is true in config.js (so Tuấn Anh can demo independently)");

console.log("== Language ==");
assert(/lang:\s*"vi-VN"/.test(cfg), 'config.js speech.lang = "vi-VN"');

console.log("== Endpoint path ==");
assert(/api\/voice/.test(readme) && /api\/voice/.test(contract), 'integration contract mentions /api/voice');

console.log("\nSummary: " + (failures.length === 0 ? "ALL PASS" : failures.length + " FAILED"));
if (failures.length) {
    failures.forEach(f => console.log("  FAIL " + f));
    process.exit(1);
}