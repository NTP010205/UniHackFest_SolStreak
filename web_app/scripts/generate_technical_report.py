from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = REPOSITORY_ROOT / "docs" / "reports" / "Bao_cao_ky_thuat_SolStreak.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
pdfmetrics.registerFont(TTFont("DejaVu", FONT))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", FONT_BOLD))

PAGE_W, PAGE_H = A4
NAVY = colors.HexColor("#111827")
PURPLE = colors.HexColor("#6D28D9")
VIOLET_LIGHT = colors.HexColor("#EDE9FE")
GREEN = colors.HexColor("#166534")
GREEN_BG = colors.HexColor("#DCFCE7")
AMBER = colors.HexColor("#92400E")
AMBER_BG = colors.HexColor("#FEF3C7")
RED = colors.HexColor("#991B1B")
RED_BG = colors.HexColor("#FEE2E2")
GRAY = colors.HexColor("#4B5563")
GRAY_BG = colors.HexColor("#F3F4F6")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyVN", parent=styles["BodyText"], fontName="DejaVu", fontSize=9.2, leading=13.2, textColor=NAVY, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallVN", parent=styles["BodyText"], fontName="DejaVu", fontSize=7.7, leading=10.5, textColor=GRAY))
styles.add(ParagraphStyle(name="TitleVN", parent=styles["Title"], fontName="DejaVu-Bold", fontSize=25, leading=31, alignment=TA_CENTER, textColor=PURPLE))
styles.add(ParagraphStyle(name="SubTitleVN", parent=styles["BodyText"], fontName="DejaVu", fontSize=12, leading=17, alignment=TA_CENTER, textColor=GRAY))
styles.add(ParagraphStyle(name="H1VN", parent=styles["Heading1"], fontName="DejaVu-Bold", fontSize=16, leading=21, textColor=PURPLE, spaceBefore=8, spaceAfter=8))
styles.add(ParagraphStyle(name="H2VN", parent=styles["Heading2"], fontName="DejaVu-Bold", fontSize=11.5, leading=15, textColor=NAVY, spaceBefore=7, spaceAfter=5))
styles.add(ParagraphStyle(name="TableVN", parent=styles["BodyText"], fontName="DejaVu", fontSize=7.4, leading=10, textColor=NAVY))
styles.add(ParagraphStyle(name="TableHeadVN", parent=styles["BodyText"], fontName="DejaVu-Bold", fontSize=7.5, leading=10, textColor=colors.white, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="CodeVN", parent=styles["Code"], fontName="DejaVu", fontSize=7.2, leading=10, textColor=NAVY, backColor=GRAY_BG, borderPadding=7))


def p(text, style="BodyVN"):
    return Paragraph(text, styles[style])


def bullets(items):
    out = []
    for item in items:
        out.append(Paragraph("• " + item, styles["BodyVN"]))
    return out


