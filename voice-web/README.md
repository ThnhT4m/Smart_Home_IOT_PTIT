# IoT Voice Control — Web Frontend (Module của Tuấn Anh)

Web frontend bắt giọng nói tiếng Việt, chuyển thành text, đóng gói JSON, gửi sang backend (Giáp/Khôi). Đây là một phần của đồ án cuối kỳ môn IoT — đề tài **"Hệ thống IoT điều khiển thiết bị qua cloud bằng giọng nói"**, cloud được nhóm chọn là **ThingsBoard**.

---

## 1. Mục tiêu module

- Thu âm giọng nói tiếng Việt từ trình duyệt (microphone).
- Dùng **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`) để chuyển giọng nói thành văn bản với `lang = "vi-VN"`.
- Hiển thị cả **interim** (đang nghe) và **final transcript** cho người dùng.
- Cho phép người dùng **sửa transcript bằng tay** trước khi gửi.
- Đóng gói thành payload JSON:

  ```json
  { "text": "bật quạt giúp tôi" }
  ```

- Gửi payload sang backend (mock mode hoặc backend thật) qua HTTP POST.

---

## 2. Vai trò của Tuấn Anh

| Bước                  | Tuấn Anh | Người khác |
| --------------------- | -------- | ---------- |
| Micro + Web Speech API| Có       |            |
| Speech-to-Text vi-VN  | Có       |            |
| Tạo JSON `{ text }`   | Có       |            |
| Hiển thị transcript   | Có       |            |
| Nhập tay / sửa text   | Có       |            |
| Intent / device / action | **Không** | Giáp      |
| Validate command      | **Không** | Khôi      |
| ThingsBoard RPC       | **Không** | Khôi      |
| ESP32 / MQTT / hardware | **Không** | Tâm      |

> Tuấn Anh **TUYỆT ĐỐI KHÔNG** làm intent detection, device extraction, action extraction, value parsing, hay synonym mapping. Đó là việc của Giáp.

---

## 3. Kiến trúc

```
[User voice]
     ↓
[Microphone]
     ↓
[Web Speech API — vi-VN]          ← Tuấn Anh
     ↓
[final transcript]
     ↓
[JSON: { "text": "..." }]          ← Tuấn Anh
     ↓
[POST /api/voice]                  ← Tuấn Anh
     ↓
[Backend — Giáp/Khôi]
     ↓
[ThingsBoard RPC]                  ← Khôi
     ↓
[ESP32 / relay / quạt / LED]       ← Tâm
```

Frontend **chỉ** dừng lại ở "POST sang backend". Mọi phần sau là việc của team còn lại.

---

## 4. Cấu trúc file

```
voice-web/
├── index.html                  # Giao diện
├── styles.css                  # CSS tối giản, không framework
├── app.js                      # Logic Web Speech API, mock mode, fetch
├── config.js                   # CONFIG tập trung (endpoint, mockMode, debug)
├── README.md                   # File này
└── docs/
    └── integration-contract.md  # Hợp đồng với backend
```

---

## 5. Yêu cầu môi trường

- **Trình duyệt hỗ trợ Web Speech API**: Chrome, Edge, hoặc Safari (iOS/macOS). Firefox hiện **không** hỗ trợ → fallback về nhập tay vẫn hoạt động.
- **Microphone** thật (laptop, headset, hoặc micro rời).
- Trang phải chạy trên **HTTPS** *hoặc* **localhost** để browser cho phép truy cập microphone.
- Không cần cài đặt gì — chỉ cần một HTTP server tĩnh (Python đã có sẵn).

---

## 6. Cách chạy

Cách đơn giản nhất:

```bash
cd voice-web
python3 -m http.server 5500
```

Mở trình duyệt:

```
http://localhost:5500
```

Các cách khác (tương đương):

```bash
# Node.js
npx serve -l 5500 .

# PHP
php -S localhost:5500
```

> Không mở file `index.html` bằng `file://` — nhiều browser chặn microphone với origin `file://`.

---

## 7. Cho phép microphone

