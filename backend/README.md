# Backend — Khôi

FastAPI backend: nhận text từ Web Voice, phân tích thành lệnh, gọi ThingsBoard RPC xuống ESP32.

```
voice-web --{text}--> POST /api/voice --Gemini--> {device, action} --> ThingsBoard RPC --> ESP32
```

## Chạy

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # rồi điền TB_USER, TB_PASS, GEMINI_API_KEY
python -m app.main              # http://127.0.0.1:5000, Swagger: /docs
```

Test: `python -m pytest -q`

## Cấu hình

- `.env` — URL/tài khoản ThingsBoard, Gemini API key, CORS. **Không commit file này.**
- `devices.json` — mapping lệnh → `device_id` + RPC method + params trên ThingsBoard.
  Thay `device_id` thật và tên method theo firmware của Tâm.

## API

### `POST /api/voice` (Web Voice gọi — theo `voice-web/docs/integration-contract.md`)

```json
{ "text": "bật quạt giúp tôi" }
```

### `POST /api/command` (gửi thẳng lệnh, dùng để test)

```json
{ "device": "quat", "action": "bat", "raw_text": "bật quạt" }
```

| device | action |
|---|---|
| `quat`, `den` | `bat`, `tat` |

`"unknown"` ở `device` hoặc `action` = không hiểu lệnh.

### Response

Thành công (200):

```json
{ "success": true, "command": { "device": "quat", "action": "bat", "raw_text": "bật quạt" }, "device_response": null }
```

Lỗi:

```json
{ "success": false, "message": "Không hiểu lệnh, vui lòng nói lại.", "error": "INVALID_COMMAND" }
```

| HTTP | error | Khi nào |
|---|---|---|
| 400 | `INVALID_COMMAND` | Lệnh `unknown` hoặc không có trong `devices.json` |
| 502 | `NLP_FAILED` | Gemini lỗi / quá tải |
| 502 | `THINGSBOARD_ERROR` | ThingsBoard trả lỗi / không kết nối được |
| 504 | `DEVICE_OFFLINE` | Thiết bị không phản hồi |

### Khác

- `GET /health` — kiểm tra backend + kết nối ThingsBoard.
- `GET /api/devices` — danh sách thiết bị/lệnh hợp lệ.

## Ghi chú

- `app/text_mapper.py` dựa trên code text mapping (Gemini) của **Giáp**, đã chỉnh để trả
  `quat/den`, `bat/tat`, `unknown`, đọc API key từ `.env` và có timeout.
- Phần ESP32 / ThingsBoard device / dashboard do **Tâm** phụ trách.