def table(headers, rows, widths):
    data = [[Paragraph(x, styles["TableHeadVN"]) for x in headers]]
    for row in rows:
        data.append([Paragraph(str(x), styles["TableVN"]) for x in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PURPLE),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CBD5E1")),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return t


def status_box(title, text, color, background):
    t = Table([[p(title, "H2VN"), p(text, "BodyVN")]], colWidths=[43 * mm, 127 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), background),
        ("BOX", (0, 0), (-1, -1), 0.7, color),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setStrokeColor(colors.HexColor("#DDD6FE"))
        canvas.line(20 * mm, PAGE_H - 14 * mm, PAGE_W - 20 * mm, PAGE_H - 14 * mm)
        canvas.setFont("DejaVu", 7.5)
        canvas.setFillColor(GRAY)
        canvas.drawString(20 * mm, PAGE_H - 11 * mm, "SOLSTREAK — Báo cáo kiểm toán kỹ thuật")
        canvas.drawRightString(PAGE_W - 20 * mm, 11 * mm, f"Trang {doc.page}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT),
    pagesize=A4,
    rightMargin=18 * mm,
    leftMargin=18 * mm,
    topMargin=20 * mm,
    bottomMargin=18 * mm,
    title="Báo cáo kỹ thuật đồ án SolStreak",
    author="SolStreak Development Team",
    subject="Kiến trúc, hạ tầng, luồng hoạt động và kiểm toán theo lộ trình kỹ thuật",
)

story = []

# Cover
story += [Spacer(1, 28 * mm), p("SOLSTREAK", "TitleVN"), Spacer(1, 5 * mm)]
story += [p("BÁO CÁO KỸ THUẬT VÀ KIỂM TOÁN HIỆN TRẠNG", "SubTitleVN"), Spacer(1, 14 * mm)]
story += [status_box("KẾT LUẬN KIỂM TOÁN", "CHƯA đáp ứng đầy đủ toàn bộ lộ trình PDF. Phase 1–4 đã có nền tảng chạy được; Phase 5 Anchor chưa triển khai và một số gate tích hợp/production còn thiếu.", AMBER, AMBER_BG), Spacer(1, 12 * mm)]
story += [table(["Thuộc tính", "Giá trị"], [
    ["Tài liệu đối chiếu", "docs/plans/SolStreak_lo_trinh_ky_thuat.pdf — 16 trang"],
    ["Ngày kiểm toán", "27/08/2026"],
    ["Phạm vi", "Ứng dụng web động, API backend, Privy, Jupiter Earn, Solana RPC, PostgreSQL, vòng quay, Anchor roadmap"],
    ["Môi trường xác minh", "Localhost/WSL để test model; chưa triển khai public web"],
    ["Bằng chứng", "7/7 unit tests pass; TypeScript pass; Next.js production build pass; 4 bảng Supabase tồn tại"],
], [45 * mm, 125 * mm]), Spacer(1, 20 * mm)]
story += [p("Tài liệu này không chứa private key, seed phrase, database password hoặc API key.", "SmallVN"), PageBreak()]

# Executive summary
story += [p("1. Tóm tắt điều hành", "H1VN")]
story += [p("SolStreak là ứng dụng tiết kiệm USDC dạng web động trên Solana. Người dùng đăng nhập bằng email/SMS qua Privy, sử dụng ví Solana embedded để ký giao dịch nạp/rút Jupiter Earn, duy trì chuỗi ngày tiết kiệm và nhận lượt quay thưởng do backend quyết định.")]
story += [p("Kiểm toán cho thấy kiến trúc cốt lõi của Phase 1–4 đã được triển khai: frontend Next.js, ví Privy, transaction builder Jupiter, xác minh deposit on-chain, Postgres bền vững, streak có múi giờ Việt Nam và wheel có unique constraint. Tuy nhiên, dự án chưa thể được tuyên bố hoàn tất toàn bộ roadmap vì thiếu cron reconciliation, test tích hợp tiền thật, test ví mới/thiếu gas/blockhash timeout, hệ thống vận hành production và chương trình Anchor khóa kỳ hạn.")]
story += [status_box("Mức sẵn sàng hiện tại", "Sẵn sàng cho kiểm thử localhost có kiểm soát. Chưa sẵn sàng nhận tiền công chúng hoặc deploy Anchor/mainnet.", AMBER, AMBER_BG), Spacer(1, 6 * mm)]
story += [p("Nguyên tắc triển khai", "H2VN")]
story += bullets([
    "Bám sát thứ tự ba cửa kỹ thuật trong roadmap: Privy → Jupiter Earn → Anchor vault.",
    "Localhost chỉ dùng để kiểm thử model và tích hợp. Chỉ chuyển sang web động công khai khi các gate ổn định đã đạt.",
    "Mọi thay đổi ngoài roadmap phải được chủ dự án xét duyệt trước.",
    "Không gọi lợi suất là cố định; luôn ghi rõ ước tính, biến động theo thị trường và không được đảm bảo.",
])

# Ecosystem
story += [p("2. Hệ sinh thái và cơ sở hạ tầng", "H1VN")]
story += [table(["Thành phần", "Vai trò", "Hiện trạng"], [
    ["Next.js 16 + React 19", "Web động, giao diện, API route và server-side logic", "Build production đạt"],
    ["Privy React SDK 3.38", "OTP email/SMS, user session, Solana embedded wallet, identity token", "Đã tích hợp; cần test OTP thực tế/domain"],
    ["Solana / Agave RPC", "Gửi, confirm và đọc transaction/versioned message", "Helius mainnet đã cấu hình"],
    ["Jupiter Earn SDK", "Tạo instruction nạp/rút và đọc vị thế USDC", "Đã tích hợp; chưa test hai chiều bằng khoản tiền nhỏ"],
    ["Supabase PostgreSQL", "Lưu users, deposits, streaks và spins", "Đã migrate và xác minh đủ 4 bảng"],
    ["Solana Explorer", "Liên kết kiểm tra signature công khai", "Đã cấu hình mainnet-beta"],
    ["Anchor", "Ống heo khóa kỳ hạn và CPI Jupiter", "Chưa triển khai theo đúng gate roadmap"],
    ["Hosting web động", "Cho phép người khác truy cập qua HTTPS/domain", "Chưa thực hiện; chỉ localhost"],
], [34 * mm, 84 * mm, 52 * mm]), Spacer(1, 7 * mm)]
story += [p("Sơ đồ kiến trúc logic", "H2VN")]
story += [p("Người dùng → Trình duyệt Next.js → Privy (OTP + ví) → Jupiter SDK → Helius RPC → Solana/Jupiter Earn<br/>Trình duyệt Next.js → API Route → Privy JWKS xác minh identity token → Supabase PostgreSQL<br/>API Route → Helius RPC đọc transaction → kiểm tra Jupiter program + USDC delta → cập nhật streak", "CodeVN")]
story += [p("Ranh giới tin cậy", "H2VN")]
story += bullets([
    "Frontend không được tự quyết định kết quả wheel hoặc tự cấp streak.",
    "Backend không tin wallet/signature trong JSON; wallet phải nằm trong identity token Privy đã ký.",
    "Backend đọc lại transaction từ RPC và chỉ ghi deposit khi giao dịch thành công, fee payer đúng, gọi đúng Jupiter Lending program và USDC của ví giảm.",
    "Private key không đi qua database hoặc backend SolStreak; việc ký diễn ra qua wallet Privy.",
])

# Requirement matrix
story += [PageBreak(), p("3. Ma trận đối chiếu yêu cầu trong PDF", "H1VN")]
matrix = [
    ["0", "VersionedTransaction; mainnet/devnet decision; gas do user trả; lãi biến động", "Một phần", "VersionedTransaction và nhãn biến động đã có. Chưa thử devnet/local fork và giao dịch tiền thật nhỏ."],
    ["1", "Privy email/SMS; embedded Solana wallet; ready/auth/wallet gate; sign thử message; bind user-wallet", "Gần đủ", "SDK, gate và identity-token binding đã có. Chưa có màn hình sign-message test và chưa ghi nhận test OTP thực tế."],
    ["2", "Jupiter deposit/withdraw; blockhash muộn; decimals; vị thế/lãi; test ví mới/thiếu SOL", "Một phần", "Build/sign/send/confirm, decimals và đọc vị thế đã có. Chưa test mainnet hai chiều, timeout và ví mới."],
    ["3", "Postgres; verify on-chain; replay-safe; streak 03:00 VN; cron reconciliation", "Phần lớn", "Schema, auth, verify, unique signature và grace window đã có. Thiếu cron và integration tests."],
    ["4", "Wheel random backend; một lượt hợp lệ; client chỉ chạy animation", "Phần lớn", "Backend quyết định, DB unique mỗi ngày, eligibility thật. Thiếu fulfillment/collection UI và rate-limit tổng quát."],
    ["5", "Anchor lock vault; Jupiter CPI; maturity/early withdrawal; cap; tests; audit", "Chưa làm", "Không có Anchor workspace/program/IDL/test. Đây là thiếu sót lớn nhất."],
    ["6", "Ghép demo; Jupiter attribution; on-ramp mock; câu hỏi rủi ro/pháp lý", "Một phần", "Branding/disclaimer có. Chưa có on-ramp mock, public hosting, pháp lý và incident answer pack hoàn chỉnh."],
]
story += [table(["Phase", "Yêu cầu chính", "Trạng thái", "Bằng chứng/thiếu sót"], matrix, [13 * mm, 59 * mm, 24 * mm, 74 * mm])]
story += [Spacer(1, 8 * mm), status_box("Kết luận", "Không đạt điều kiện 'đầy đủ toàn bộ PDF'. Có thể tiếp tục test Phase 1–4; không được bỏ qua Phase 2 gate để triển khai Anchor.", RED, RED_BG)]

# Flows
story += [PageBreak(), p("4. Cách hệ thống hoạt động", "H1VN")]
story += [p("4.1 Đăng nhập và gắn ví", "H2VN")]
story += bullets([
    "Người dùng chọn đăng nhập email hoặc SMS trong giao diện Privy.",
    "Privy xác thực OTP và tạo/khôi phục Solana embedded wallet.",
    "Frontend chỉ cho phép thao tác khi ready, authenticated và wallet đều tồn tại.",
    "Khi gọi API, frontend gửi identity token. Backend xác minh chữ ký token qua Privy JWKS và kiểm tra wallet thuộc linked_accounts.",
    "Lần đầu, privy_user_id được bind với wallet_address trong bảng users; lần sau không được đổi sang ví khác tùy ý.",
])
story += [p("4.2 Nạp USDC vào Jupiter Earn", "H2VN")]
story += bullets([
    "Frontend đổi số USDC sang base units 6 chữ số thập phân bằng helper dùng chung.",
    "Jupiter Earn SDK tạo instruction deposit cho USDC mainnet.",
    "Ứng dụng lấy blockhash gần thời điểm ký, dựng VersionedTransaction và yêu cầu ví Privy ký.",
    "Frontend gửi raw transaction qua RPC, chờ confirmed và nhận signature.",
    "Frontend báo signature cho /api/streak/report cùng identity token.",
    "Backend đọc lại transaction, kiểm tra fee payer, trạng thái, Jupiter program và chênh lệch USDC; sau đó insert deposits và cập nhật streak trong transaction Postgres.",
])
story += [p("4.3 Rút USDC", "H2VN")]
story += bullets([
    "Jupiter SDK dựng instruction withdraw theo amount người dùng nhập.",
    "Ví Privy ký; frontend gửi và confirm qua RPC.",
    "Withdraw không tăng streak. Dashboard đọc underlyingAssets để hiển thị vị thế có thể quy đổi, gồm lợi suất biến động.",
])
story += [p("4.4 Streak", "H2VN")]
story += bullets([
    "Mỗi signature chỉ được ghi một lần vì là primary key.",
    "streakDay = thời gian block trừ 3 giờ rồi quy đổi theo Asia/Ho_Chi_Minh.",
    "Nạp nhiều lần cùng streakDay không tăng thêm ngày; ngày liên tiếp tăng current_streak; bị đứt thì bắt đầu lại từ 1.",
    "longest_streak giữ kỷ lục lớn nhất.",
])
story += [p("4.5 Lucky wheel", "H2VN")]
story += bullets([
    "API xác minh identity token và streak còn hiệu lực.",
    "Backend chọn prize theo trọng số; trọng số không nằm trong client bundle.",
    "Bảng spins có unique(wallet_address, spin_day), ngăn hai request đồng thời nhận hai lượt.",
    "Client chỉ nhận result rồi tính góc animation để kim dừng đúng ô.",
])

# Data model and security
story += [PageBreak(), p("5. Mô hình dữ liệu", "H1VN")]
story += [table(["Bảng", "Khóa/ràng buộc", "Mục đích"], [
    ["users", "privy_user_id PK; wallet_address UNIQUE", "Gắn một danh tính Privy với ví Solana đã xác minh"],
    ["deposits", "signature PK; FK wallet; amount > 0; streak_day index", "Lưu deposit đã xác minh và chống replay"],
    ["streaks", "wallet_address PK/FK; current/longest >= 0", "Trạng thái chuỗi ngày hiện tại và kỷ lục"],
    ["spins", "BIGSERIAL PK; UNIQUE wallet + spin_day", "Lưu kết quả wheel bền vững và chống quay lặp"],
], [31 * mm, 66 * mm, 73 * mm])]
story += [p("6. An toàn và kiểm soát rủi ro", "H1VN")]
story += [table(["Rủi ro", "Kiểm soát hiện có", "Còn thiếu"], [
    ["Giả mạo wallet", "Privy identity token + linked Solana wallet", "Test token hết hạn/rotation/JWKS outage"],
    ["Replay signature", "deposits.signature là primary key", "Load/concurrency integration test"],
    ["Báo giao dịch không phải deposit", "Fee payer + Jupiter program + USDC decrease", "Kiểm tra discriminator/expected accounts sâu hơn"],
    ["Wheel gian lận", "Random ở backend + unique DB", "CSPRNG/audit log nếu phần thưởng có giá trị"],
    ["RPC rate limit/outage", "RPC riêng, lỗi được trả về API", "Retry policy, multi-RPC failover, monitoring"],
    ["Lộ secret", ".env.local bị gitignore", "Rotate các secret đã chia sẻ; secret manager trên hosting"],
    ["Lợi suất thiếu hụt", "UI ghi rõ biến động, không đảm bảo", "Treasury policy; không cam kết fixed tier"],
    ["Anchor mất tiền", "Chưa deploy khi chưa test/audit", "Program tests, cap, fork, audit độc lập"],
], [35 * mm, 68 * mm, 67 * mm])]

# Verification
story += [PageBreak(), p("7. Bằng chứng kiểm thử tại thời điểm báo cáo", "H1VN")]
story += [table(["Hạng mục", "Kết quả", "Phạm vi"], [
    ["Unit tests", "PASS — 3 files, 7 tests", "USDC decimals; grace 03:00; streak duplicate/consecutive/reset; wheel weights/boundaries"],
    ["TypeScript", "PASS", "npx tsc --noEmit"],
    ["Production build", "PASS", "Next.js 16.3.3; static pages + 3 dynamic API routes"],
    ["Database", "PASS", "Supabase có users, deposits, streaks, spins"],
    ["Privy OTP", "CHƯA CÓ BẰNG CHỨNG", "Cần test thủ công email/SMS và domain localhost"],
    ["Jupiter mainnet E2E", "CHƯA TEST", "Cần SOL gas + USDC rất nhỏ; deposit rồi withdraw"],
    ["Cron reconciliation", "KHÔNG TỒN TẠI", "Chưa có endpoint/job và test"],
    ["Anchor", "KHÔNG TỒN TẠI", "Chưa có program, IDL, local validator test hoặc audit"],
], [38 * mm, 38 * mm, 94 * mm])]
story += [p("Cảnh báo build bigint-buffer chuyển sang pure JavaScript không làm build thất bại, nhưng dependency audit vẫn còn advisory bắc cầu từ hệ Solana/Jupiter/Privy. Không dùng npm audit fix --force vì có thể hạ/bẻ API; cần theo dõi upstream và đánh giá từng advisory trước production.", "SmallVN")]

# Gaps
story += [p("8. Thiếu sót và hạng mục cần bổ sung", "H1VN")]
story += [table(["Ưu tiên", "Hạng mục", "Điều kiện hoàn thành"], [
    ["P0", "Test Privy → Jupiter hai chiều", "OTP, ví mới, ký, deposit USDC nhỏ, position tăng, withdraw hết, Explorer xác nhận"],
    ["P0", "Cron reconciliation", "Quét transaction định kỳ; idempotent; secret cron; phục hồi report bị bỏ lỡ"],
    ["P0", "Integration tests", "Postgres test DB + RPC fixtures; auth giả mạo; replay; concurrency spin; RPC failure"],
    ["P0", "Secret rotation", "Đổi DB password và RPC key đã từng chia sẻ; cấu hình secret manager/domain restriction"],
    ["P1", "Transaction recovery UX", "Giao dịch thành công nhưng report lỗi có nút retry, không yêu cầu nạp lại"],
    ["P1", "RPC resilience", "Timeout, retry có backoff, failover provider, metrics và alert"],
    ["P1", "Reward fulfillment", "Định nghĩa badge/discount/jackpot; collection UI; ledger/audit; treasury nếu có tiền"],
    ["P1", "Rate limiting", "Giới hạn auth user/IP cho status/report/spin; chống RPC/database abuse"],
    ["P1", "Dynamic hosting", "HTTPS, domain, env secrets, migrations, health check, logs, backups, rollback"],
    ["P2", "On-ramp mock", "UI minh họa được gắn nhãn coming soon đúng Phase 6"],
    ["P2", "Anchor vault", "Chỉ khởi động sau P0 E2E; CPI spike; cap; time tests; treasury policy; audit"],
    ["P2", "Pháp lý và incident plan", "Rà soát pháp lý Việt Nam; câu trả lời khi Jupiter/RPC/DB gặp sự cố"],
], [18 * mm, 59 * mm, 93 * mm])]

# Dynamic web deployment plan
story += [PageBreak(), p("9. Kế hoạch chuyển từ localhost sang web động", "H1VN")]
story += [p("Không triển khai public ngay ở trạng thái hiện tại. Lộ trình chuyển đổi đề xuất sau khi chủ dự án phê duyệt từng gate:")]
story += [table(["Gate", "Nội dung", "Tiêu chí duyệt"], [
    ["A — Local functional", "Privy login, dashboard DB, Jupiter read", "Không lỗi auth/database; dữ liệu đúng ví"],
    ["B — Mainnet micro test", "Deposit/withdraw khoản rất nhỏ", "Hai chiều thành công; streak đúng; không mất tiền"],
    ["C — Reliability", "Cron, retry, rate limit, monitoring", "Test failure/replay/concurrency đạt"],
    ["D — Security", "Rotate secret, dependency review, threat review", "Không còn secret lộ; risk acceptance được ký"],
    ["E — Staging web", "Hosting động + HTTPS + domain test", "Privy allowed origin, Supabase/RPC policy, logs và rollback"],
    ["F — Public demo", "Cho người khác truy cập", "Giới hạn tiền/rủi ro; disclaimer; support/incident owner"],
], [27 * mm, 75 * mm, 68 * mm])]
story += [p("Hạ tầng web động dự kiến", "H2VN")]
story += bullets([
    "Next.js Node runtime trên nền tảng hỗ trợ dynamic API routes và outbound TCP tới Postgres.",
    "Supabase Session/Transaction pooler phù hợp mô hình hosting; giới hạn connection pool phải được kiểm tra theo nền tảng.",
    "Biến NEXT_PUBLIC chỉ dành cho dữ liệu có thể lộ ở browser. DATABASE_URL và server RPC secret chỉ đặt trong secret manager.",
    "Migration chạy như bước phát hành có kiểm soát; backup trước thay đổi schema và có rollback plan.",
    "Health check, structured logs, error tracking, RPC latency/error rate, DB connection usage và cron result cần được giám sát.",
])

# Anchor decision
story += [p("10. Quyết định về Anchor vault", "H1VN")]
story += [status_box("CHƯA TRIỂN KHAI", "Đây là quyết định an toàn và phù hợp thứ tự roadmap, không phải lỗi bỏ sót vô tình. Không nên scaffold/deploy chương trình nhận tiền khi luồng Jupiter E2E chưa được xác nhận.", RED, RED_BG), Spacer(1, 5 * mm)]
story += bullets([
    "Cần cài Rust/Anchor và ghim version tương thích Solana/Agave.",
    "Bắt đầu bằng một CPI spike gọi Jupiter trên mainnet fork/local fixture, không bắt đầu từ full vault.",
    "Seed position phải có nonce/counter để một owner mở nhiều vị trí.",
    "Phép tính lãi dùng checked u128; test maturity ±1 giây, overflow, early withdrawal và protocol shortfall.",
    "Có cap amount on-chain, pause/emergency path, authority/treasury policy và audit độc lập trước mainnet.",
])

# Final conclusion
story += [PageBreak(), p("11. Kết luận và đề xuất quyết định", "H1VN")]
story += [p("SolStreak đã vượt qua mức mock UI ban đầu và có kiến trúc backend hợp lý cho streak/wheel. Các kiểm soát quan trọng — identity token, on-chain verification, replay-safe signature, grace window và persistence — đã hiện diện. Dù vậy, sản phẩm chưa hoàn tất toàn bộ tài liệu kỹ thuật và chưa được phép nhận tiền công chúng.")]
story += [status_box("Đề xuất", "Duyệt tiếp giai đoạn kiểm thử localhost Phase 1–4. Không duyệt public launch hoặc Anchor mainnet ở thời điểm báo cáo.", AMBER, AMBER_BG), Spacer(1, 8 * mm)]
story += [p("Thứ tự hành động tiếp theo", "H2VN")]
story += bullets([
    "1. Test đăng nhập Privy và bind đúng ví trên localhost.",
    "2. Test Jupiter deposit/withdraw khoản rất nhỏ với tài khoản riêng cho demo.",
    "3. Bổ sung cron reconciliation và integration test suite.",
    "4. Rotate toàn bộ credential đã từng xuất hiện trong trao đổi.",
    "5. Sau khi các gate đạt, dựng staging web động; chỉ public khi có monitoring/rollback.",
    "6. Cuối cùng mới phê duyệt prototype Anchor CPI theo Phase 5.",
])
story += [Spacer(1, 10 * mm), p("— Hết báo cáo —", "SubTitleVN")]

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUTPUT)