Lần đầu bấm 🎤, browser sẽ hỏi **"Allow microphone?"**. Bấm **Allow**.

Nếu trước đó bạn đã chặn:

- **Chrome**: vào `chrome://settings/content/microphone` → thêm `http://localhost:5500` vào Allow.
- **Edge**: `edge://settings/content/microphone`.
- **Firefox**: hiện không hỗ trợ Web Speech API, frontend sẽ tự động ẩn micro và bật chế độ nhập tay.

---

## 8. Cách test mock mode

Mặc định `config.js`:

```js
mockMode: true
```

Trong mock mode:

1. Bấm 🎤 → nói "bật quạt giúp tôi".
2. Website hiển thị final transcript.
3. Payload preview cập nhật:

   ```json
   {
     "text": "bật quạt giúp tôi"
   }
   ```

4. Bấm **Gửi lệnh** → website **không** gọi backend thật. Nó chỉ in payload ra console và hiển thị thông báo:

   > "Mock mode: payload đã sẵn sàng gửi sang backend."

5. Transcript không bị mất — bạn có thể sửa rồi bấm **Gửi lệnh** lại.

Dùng mock mode để demo độc lập khi backend chưa sẵn sàng.

---

## 9. Cách chuyển sang backend thật

Mở `config.js`, sửa 2 dòng:

```js
const CONFIG = {
    mockMode: false,
    backendEndpoint: "http://192.168.1.20:5000"   // đổi theo Khôi
};
```

Reload trang (`Ctrl+R`). Bấm 🎤 → nói → bấm **Gửi lệnh** → frontend sẽ POST sang `http://192.168.1.20:5000/api/voice`.

Không cần sửa file nào khác.

---

## 10. Request contract

```
POST <backendEndpoint>/api/voice
Content-Type: application/json

{ "text": "<câu lệnh tiếng Việt, đã trim>" }
```

Chi tiết đầy đủ xem [`docs/integration-contract.md`](docs/integration-contract.md).

---

## 11. Các lỗi Speech Recognition thường gặp

| `event.error`             | Nguyên nhân                                  | Cách xử lý                                                  |
| ------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `not-allowed`             | Người dùng chặn microphone                   | Hướng dẫn cấp quyền trong cài đặt browser; vẫn nhập tay được. |
| `service-not-allowed`     | Browser chặn do insecure origin              | Chạy trang qua `https://` hoặc `http://localhost`.           |
| `no-speech`               | Không phát hiện giọng nói                    | Báo "Không phát hiện giọng nói", thử lại.                   |
| `audio-capture`           | Không có microphone / không truy cập được    | Báo lỗi thiết bị, kiểm tra micro.                           |
| `network`                 | Mất mạng hoặc dịch vụ STT sập               | Báo lỗi mạng, thử lại.                                      |
| `aborted`                 | Recognition bị huỷ (bấm micro 2 lần, ...)    | Báo "Đã huỷ nhận diện".                                     |
| (khác)                    | Lỗi không xác định                           | Hiển thị `event.error`, không crash.                         |

Frontend **không crash** trong bất kỳ tình huống nào. Manual input luôn hoạt động.

---

## 12. Test cases

### A. Speech-to-Text

| Người dùng nói              | Expected payload                                          |
| --------------------------- | --------------------------------------------------------- |
| "bật đèn"                   | `{ "text": "bật đèn" }`                                   |
| "tắt đèn giúp tôi"          | `{ "text": "tắt đèn giúp tôi" }`                          |
| "bật quạt"                  | `{ "text": "bật quạt" }`                                  |
| "cho quạt chạy"             | `{ "text": "cho quạt chạy" }`                             |
| "đặt nhiệt độ 25 độ"        | `{ "text": "đặt nhiệt độ 25 độ" }`                        |

Lưu ý: STT engine có thể trả về text hơi khác (viết hoa, thêm dấu câu, ...) — frontend **không chịu trách nhiệm** về phần này. Giáp sẽ lo phần chuẩn hoá.

### B. Error cases

