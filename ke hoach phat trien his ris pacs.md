# Roadmap Phát Triển Hệ Thống HIS - RIS - PACS

---

## Phase 1: Mục tiêu tạo ra phần mềm thay thế 1:1 cho bộ HIS - RIS - Đọc phim hiện tại

### HIS & RIS:
- Tiếp nhận & chỉ định dịch vụ
- Booking form nhúng website <!---Bổ sung--->
- Quản lý bệnh nhân
- Phòng chờ CLS
- Danh mục dịch vụ, loại dịch vụ
- Danh mục chuyên khoa  (chung) <!---Edit--->

- Quản lý Viện phí
- Nhóm thuế dịch vụ (sử dụng trong hóa đơn điện tử) <!---Nằm trong config admin không cần show ra, config theo từng chi nhánh--->
- Tích hợp xuất hddt misa
- Chương trình khuyến mãi & quản lý mã khuyến mãi
- Portal cho bệnh nhân <!---Quản lý lịch sử khám, chi phí ,link kết quả theo từn đợt khám bệnh, đánh giá feedback về chất lượng DV --->

- Danh mục đối tác giới thiệu (bs hoặc phòng khám hoặc bệnh viện khác)
- Quản lý nhóm hoa hồng
- Portal cho đối tác để đẩy bệnh nhân sang

- Quản lý kho <!---Bổ sung--->
- Nhập xuất kho 
- Danh mục vật tư, nhóm vật tư, nhà cung cấp. Có quản lý lô hạn
- Định mức CLS <!---Mapping vật tư với dịch vụ để trừ tự động--->
- Báo cáo nhập, xuất, xuất nhập tồn, thẻ kho

- Quản lý thiết bị, danh mục thiết bị, bảo trì, bảo dưỡng định kỳ, nhập thông số hàng ngày <!---Edit--->
- Quản lý tích hợp <!---Bổ sung--->
- Quản lý nhân sự & phân quyền <!---Edit--->
- Danh mục cơ sở y tế (theo BYT)
- Danh mục đơn vị hành chính (tỉnh, xã phường)

- Tích hợp zalo ZBS: gửi kết quả chụp chiếu

- Các report hiện tại đang sử dụng

---

### Đọc phim:
- Tính năng đọc phim: Cần làm lại giao diện, giao diện gom dịch vụ hiện tại chưa hợp lý. 


Nhưng về cơ bản là thiết kế hiện tại đang đủ đáp ứng nghiệp vụ, nhưng chưa thân thiện với manager & user. Ví dụ modality group theo loại chứ không phải cơ sở <!---Edit--->

---

### Local Gateway Server:
- Nhận data từ máy chụp chiếu, gửi cho PACS server

---

### PACS:
- PACS server
- PACS viewer:
  + Viewer cho từng loại máy đặc thù  <!---Bổ sung--->
  + Render server hay render Client? Với từng loại thiết bị đọc ảnh <!---Bổ sung--->

---

## Phase 2: Teleradiology Core + Vận hành cốt lõi

### Đọc phim — Điều phối:
- Điều phối đọc phim (ví dụ: theo chuyên khoa, modality, workload, ca trực...)
- Hàng đợi ưu tiên: (ví dụ: cấp cứu, VIP, SLA theo hợp đồng...)
- Phân bổ bs đọc trong hệ thống (bs ngoài để Phase 3)
- Dashboard năng suất cơ bản (ví dụ: số ca / bs, TAT, backlog...)
- Xuất báo cáo phục vụ việc tính thù lao đọc phim tự động (ví dụ: theo số ca, loại ca...)

### RIS — Tích hợp bệnh viện đối tác:
- Nhận chỉ định chụp chiếu từ HIS-RIS bệnh viện
- Trả kết quả đã duyệt về bệnh viện
- Đồng bộ thông tin bệnh nhân
- Quản lý thông tin tích hợp
- Cổng đối tác bệnh viện (tối giản): (ví dụ: trạng thái ca gửi, kết quả...)

### PACS — Nhận data từ PACS bệnh viện (MVP):
- DICOM C-STORE SCP: nhận study từ PACS bệnh viện đối tác

