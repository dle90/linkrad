/**
 * Seed extra catalog data
 * Run: node scripts/seed-catalogs-extra.js
 */
require('../db')
const now = () => new Date().toISOString()

const ReferralDoctor = require('../models/ReferralDoctor')
const PartnerFacility = require('../models/PartnerFacility')
const CommissionGroup = require('../models/CommissionGroup')
const CommissionRule = require('../models/CommissionRule')
const RegistrationReason = require('../models/RegistrationReason')
const BillingCancelReason = require('../models/BillingCancelReason')
const MedicalFacility = require('../models/MedicalFacility')
const TaxGroup = require('../models/TaxGroup')
const AdminUnit = require('../models/AdminUnit')

async function upsertAll(Model, items) {
  for (const item of items) {
    await Model.findByIdAndUpdate(item._id, { ...item, status: item.status || 'active', createdAt: now(), updatedAt: now() }, { upsert: true })
  }
}

async function seed() {
  console.log('Seeding extra catalogs...\n')

  // ── Referral Doctors ───────────────────────────────────
  await upsertAll(ReferralDoctor, [
    { _id: 'RD-1', code: 'BS-001', name: 'BS. Nguyễn Thanh Hải', phone: '0901001001', email: 'hai.nt@viettiep.vn', idCard: '031085001234', address: '12 Lạch Tray, Lê Chân, HP', gender: 'M', dob: '1975-03-15', specialty: 'Nội tổng quát', workplace: 'BV Việt Tiệp HP', area: 'Hải Phòng', paymentMethod: 'transfer', bankAccount: '0901001001', bankName: 'Vietcombank', assignedStaff: 'Nguyễn Thị Mai', firstReferralDate: '2024-01-10', contractDate: '2024-01-01', notes: 'Đối tác lâu năm' },
    { _id: 'RD-2', code: 'BS-002', name: 'BS. Trần Thị Phương', phone: '0901001002', email: 'phuong.tt@kienan.vn', idCard: '031090005678', address: '45 Trần Nhân Tông, Kiến An, HP', gender: 'F', dob: '1980-07-22', specialty: 'Ngoại thần kinh', workplace: 'BV Kiến An', area: 'Hải Phòng', paymentMethod: 'transfer', bankAccount: '0901001002', bankName: 'Techcombank', assignedStaff: 'Lê Văn Hoàng', firstReferralDate: '2024-02-15', contractDate: '2024-02-01' },
    { _id: 'RD-3', code: 'BS-003', name: 'BS. Lê Văn Đức', phone: '0901001003', email: 'duc.lv@bachmai.vn', idCard: '001078009012', address: '78 Giải Phóng, Đống Đa, HN', gender: 'M', dob: '1968-11-05', specialty: 'Chấn thương chỉnh hình', workplace: 'BV Bạch Mai', area: 'Hà Nội', paymentMethod: 'cash', bankAccount: '', bankName: '', assignedStaff: 'Nguyễn Thị Mai', firstReferralDate: '2024-03-01', contractDate: '2024-03-01' },
    { _id: 'RD-4', code: 'BS-004', name: 'PGS. Phạm Minh Tuấn', phone: '0901001004', email: 'tuan.pm@bvk.vn', idCard: '001070003456', address: '43 Quán Sứ, Hoàn Kiếm, HN', gender: 'M', dob: '1965-05-20', specialty: 'Ung bướu', workplace: 'BV K Hà Nội', area: 'Hà Nội', paymentMethod: 'transfer', bankAccount: '19001234567', bankName: 'BIDV', assignedStaff: 'Trần Minh Đức', firstReferralDate: '2024-04-10', contractDate: '2024-04-01', notes: 'PGS, chuyên gia đầu ngành' },
    { _id: 'RD-5', code: 'BS-005', name: 'BS. Vũ Thị Lan', phone: '0901001005', email: 'lan.vt@phusan.vn', idCard: '031082007890', address: '9 Lê Lợi, Ngô Quyền, HP', gender: 'F', dob: '1982-12-08', specialty: 'Sản phụ khoa', workplace: 'BV Phụ sản HP', area: 'Hải Phòng', paymentMethod: 'both', bankAccount: '0905001005', bankName: 'MB Bank', assignedStaff: 'Lê Văn Hoàng', firstReferralDate: '2024-05-20', contractDate: '2024-05-15' },
  ])
  console.log('✓ 5 bác sĩ giới thiệu')

  // ── Partner Facilities ─────────────────────────────────
  await upsertAll(PartnerFacility, [
    { _id: 'PF-1', code: 'DT-001', name: 'Bệnh viện Việt Tiệp Hải Phòng', type: 'hospital', phone: '02253747373', address: '1 Nhà Thương, Lê Chân, HP', specialty: 'Đa khoa', clinicHeadName: 'PGS. Trần Quang Minh', contactPerson: 'BS. Nguyễn Văn A', area: 'Hải Phòng', paymentMethod: 'transfer', bankAccount: '1234567890', bankName: 'Vietcombank', firstReferralDate: '2024-01-05', contractDate: '2024-01-01', assignedStaff: 'Nguyễn Thị Mai', notes: 'Đối tác chiến lược' },
    { _id: 'PF-2', code: 'DT-002', name: 'Bệnh viện Kiến An', type: 'hospital', phone: '02253877777', address: 'Kiến An, HP', specialty: 'Đa khoa', clinicHeadName: 'BS. Lê Hữu Trọng', contactPerson: 'BS. Trần Văn B', area: 'Hải Phòng', paymentMethod: 'transfer', bankAccount: '0987654321', bankName: 'BIDV', firstReferralDate: '2024-02-10', contractDate: '2024-02-01', assignedStaff: 'Lê Văn Hoàng' },
    { _id: 'PF-3', code: 'DT-003', name: 'Phòng khám Đa khoa An Dương', type: 'clinic', phone: '02253666666', address: 'An Dương, HP', specialty: 'Đa khoa', clinicHeadName: 'BS. Phạm Văn Hùng', contactPerson: 'Lê Thị C', area: 'Hải Phòng', paymentMethod: 'cash', bankAccount: '', bankName: '', firstReferralDate: '2024-03-15', contractDate: '2024-03-01', assignedStaff: 'Nguyễn Thị Mai' },
    { _id: 'PF-4', code: 'DT-004', name: 'BV Bạch Mai Hà Nội', type: 'hospital', phone: '02438693731', address: '78 Giải Phóng, HN', specialty: 'CĐHA', clinicHeadName: 'GS. Nguyễn Duy Huề', contactPerson: 'Phòng CĐHA', area: 'Hà Nội', paymentMethod: 'transfer', bankAccount: '5566778899', bankName: 'Agribank', firstReferralDate: '2024-04-01', contractDate: '2024-04-01', assignedStaff: 'Trần Minh Đức' },
    { _id: 'PF-5', code: 'DT-005', name: 'Xét nghiệm Medlatec HP', type: 'lab', phone: '02253888888', address: 'Ngô Quyền, HP', specialty: 'Xét nghiệm', clinicHeadName: 'TS. Vũ Minh Châu', contactPerson: 'Nguyễn Thị D', area: 'Hải Phòng', paymentMethod: 'both', bankAccount: '1122334455', bankName: 'Techcombank', firstReferralDate: '2024-05-01', contractDate: '2024-05-01', assignedStaff: 'Lê Văn Hoàng', notes: 'Đối tác XN' },
  ])
  console.log('✓ 5 cơ sở y tế đối tác')

  // ── Commission Groups ──────────────────────────────────
  await upsertAll(CommissionGroup, [
    { _id: 'CG-1', code: 'NHH-01', name: 'Hoa hồng CĐHA cơ bản', description: 'Áp dụng cho BS giới thiệu - dịch vụ CĐHA' },
    { _id: 'CG-2', code: 'NHH-02', name: 'Hoa hồng đối tác BV', description: 'Áp dụng cho BV đối tác gửi BN' },
    { _id: 'CG-3', code: 'NHH-03', name: 'Hoa hồng XN', description: 'Áp dụng cho dịch vụ xét nghiệm' },
  ])
  console.log('✓ 3 nhóm hoa hồng')

  // ── Commission Rules ───────────────────────────────────
  await upsertAll(CommissionRule, [
    { _id: 'CRL-1', commissionGroupId: 'CG-1', commissionGroupName: 'Hoa hồng CĐHA cơ bản', serviceName: 'Chụp CT (tất cả)', serviceTypeCode: 'CDHA', type: 'percentage', value: 10 },
    { _id: 'CRL-2', commissionGroupId: 'CG-1', commissionGroupName: 'Hoa hồng CĐHA cơ bản', serviceName: 'Chụp MRI (tất cả)', serviceTypeCode: 'CDHA', type: 'percentage', value: 12 },
    { _id: 'CRL-3', commissionGroupId: 'CG-1', commissionGroupName: 'Hoa hồng CĐHA cơ bản', serviceName: 'Siêu âm (tất cả)', serviceTypeCode: 'CDHA', type: 'fixed', value: 20000 },
    { _id: 'CRL-4', commissionGroupId: 'CG-2', commissionGroupName: 'Hoa hồng đối tác BV', serviceName: 'Tất cả dịch vụ CĐHA', serviceTypeCode: 'CDHA', type: 'percentage', value: 8 },
    { _id: 'CRL-5', commissionGroupId: 'CG-3', commissionGroupName: 'Hoa hồng XN', serviceName: 'Xét nghiệm máu', serviceId: 'SVC-12', type: 'percentage', value: 5 },
  ])
  console.log('✓ 5 quy tắc hoa hồng')

  // ── Registration Reasons ───────────────────────────────
  await upsertAll(RegistrationReason, [
    { _id: 'RR-1', code: 'LDDK-01', name: 'Khám theo lịch hẹn' },
    { _id: 'RR-2', code: 'LDDK-02', name: 'Khám tự đến' },
    { _id: 'RR-3', code: 'LDDK-03', name: 'Bác sĩ giới thiệu' },
    { _id: 'RR-4', code: 'LDDK-04', name: 'Tái khám' },
    { _id: 'RR-5', code: 'LDDK-05', name: 'Cấp cứu' },
    { _id: 'RR-6', code: 'LDDK-06', name: 'Đặt lịch online' },
  ])
  console.log('✓ 6 lý do phiếu đăng ký')

  // ── Billing Cancel Reasons ─────────────────────────────
  await upsertAll(BillingCancelReason, [
    { _id: 'BCR-1', code: 'LDHPT-01', name: 'Bệnh nhân yêu cầu hủy' },
    { _id: 'BCR-2', code: 'LDHPT-02', name: 'Nhập sai thông tin dịch vụ' },
    { _id: 'BCR-3', code: 'LDHPT-03', name: 'Nhập sai giá dịch vụ' },
    { _id: 'BCR-4', code: 'LDHPT-04', name: 'Trùng phiếu thu' },
    { _id: 'BCR-5', code: 'LDHPT-05', name: 'Thay đổi hình thức thanh toán' },
  ])
  console.log('✓ 5 lý do hủy phiếu thu')

  // ── Medical Facilities ─────────────────────────────────
  await upsertAll(MedicalFacility, [
    { _id: 'MF-1', code: 'CSYT-001', name: 'Bệnh viện Việt Tiệp', level: 'tinh', phone: '02253747373', address: 'Lê Chân, Hải Phòng', description: 'BV đa khoa hạng I tuyến tỉnh' },
    { _id: 'MF-2', code: 'CSYT-002', name: 'Bệnh viện Bạch Mai', level: 'trung_uong', phone: '02438693731', address: 'Giải Phóng, Hà Nội', description: 'BV đa khoa tuyến trung ương' },
    { _id: 'MF-3', code: 'CSYT-003', name: 'Bệnh viện Chợ Rẫy', level: 'trung_uong', phone: '02838554137', address: 'Q5, TP HCM', description: 'BV đa khoa tuyến trung ương phía Nam' },
    { _id: 'MF-4', code: 'CSYT-004', name: 'Bệnh viện Kiến An', level: 'huyen', phone: '02253877777', address: 'Kiến An, HP', description: 'BV đa khoa tuyến huyện' },
    { _id: 'MF-5', code: 'CSYT-005', name: 'Trạm Y tế Đường An', level: 'xa', phone: '02253000001', address: 'An Dương, HP', description: 'Trạm y tế tuyến xã' },
    { _id: 'MF-6', code: 'CSYT-006', name: 'Phòng khám Đa khoa Hải Phòng', level: 'phong_kham', phone: '02253111111', address: 'Ngô Quyền, HP', description: 'Phòng khám đa khoa tư nhân' },
  ])
  console.log('✓ 6 cơ sở y tế (theo BYT)')

  // ── Tax Groups ─────────────────────────────────────────
  await upsertAll(TaxGroup, [
    { _id: 'TG-1', code: 'NotTaxable', name: 'Nhóm không chịu thuế', description: 'KCT', vatType: 'exempt', rate: 0, branchCode: 'all' },
    { _id: 'TG-2', code: 'VAT10', name: 'Nhóm 10%', description: '', vatType: 'percentage', rate: 10, branchCode: 'all' },
    { _id: 'TG-3', code: 'VAT8', name: 'Nhóm 8%', description: '', vatType: 'percentage', rate: 8, branchCode: 'all' },
    { _id: 'TG-4', code: 'VAT5', name: 'Nhóm 5%', description: '', vatType: 'percentage', rate: 5, branchCode: 'all' },
    { _id: 'TG-5', code: 'VAT0', name: 'Nhóm 0%', description: '', vatType: 'percentage', rate: 0, branchCode: 'all' },
  ])
  console.log('✓ 4 nhóm thuế dịch vụ')

  // ── Admin Units (sample) ───────────────────────────────
  await upsertAll(AdminUnit, [
    { _id: 'AU-HP', code: '31', name: 'Thành phố Hải Phòng', level: 'province', parentCode: null, fullName: 'Thành phố Hải Phòng' },
    { _id: 'AU-HN', code: '01', name: 'Thành phố Hà Nội', level: 'province', parentCode: null, fullName: 'Thành phố Hà Nội' },
    { _id: 'AU-HCM', code: '79', name: 'Thành phố Hồ Chí Minh', level: 'province', parentCode: null, fullName: 'Thành phố Hồ Chí Minh' },
    { _id: 'AU-HP-LC', code: '31-03', name: 'Quận Lê Chân', level: 'district', parentCode: '31', fullName: 'Quận Lê Chân, TP Hải Phòng' },
    { _id: 'AU-HP-NQ', code: '31-01', name: 'Quận Ngô Quyền', level: 'district', parentCode: '31', fullName: 'Quận Ngô Quyền, TP Hải Phòng' },
    { _id: 'AU-HP-AD', code: '31-07', name: 'Huyện An Dương', level: 'district', parentCode: '31', fullName: 'Huyện An Dương, TP Hải Phòng' },
    { _id: 'AU-HP-KA', code: '31-09', name: 'Quận Kiến An', level: 'district', parentCode: '31', fullName: 'Quận Kiến An, TP Hải Phòng' },
    { _id: 'AU-HP-HB', code: '31-05', name: 'Quận Hải An', level: 'district', parentCode: '31', fullName: 'Quận Hải An, TP Hải Phòng' },
    { _id: 'AU-HP-AD-DA', code: '31-07-01', name: 'Xã Đường An', level: 'ward', parentCode: '31-07', fullName: 'Xã Đường An, Huyện An Dương, TP Hải Phòng' },
    { _id: 'AU-HP-AD-AD', code: '31-07-02', name: 'Thị trấn An Dương', level: 'ward', parentCode: '31-07', fullName: 'TT An Dương, Huyện An Dương, TP Hải Phòng' },
    { _id: 'AU-HP-LC-TL', code: '31-03-01', name: 'Phường Trại Lẻ', level: 'ward', parentCode: '31-03', fullName: 'Phường Trại Lẻ, Quận Lê Chân, TP Hải Phòng' },
    { _id: 'AU-HP-NQ-MP', code: '31-01-01', name: 'Phường Máy Phiên', level: 'ward', parentCode: '31-01', fullName: 'Phường Máy Phiên, Quận Ngô Quyền, TP Hải Phòng' },
  ])
  console.log('✓ 12 đơn vị hành chính mẫu (3 tỉnh, 5 quận/huyện, 4 phường/xã)')

  console.log('\n✅ Seed catalogs hoàn tất!')
  process.exit(0)
}

setTimeout(seed, 2000)