| Tình huống                              | Expected                                                                    |
| --------------------------------------- | --------------------------------------------------------------------------- |
| User từ chối microphone                 | UI không crash, hiện cảnh báo, ô nhập tay vẫn dùng được.                   |
| Không nói gì                            | Thông báo "Không phát hiện giọng nói".                                      |
| Browser không hỗ trợ STT                | Micro disabled, hiện cảnh báo, ô nhập tay + nút Gửi vẫn hoạt động.          |
| Backend offline (real mode)             | Cảnh báo "Không thể kết nối backend"; transcript không bị mất.              |
| Text rỗng                               | Nút Gửi disabled; nếu cố bypass thì không gửi request.                     |
| Backend trả lỗi 4xx/5xx                 | Hiển thị message từ backend, không crash.                                   |

---

## 13. Phạm vi module

✅ **Có**:

- Thu âm và chuyển giọng nói tiếng Việt → text.
- Hiển thị interim + final transcript.
- Cho người dùng sửa text trước khi gửi.
- Đóng gói `{ "text": "..." }`.
- Gửi sang backend hoặc mock mode.
- Fallback khi browser không hỗ trợ STT.
- Xử lý lỗi microphone/STT/network.
- Phím tắt `Ctrl+Shift+M` để bật/tắt micro (tiện cho demo).

❌ **Không** (do thành viên khác):

- Intent recognition.
- Keyword / device / action extraction.
- Synonym mapping.
- Number parsing.
- ThingsBoard RPC.
- MQTT device code.
- ESP32 / sensor / relay / fan / dashboard.

---

## 14. Những phần KHÔNG thuộc Tuấn Anh

Để tránh tranh cãi phạm vi khi demo, Tuấn Anh **chỉ chịu trách nhiệm** với:

1. Website chạy được local và demo được.
2. Microphone → tiếng Việt → text → JSON.
3. Gửi được JSON sang backend (mock hoặc thật).
4. UI đủ tốt để trình bày với giảng viên.

Không chịu trách nhiệm:

- Câu lệnh có được hiểu đúng thiết bị/hành động không → **Giáp**.
- Câu lệnh có đến được ThingsBoard không → **Khôi**.
- Thiết bị có bật/tắt thật không → **Tâm**.

Nếu demo nói "bật quạt" mà quạt không quay, lỗi đó **không thuộc** module này.

---

## 15. Phím tắt & mẹo demo

- `Ctrl+Shift+M`: bật/tắt micro.
- Nhập tay trực tiếp vào ô transcript cũng hoạt động — không bắt buộc dùng micro.
- Trong mock mode, mở **DevTools → Console** để xem payload JSON.
- Mở **DevTools → Network** (khi `mockMode = false`) để xem request thật.

---

## 16. Troubleshooting nhanh

| Triệu chứng                                  | Nguyên nhân / Cách xử lý                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Micro bị disabled ngay khi mở trang          | Browser không hỗ trợ STT (Firefox). Bạn vẫn nhập tay + bấm Gửi bình thường.                   |
| "Không thể kết nối backend"                  | Backend chưa chạy, hoặc CORS chặn, hoặc URL sai. Kiểm tra `config.js` và đặt `mockMode = true` để demo tạm. |
| Micro bật nhưng không thấy interim           | Bấm nói **ngay** sau khi bấm micro. Browser đôi khi bỏ qua vài trăm ms đầu.                   |
| Transcript tiếng Anh                         | Một số browser không hỗ trợ `vi-VN`. Thử Chrome/Edge.                                        |
| Transcript có dấu câu lạ                    | Bình thường. Frontend giữ nguyên text — Giáp sẽ lo phần chuẩn hoá.                            |

---

## 17. License & bàn giao

Đồ án nội bộ lớp, nhóm 4 thành đồ án cuối kỳ IoT. Khi bàn giao cho thành viên khác, đảm bảo:

- `config.js` đã trỏ đúng backend thật.
- `mockMode = false`.
- README đã đọc.

Liên hệ Tuấn Anh nếu cần thay đổi hợp đồng frontend ↔ backend.