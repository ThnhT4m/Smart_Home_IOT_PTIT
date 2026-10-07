# Integration Contract — Voice Web → Backend

**Module gửi:** Tuấn Anh (Web Voice Frontend)
**Module nhận:** Giáp (Text Mapping) → Backend → Khôi (ThingsBoard Integration)
**Cloud:** ThingsBoard (do Tâm phụ trách phần thiết bị/dashboard)

Tài liệu này là hợp đồng tích hợp duy nhất giữa frontend và backend. Mọi thay đổi phải được thống nhất giữa hai bên.

---

## 1. Endpoint

```
POST <BACKEND_ENDPOINT>/api/voice
```

`BACKEND_ENDPOINT` được frontend đọc từ `config.js`:

```js
const CONFIG = {
    mockMode: false,
    backendEndpoint: "http://127.0.0.1:5000"
};
```

Nếu `backendEndpoint = "http://127.0.0.1:5000"` thì URL đầy đủ sẽ là `http://127.0.0.1:5000/api/voice`.

> Tuấn Anh không hardcode URL trong code ngoài `config.js`. Khi Khôi cung cấp URL thật, chỉ cần đổi `config.js` rồi đặt `mockMode = false`.

---

## 2. Request

### Headers

| Header          | Value                |
| --------------- | -------------------- |
| Content-Type    | application/json     |

### Body

```json
{
  "text": "bật quạt giúp tôi"
}
```

| Field | Type   | Bắt buộc | Mô tả                                                  |
| ----- | ------ | -------- | ------------------------------------------------------ |
| text  | string | Có       | Câu lệnh tiếng Việt do người dùng nói/sửa, đã trim.   |

### Frontend guarantee (frontend CAM KẾT)

- `text` là một `string`.
- `text` đã được `trim()` whitespace hai đầu.
- `text` không rỗng — frontend sẽ không gửi request nếu `text` rỗng.

### Frontend KHÔNG guarantee (frontend KHÔNG chịu trách nhiệm)

- `intent` — phân loại ý định.
- `device` — xác định thiết bị (đèn, quạt, ...).
- `action` — xác định hành động (bật/tắt/đặt giá trị, ...).
- `value` — giá trị tham số (nhiệt độ, tốc độ, ...).
- `synonyms` — ánh xạ "mở quạt" ↔ "bật quạt".
- Tính đúng đắn về mặt ngữ nghĩa — backend/Giáp phải tự xử lý.

> Frontend chỉ chuyển đúng những gì người dùng nói/sửa. Mọi phần "thông minh" đều là việc của Giáp và Khôi.

---

## 3. Response

Backend có thể trả về bất kỳ cấu trúc JSON nào. Frontend **chỉ hiển thị**, không xử lý logic lại. Hai ví dụ được khuyến nghị:

### Thành công (HTTP 2xx)

```json
{
  "success": true,
  "command": {
    "device": "fan",
    "action": "on"
  }
}
```

### Không hiểu lệnh (HTTP 2xx hoặc 4xx tuỳ team chọn)

```json
{
  "success": false,
  "message": "Không nhận diện được lệnh"
}
```

### Lỗi hệ thống

```json
{
  "success": false,
  "message": "ThingsBoard RPC failed",
  "error": "DEVICE_OFFLINE"
}
```

Frontend sẽ:

- Hiển thị response dưới dạng JSON đẹp trong khung "Password request / Backend response".
- Không retry tự động.
- Không điều hướng trang.
- Không tự ý gọi lại ThingsBoard.

---

## 4. HTTP status codes mà frontend chờ

| Status | Frontend xử lý                                                    |
| ------ | ----------------------------------------------------------------- |
| 2xx    | Hiển thị response body.                                           |
| 4xx    | Hiển thị `message` (nếu có) hoặc status text. Không crash.        |
| 5xx    | Hiển thị cảnh báo "Không thể kết nối backend".                    |
| Network error / timeout | Hiển thị cảnh báo, giữ nguyên transcript cho người dùng sửa/gửi lại. |

Frontend có timeout mặc định 10 giây (`CONFIG.requestTimeoutMs`). Có thể điều chỉnh trong `config.js`.

---

## 5. CORS

Khi frontend (`http://localhost:5500`) và backend (`http://127.0.0.1:5000` chẳng hạn) chạy khác origin, **backend cần** cấu hình CORS cho phép origin của Web Voice.

Ví dụ cấu hình Flask (Khôi):

```python
from flask_cors import CORS
CORS(app, resources={r"/api/*": {"origins": "http://localhost:5500"}})
```

Ví dụ cấu hình Express (Node.js):

```js
const cors = require("cors");
app.use(cors({ origin: "http://localhost:5500" }));
```

> Frontend KHÔNG thể bypass CORS phía browser. Vui lòng không tắt browser security để "demo cho xong".

---

## 6. Bảo mật

Frontend **không bao giờ** chứa:

- Tài khoản ThingsBoard (username/password).
- Device access token của ThingsBoard.
- API key / secret.
- Bất kỳ credential nào.

Nếu backend cần secret, secret phải nằm phía backend. Frontend chỉ biết URL công khai của backend.

---

## 7. Versioning

Khi hợp đồng thay đổi (ví dụ thêm field `language` vào body), cả hai bên phải đồng ý và bump phiên bản:

```
POST /api/voice
Header: X-Voice-Contract-Version: 1
```

Phiên bản hiện tại: **v1** (chưa gắn header, có thể thêm khi cần).

---

## 8. Ví dụ luồng end-to-end

1. Người dùng nói: "bật quạt giúp tôi".
2. Frontend nhận diện: `text = "bật quạt giúp tôi"`.
3. Frontend POST:

   ```
   POST http://127.0.0.1:5000/api/voice
   Content-Type: application/json

   { "text": "bật quạt giúp tôi" }
   ```

4. Backend (Giáp) chuẩn hoá, trích xuất `device=fan, action=on`.
5. Backend (Khôi) gọi ThingsBoard RPC.
6. ThingsBoard (Tâm) đẩy xuống ESP32 → relay → quạt bật.
7. Backend trả:

   ```json
   {
     "success": true,
     "command": { "device": "fan", "action": "on" }
   }
   ```

8. Frontend chỉ hiển thị response.

---

## 9. Liên hệ

- Frontend owner: Tuấn Anh
- Backend owner: Khôi
- NLP / mapping owner: Giáp
- ThingsBoard / device owner: Tâm

Mọi thắc mắc về hợp đồng này vui lòng ping team trước khi sửa file.