### HRM:
- Hồ sơ nhân sự mở rộng (ví dụ: hợp đồng, phụ lục, chứng chỉ hành nghề + cảnh báo hết hạn...)
- Quản lý nghỉ phép, OT, đăng ký ca cơ bản
- Cơ cấu tổ chức (ví dụ: phòng ban, chức danh, phân quyền theo vai trò...)

### CRM:
- Quản lý Lead & nguồn Lead (ví dụ: booking form, Zalo, hotline, đối tác, walk-in...)
- Lead funnel cơ bản (ví dụ: new → contacted → scheduled → converted...)
- Lead Task: giao việc chăm sóc lead, theo dõi trạng thái
- Nhắc tái khám / recall qua Zalo ZBS theo lịch đơn giản

### Giao việc & Workflow:
- Giao & theo dõi task theo cá nhân / phòng ban
- Gắn task với bệnh nhân / ca chụp / hợp đồng đối tác
- Checklist cơ bản cho quy trình lặp lại

### KPI/OKR:
- KPI bs đọc phim (ví dụ: số ca, TAT, tỉ lệ trễ SLA...) — đo tự động từ luồng ca
- KPI sales / marketing: số lead, conversion rate, doanh số theo nguồn
- KPI vận hành chi nhánh: số ca chụp, doanh thu, công nợ
- Dashboard tổng hợp theo cá nhân / phòng ban / chi nhánh

### Hạ tầng hỗ trợ:
- Audit log cho toàn bộ luồng ca: nhận → điều phối → đọc → duyệt → trả về
- Báo cáo vận hành: TAT trung bình, SLA miss

---

## Phase 3: Mở rộng nền tảng & nghiệp vụ

### Nghiệp vụ lâm sàng mở rộng:
- Khám bệnh ngoại trú: hồ sơ bệnh án, đơn thuốc, phác đồ, tái khám
- LIS: quản lý xét nghiệm
- Hồ sơ bệnh nhân tổng hợp: liên kết kết quả CĐHA + XN + khám lâm sàng theo đợt điều trị

### Telerad Network — Mở rộng bác sĩ bên ngoài:
- Onboarding bs cộng tác: hợp đồng, NDA, chứng chỉ hành nghề, credentialing
- Marketplace đọc phim: bệnh viện đẩy ca → network bs ngoài nhận
- Điều phối tự động theo chuyên khoa + giá + SLA + đánh giá bs
- Peer review / double reading cho ca phức tạp & QA lấy mẫu
- Tính thù lao tự động theo số ca, độ phức tạp, SLA compliance
- Đánh giá chất lượng bs: discrepancy rate, TAT, peer-review pass rate

### HRM (mở rộng từ Phase 2):
- Tính lương & phụ cấp (ví dụ: theo ca, doanh số, KPI, hoa hồng đọc phim...)
- Đào tạo & chứng chỉ hành nghề (ví dụ: tracking completion, cảnh báo hết hạn...)
- Đánh giá nhân sự định kỳ
- Báo cáo nhân sự cơ bản

### CRM & Marketing Automation (mở rộng từ Phase 2):
- Lead funnel nâng cao
- Marketing automation (ví dụ: Zalo OA / SMS / Email theo trigger — sinh nhật, tái khám, bỏ lịch...)
- Loyalty & thẻ thành viên
- Ticket chăm sóc khách hàng + khảo sát feedback

### Workflow & SOP (mở rộng từ Phase 2):
- SLA theo từng bước, cảnh báo trễ hạn
- Thư viện SOP chuẩn hóa (ví dụ: vận hành, CĐHA, tiếp nhận...)

### KPI / OKR (mở rộng từ Phase 2):
- OKR theo quý, cascade công ty → team → cá nhân
- Gắn KPI với lương thưởng & hoa hồng
- BI dashboard đa chi nhánh với drill-down cơ bản

### AI Clinical:
- Tích hợp AI screening / CAD: X-quang ngực, CT phổi, nhũ ảnh, sọ não, xương khớp
- AI triage worklist: suspected critical lên đầu hàng đợi
- Second-opinion AI cho bs đọc phim
- Tích hợp vendor AI có chứng nhận FDA / CE / BYT
- Đo lường hiệu quả AI: sensitivity, specificity, thời gian tiết kiệm

### PACS Enterprise:
- Nén lossless, de-duplication, quản lý dung lượng

---