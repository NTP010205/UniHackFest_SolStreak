# Trạng thái triển khai theo lộ trình SolStreak

Cập nhật: 2026-08-27

## Giai đoạn 0 — quyết định nền tảng

- Đã dùng `VersionedTransaction` và blockhash lấy sát thời điểm ký.
- Đã chuyển cấu hình mặc định sang Jupiter Earn mainnet + USDC mainnet.
- Chưa kiểm chứng nạp/rút bằng ví Privy và một khoản tiền thật rất nhỏ.
- Không được coi public RPC là cấu hình production; cần RPC riêng.

## Giai đoạn 1 — Privy

- Đã có đăng nhập email/SMS và ví Solana embedded.
- Đã nâng lên Privy React SDK 3.38 và chuẩn Solana wallet mới.
- API backend xác minh identity token và địa chỉ Solana liên kết.
- Cần bật `Return user data in an identity token` trong Privy Dashboard.
- Cần test thủ công OTP, tạo ví mới và ký giao dịch với App ID/domain production.

## Giai đoạn 2 — Jupiter Earn

- Đã có build, ký, gửi và confirm giao dịch nạp/rút.
- Đã dùng duy nhất helper USDC 6 decimals và có unit test.
- Đã đọc vị thế Jupiter hiện tại (`underlyingAssets`) cho dashboard.
- Backend chỉ công nhận deposit gọi đúng Jupiter Lending program và có USDC giảm.
- Chưa test ví hoàn toàn mới, thiếu ATA, thiếu SOL gas và xác nhận chậm >60 giây.
- Chưa có retry UI riêng khi giao dịch thành công nhưng báo streak thất bại.

## Giai đoạn 3 — streak backend

- Đã có schema Postgres cho users, deposits, streaks và spins.
- Đã bind Privy user với wallet, chống đổi sang wallet của người khác.
- Đã xác minh transaction on-chain và chống replay bằng signature primary key.
- Đã có quy tắc ngày Việt Nam với grace window 03:00 và unit test.
- Đã có migration `npm run db:migrate`.
- Còn thiếu cron quét lịch sử theo giờ để phục hồi report bị bỏ lỡ.
- Còn thiếu integration test với Postgres và RPC thật.

## Giai đoạn 4 — vòng quay

- Kết quả được tạo ở backend; trọng số không nằm trong bundle client.
- Eligibility dựa trên streak đã xác minh, không dựa vào dữ liệu trình duyệt.
- Mỗi wallet chỉ có một spin mỗi ngày Việt Nam, được enforce bằng unique constraint.
- Prize được lưu bền vững trong bảng `spins`.
- Chưa có màn hình bộ sưu tập/quy trình thực thi fee discount hoặc phần thưởng.
- Các reward mang giá trị tiền phải được xem là demo cho đến khi có treasury và rule rõ ràng.

## Giai đoạn 5 — Anchor vault khóa kỳ hạn

- Chưa triển khai, có chủ đích.
- Theo chính roadmap, chỉ bắt đầu sau khi luồng Privy → Jupiter nạp/rút thật đã chạy hai chiều.
- Máy hiện chưa có Rust/Anchor và chưa có mainnet-fork fixture cho Jupiter CPI.
- Không deploy mainnet trước khi có giới hạn tiền nạp, integration tests, treasury policy và audit.

## Giai đoạn 6 — demo và deploy

- Có branding Jupiter và cảnh báo lợi suất biến động, không bảo đảm.
- Đã bỏ con số APY tĩnh `6%+` và đọc vị thế Jupiter thật.
- Production build và TypeScript pass trên Next.js 16 / React 19.
- Còn cần `DATABASE_URL`, RPC riêng, Privy identity-token setting và domain production.
- Chưa có rà soát pháp lý, monitoring, error tracking, backup/restore và incident runbook.

## Gate trước khi dùng tiền thật

1. Bật identity token trong Privy và migrate Postgres.
2. Dùng RPC mainnet riêng; không để secret RPC trong biến `NEXT_PUBLIC_*`.
3. Test OTP → tạo ví → cấp SOL gas → nạp USDC nhỏ → thấy vị thế → rút hết.
4. Test report lặp lại, transaction giả, wallet khác và spin đồng thời.
5. Thêm cron reconciliation, monitoring và cảnh báo RPC/database.
6. Chỉ sau đó mới bắt đầu prototype Anchor trên mainnet fork/local validator.
