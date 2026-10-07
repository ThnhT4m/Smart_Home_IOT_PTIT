# Smart Home IoT — Nhóm PTIT

Đồ án cuối kỳ môn IoT: **"Hệ thống IoT điều khiển thiết bị qua cloud bằng giọng nói"**.

Repo này chứa code của cả nhóm. **Mỗi thành viên push vào folder / branch riêng của mình.**

## Cấu trúc repo

| Folder / branch               | Thành viên | Phụ trách                                                  |
| ----------------------------- | ---------- | ---------------------------------------------------------- |
| `voice-web/`                  | **Tuấn Anh** | Web frontend + Web Speech API (vi-VN) → `{ "text": "..." }` |
| `backend/` _(chưa có)_        | Khôi       | Flask/Node.js + ThingsBoard REST/RPC                       |
| `nlp/` _(chưa có)_            | Giáp       | Text mapping: `text → { device, action, value }`          |
| `firmware/` _(KTGK02)_        | Tâm        | ESP32 + relay + sensor + ThingsBoard device + dashboard    |

> ⚠️ **Quy tắc bắt buộc**: mỗi người **chỉ push phần của mình**. Push vào branch riêng (`feature/<tên>-<phạmvi>`), mở PR để merge vào `main`. Đừng push code thành viên khác.

## Module của Tuấn Anh

Xem chi tiết tại [`voice-web/README.md`](voice-web/README.md) và
[`voice-web/docs/integration-contract.md`](voice-web/docs/integration-contract.md).

Tóm tắt:

- Web Speech API, ngôn ngữ `vi-VN`.
- Payload duy nhất frontend gửi đi: `{ "text": "<câu lệnh>" }`.
- Có **mock mode** để demo độc lập khi backend chưa sẵn sàng.
- Đổi `config.js` (`mockMode: false` + `backendEndpoint`) để kết nối backend thật.

## Hợp đồng tích hợp

Frontend → Backend:

```
POST /api/voice
Content-Type: application/json

{ "text": "bật quạt giúp tôi" }
```

Frontend **không** tự ý thêm `device`/`action`/`value` — đó là việc của Giáp/Khôi.

## Tài liệu gốc

- `BaiThucHanh.docx` _(để local, không commit)_