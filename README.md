# AI Study Helper

Extension Chrome Manifest V3 đọc câu hỏi đang hiển thị, gửi nội dung đến Gemini API và hiện đáp án đề xuất ngắn gọn dạng `Câu 1: B` trong một bảng nổi. Extension không tự chọn và không nộp đáp án.

Sau khi nhận kết quả, extension tô nổi lựa chọn được AI đề xuất và gắn nhãn bên cạnh câu hỏi. Việc này chỉ thay đổi giao diện; radio vẫn do người dùng tự chọn.

Khi người dùng nhập xong API key, extension tự tải danh sách model mà key đó được phép dùng, ưu tiên model mạnh và mới nhất, rồi tự lưu lựa chọn. Khi chưa có key, danh sách model bị khóa để tránh hiển thị model không khả dụng.

Nếu model đang dùng trả lỗi quota, rate limit, quá tải tạm thời hoặc không còn khả dụng, extension tự thử tối đa 5 model Gemini phù hợp và lưu model dự phòng thành công để dùng cho những lần sau.

## Cài đặt

1. Mở `chrome://extensions`.
2. Bật **Developer mode**.
3. Chọn **Load unpacked** và chọn thư mục dự án này.
4. Tạo API key tại [Google AI Studio](https://aistudio.google.com/app/apikey).
5. Mở **Details → Extension options**, nhập Gemini API key rồi lưu.
6. Nhấn **Tải danh sách model**, chọn một model hỗ trợ `generateContent`, rồi lưu.
7. Mở trang bài học, bấm biểu tượng extension và chọn **Phân tích trang này**.

## Lưu ý bảo mật và chi phí

- API key nằm trong `chrome.storage.local` của profile Chrome. Không commit key vào mã nguồn và không chia sẻ profile trình duyệt.
- Các câu hỏi được gửi đến Google Gemini để xử lý và có thể phát sinh phí API.
- Với bản phát hành cho nhiều người dùng, nên thay API key phía client bằng một backend riêng có xác thực và giới hạn lưu lượng.

## Cấu trúc

- `content.js`: đọc câu hỏi và hiển thị bảng kết quả.
- `background.js`: gọi Gemini `generateContent` API.
- `options.*`: lưu API key và tên model.
- `popup.*`: nút bắt đầu phân tích.
# AI_extension
