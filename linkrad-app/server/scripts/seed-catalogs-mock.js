/**
 * Seed mock catalog data for demo purposes.
 *
 * All docs get an `_id` containing `MOCK-` so a single regex-delete can
 * wipe them before real data import. See FOLLOWUPS.md → "Mock catalog
 * data — cleanup" for the remove script.
 *
 * Idempotent: upserts by _id so re-runs don't duplicate.
 * Usage: node scripts/seed-catalogs-mock.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
require('../db')

const Specialty = require('../models/Specialty')
const ServiceType = require('../models/ServiceType')
const TaxGroup = require('../models/TaxGroup')
const Service = require('../models/Service')
const MedicalFacility = require('../models/MedicalFacility')
const RegistrationReason = require('../models/RegistrationReason')
const BillingCancelReason = require('../models/BillingCancelReason')
const ReferralDoctor = require('../models/ReferralDoctor')
const PartnerFacility = require('../models/PartnerFacility')
const CommissionGroup = require('../models/CommissionGroup')
const CommissionRule = require('../models/CommissionRule')
const Study = require('../models/Study')

const now = () => new Date().toISOString()
const today = () => now().slice(0, 10)
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }
const hoursAgo = (n) => { const d = new Date(); d.setHours(d.getHours() - n); return d.toISOString() }
const ts = { createdAt: now(), updatedAt: now(), status: 'active' }

async function upsert(Model, docs, label) {
  for (const d of docs) {
    await Model.findByIdAndUpdate(d._id, { ...ts, ...d }, { upsert: true, new: true, setDefaultsOnInsert: true })
  }
  console.log(`✓ ${String(docs.length).padStart(3)} ${label}`)
}

async function seed() {
  console.log('Seeding mock catalog data (all _ids prefixed MOCK-)...\n')

  await upsert(Specialty, [
    { _id: 'SPEC-MOCK-01', code: 'CDHA',  name: 'Chẩn đoán hình ảnh', description: 'CT · MRI · US · XR' },
    { _id: 'SPEC-MOCK-02', code: 'NOI',   name: 'Nội khoa',           description: 'Nội tổng quát' },
    { _id: 'SPEC-MOCK-03', code: 'NGOAI', name: 'Ngoại khoa',         description: 'Ngoại tổng quát' },
    { _id: 'SPEC-MOCK-04', code: 'SAN',   name: 'Sản phụ khoa',       description: '' },
    { _id: 'SPEC-MOCK-05', code: 'NHI',   name: 'Nhi khoa',           description: '' },
    { _id: 'SPEC-MOCK-06', code: 'TIM',   name: 'Tim mạch',           description: '' },
  ], 'Chuyên khoa')

  await upsert(TaxGroup, [
    { _id: 'TAX-MOCK-01', code: 'VAT0',  name: 'Không chịu thuế', vatType: 'exempt',     rate: 0,  description: '' },
    { _id: 'TAX-MOCK-02', code: 'VAT5',  name: 'VAT 5%',          vatType: 'percentage', rate: 5,  description: '' },
    { _id: 'TAX-MOCK-03', code: 'VAT10', name: 'VAT 10%',         vatType: 'percentage', rate: 10, description: '' },
  ], 'Nhóm thuế dịch vụ')

  await upsert(ServiceType, [
    { _id: 'ST-MOCK-01', code: 'CDHA', name: 'Chẩn đoán hình ảnh', abbreviation: 'CĐHA', taxGroupId: 'TAX-MOCK-02', taxGroupName: 'VAT 5%',  sortOrder: 1 },
    { _id: 'ST-MOCK-02', code: 'XN',   name: 'Xét nghiệm',         abbreviation: 'XN',   taxGroupId: 'TAX-MOCK-02', taxGroupName: 'VAT 5%',  sortOrder: 2 },
    { _id: 'ST-MOCK-03', code: 'TDCN', name: 'Thăm dò chức năng',  abbreviation: 'TDCN', taxGroupId: 'TAX-MOCK-02', taxGroupName: 'VAT 5%',  sortOrder: 3 },
    { _id: 'ST-MOCK-04', code: 'KHAC', name: 'Khác',               abbreviation: 'KH',   taxGroupId: 'TAX-MOCK-03', taxGroupName: 'VAT 10%', sortOrder: 9 },
  ], 'Loại dịch vụ')

  await upsert(Service, [
    { _id: 'SVC-MOCK-001', code: 'SA020', name: 'Siêu âm ổ bụng tổng quát', serviceTypeCode: 'CDHA', modality: 'US',  bodyPart: 'Ổ bụng',     basePrice: 150000,unit: 'lần', technicalInfo: 'Máy SA 2D' },
    { _id: 'SVC-MOCK-002', code: 'SA026', name: 'Siêu âm tuyến giáp',       serviceTypeCode: 'CDHA', modality: 'US',  bodyPart: 'Tuyến giáp', basePrice: 150000,unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-003', code: 'SA028', name: 'Siêu âm vú hai bên',       serviceTypeCode: 'CDHA', modality: 'US',  bodyPart: 'Vú',         basePrice: 180000,unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-004', code: 'XQ001', name: 'X-Quang ngực thẳng',       serviceTypeCode: 'CDHA', modality: 'XR',  bodyPart: 'Ngực',       basePrice: 120000,unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-005', code: 'XQ002', name: 'X-Quang xương',            serviceTypeCode: 'CDHA', modality: 'XR',  bodyPart: 'Xương',      basePrice: 120000,unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-006', code: 'CT001', name: 'CT sọ não không tiêm',     serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Sọ não',     basePrice: 800000,unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-007', code: 'CT002', name: 'CT sọ não có tiêm thuốc',  serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Sọ não',     basePrice: 1200000, unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-008', code: 'CT003', name: 'CT ngực',                  serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Ngực',       basePrice: 900000,unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-009', code: 'CT004', name: 'CT bụng - tiểu khung',     serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Bụng',       basePrice: 1000000, unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-010', code: 'MR001', name: 'MRI sọ não',               serviceTypeCode: 'CDHA', modality: 'MRI', bodyPart: 'Sọ não',     basePrice: 2500000, unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-011', code: 'MR002', name: 'MRI cột sống thắt lưng',   serviceTypeCode: 'CDHA', modality: 'MRI', bodyPart: 'Cột sống',   basePrice: 2800000, unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-012', code: 'XN001', name: 'Công thức máu',            serviceTypeCode: 'XN',   modality: 'LAB', bodyPart: '',           basePrice: 80000,   unit: 'lần', technicalInfo: '' },
  ], 'Dịch vụ')

  await upsert(MedicalFacility, [
    { _id: 'MF-MOCK-01', code: 'BVBACH', name: 'Bệnh viện Bạch Mai',         level: 'trung_uong', phone: '02438693731', address: '78 Giải Phóng, Đống Đa, Hà Nội',    description: '' },
    { _id: 'MF-MOCK-02', code: 'BVVIET', name: 'Bệnh viện Hữu nghị Việt Đức', level: 'trung_uong', phone: '02438253531', address: '40 Tràng Thi, Hoàn Kiếm, Hà Nội',   description: '' },
    { _id: 'MF-MOCK-03', code: 'PKVIN',  name: 'Phòng khám Vinmec Times City',level: 'phong_kham', phone: '02439743556', address: '458 Minh Khai, Hai Bà Trưng, Hà Nội', description: '' },
  ], 'Cơ sở y tế')

  await upsert(RegistrationReason, [
    { _id: 'RR-MOCK-01', code: 'KHAMDK',  name: 'Khám định kỳ' },
    { _id: 'RR-MOCK-02', code: 'TRIEUC',  name: 'Có triệu chứng' },
    { _id: 'RR-MOCK-03', code: 'TAIKHAM', name: 'Tái khám theo hẹn' },
    { _id: 'RR-MOCK-04', code: 'KHAC',    name: 'Khác' },
  ], 'Lý do đăng ký')

  await upsert(BillingCancelReason, [
    { _id: 'BCR-MOCK-01', code: 'BNHUY',    name: 'Bệnh nhân hủy' },
    { _id: 'BCR-MOCK-02', code: 'NHAPSAI',  name: 'Nhập sai thông tin' },
    { _id: 'BCR-MOCK-03', code: 'KHAC',     name: 'Khác' },
  ], 'Lý do huỷ phiếu thu')

  await upsert(ReferralDoctor, [
    { _id: 'RD-MOCK-01', code: 'BS001', name: 'BS. Nguyễn Văn Hùng',   phone: '0912345001', specialty: 'Nội khoa',     workplace: 'BV Bạch Mai',    area: 'Hà Nội',     gender: 'M', paymentMethod: 'transfer', assignedStaff: '' },
    { _id: 'RD-MOCK-02', code: 'BS002', name: 'BS. Trần Thị Lan',      phone: '0912345002', specialty: 'Sản phụ khoa', workplace: 'BV Từ Dũ',       area: 'TP.HCM',     gender: 'F', paymentMethod: 'cash',     assignedStaff: '' },
    { _id: 'RD-MOCK-03', code: 'BS003', name: 'BS. Lê Minh Đức',       phone: '0912345003', specialty: 'Tim mạch',     workplace: 'Vinmec Central', area: 'Hà Nội',     gender: 'M', paymentMethod: 'transfer', assignedStaff: '' },
    { _id: 'RD-MOCK-04', code: 'BS004', name: 'BS. Phạm Thu Hương',    phone: '0912345004', specialty: 'Nhi khoa',     workplace: 'BV Nhi TW',      area: 'Hà Nội',     gender: 'F', paymentMethod: 'transfer', assignedStaff: '' },
  ], 'Bác sĩ giới thiệu')

  await upsert(PartnerFacility, [
    { _id: 'PF-MOCK-01', code: 'PF001', name: 'Phòng khám Đa khoa An Khang', type: 'clinic', phone: '02437654001', address: '15 Lý Thường Kiệt, Hà Nội',  specialty: 'Đa khoa',      area: 'Hà Nội',   paymentMethod: 'transfer', assignedStaff: '', clinicHeadName: 'BS. Đỗ Quốc Huy',  contactPerson: 'Chị Mai' },
    { _id: 'PF-MOCK-02', code: 'PF002', name: 'Bệnh viện Đa khoa Medlatec', type: 'hospital', phone: '02437654002', address: '42 Nghĩa Dũng, Hà Nội',     specialty: 'Đa khoa',      area: 'Hà Nội',   paymentMethod: 'transfer', assignedStaff: '', clinicHeadName: '',                  contactPerson: 'Anh Tuấn' },
    { _id: 'PF-MOCK-03', code: 'PF003', name: 'Trung tâm Xét nghiệm Medic',  type: 'lab',      phone: '02837654003', address: '254 Hoà Hảo, Q.10, TP.HCM', specialty: 'Xét nghiệm',   area: 'TP.HCM',   paymentMethod: 'cash',     assignedStaff: '', clinicHeadName: '',                  contactPerson: 'Chị Linh' },
  ], 'Cơ sở y tế đối tác')

  await upsert(CommissionGroup, [
    { _id: 'CG-MOCK-01', code: 'CHUAN', name: 'Nhóm tiêu chuẩn', description: 'Áp dụng cho BS/cơ sở mới' },
    { _id: 'CG-MOCK-02', code: 'VIP',   name: 'Nhóm VIP',        description: 'Ưu đãi cho đối tác lâu năm' },
  ], 'Nhóm hoa hồng')

  await upsert(CommissionRule, [
    { _id: 'CR-MOCK-01', commissionGroupId: 'CG-MOCK-01', commissionGroupName: 'Nhóm tiêu chuẩn', serviceId: 'SVC-MOCK-006', serviceName: 'CT sọ não không tiêm', serviceTypeCode: 'CDHA', type: 'percentage', value: 10 },
    { _id: 'CR-MOCK-02', commissionGroupId: 'CG-MOCK-01', commissionGroupName: 'Nhóm tiêu chuẩn', serviceId: 'SVC-MOCK-010', serviceName: 'MRI sọ não',          serviceTypeCode: 'CDHA', type: 'percentage', value: 10 },
    { _id: 'CR-MOCK-03', commissionGroupId: 'CG-MOCK-02', commissionGroupName: 'Nhóm VIP',        serviceId: 'SVC-MOCK-006', serviceName: 'CT sọ não không tiêm', serviceTypeCode: 'CDHA', type: 'percentage', value: 15 },
    { _id: 'CR-MOCK-04', commissionGroupId: 'CG-MOCK-02', commissionGroupName: 'Nhóm VIP',        serviceId: 'SVC-MOCK-010', serviceName: 'MRI sọ não',          serviceTypeCode: 'CDHA', type: 'percentage', value: 15 },
  ], 'Hoa hồng')

  // ═══════════════════════════════════════════════════════════════════════
  // STUDIES — populate Ca chụp / Ca đọc with a spread of statuses
  // ═══════════════════════════════════════════════════════════════════════
  const SITE_A = 'LinkRad Hai Phong'
  const SITE_B = 'LinkRad Ha Noi'
  const uid = (n) => `1.2.840.10008.5.1.4.1.1.2.MOCK.${Date.now()}.${n}`
  const studyTs = { createdAt: now(), updatedAt: now() }
  const studies = [
    // scheduled — Ca chụp "CHỜ THỰC HIỆN"
    { _id: 'STD-MOCK-001', studyUID: uid(1),  patientName: 'Nguyễn Thị Hoa',    patientId: 'BN-MOCK-001', dob: '1978-05-12', gender: 'F', modality: 'US',  bodyPart: 'Ổ bụng',     clinicalInfo: 'Đau thượng vị 3 ngày',          site: SITE_A, scheduledDate: today(), status: 'scheduled',  priority: 'routine', imageStatus: 'no_images' },
    { _id: 'STD-MOCK-002', studyUID: uid(2),  patientName: 'Trần Văn Minh',     patientId: 'BN-MOCK-002', dob: '1965-11-03', gender: 'M', modality: 'XR',  bodyPart: 'Ngực',       clinicalInfo: 'Ho kéo dài',                    site: SITE_A, scheduledDate: today(), status: 'scheduled',  priority: 'routine', imageStatus: 'no_images' },
    { _id: 'STD-MOCK-003', studyUID: uid(3),  patientName: 'Lê Thị Bích',       patientId: 'BN-MOCK-003', dob: '1982-07-20', gender: 'F', modality: 'CT',  bodyPart: 'Sọ não',     clinicalInfo: 'Đau đầu dữ dội, chóng mặt',     site: SITE_B, scheduledDate: today(), status: 'scheduled',  priority: 'urgent',  imageStatus: 'no_images' },
    { _id: 'STD-MOCK-004', studyUID: uid(4),  patientName: 'Phạm Đức Tuấn',     patientId: 'BN-MOCK-004', dob: '1990-02-15', gender: 'M', modality: 'US',  bodyPart: 'Tuyến giáp', clinicalInfo: 'Kiểm tra tuyến giáp',           site: SITE_A, scheduledDate: today(), status: 'scheduled',  priority: 'routine', imageStatus: 'no_images' },

    // in_progress — Ca chụp "ĐANG THỰC HIỆN"
    { _id: 'STD-MOCK-005', studyUID: uid(5),  patientName: 'Hoàng Văn Nam',     patientId: 'BN-MOCK-005', dob: '1955-09-28', gender: 'M', modality: 'CT',  bodyPart: 'Ngực',       clinicalInfo: 'Theo dõi u phổi',               site: SITE_A, scheduledDate: today(),       studyDate: today(), status: 'in_progress', priority: 'routine', imageStatus: 'receiving', technicianName: 'KTV Vũ Minh Đức' },
    { _id: 'STD-MOCK-006', studyUID: uid(6),  patientName: 'Đỗ Thị Lan',        patientId: 'BN-MOCK-006', dob: '1972-12-01', gender: 'F', modality: 'MRI', bodyPart: 'Cột sống',   clinicalInfo: 'Thoát vị đĩa đệm L4-L5',        site: SITE_B, scheduledDate: today(),       studyDate: today(), status: 'in_progress', priority: 'routine', imageStatus: 'receiving', technicianName: 'KTV Ngô Thu Hà' },
    { _id: 'STD-MOCK-007', studyUID: uid(7),  patientName: 'Bùi Thanh Sơn',     patientId: 'BN-MOCK-007', dob: '1988-04-18', gender: 'M', modality: 'XR',  bodyPart: 'Xương',      clinicalInfo: 'Nghi gãy cổ tay sau té ngã',    site: SITE_A, scheduledDate: today(),       studyDate: today(), status: 'in_progress', priority: 'stat',    imageStatus: 'receiving', technicianName: 'KTV Vũ Minh Đức' },

    // pending_read unclaimed — Ca đọc pool (bác sĩ picks up)
    { _id: 'STD-MOCK-008', studyUID: uid(8),  patientName: 'Vũ Kim Anh',        patientId: 'BN-MOCK-008', dob: '1960-03-25', gender: 'F', modality: 'CT',  bodyPart: 'Bụng',       clinicalInfo: 'Đau bụng âm ỉ, sụt cân',        site: SITE_A, scheduledDate: daysAgo(1),    studyDate: daysAgo(1), status: 'pending_read', priority: 'urgent',  imageStatus: 'available', imageCount: 128, technicianName: 'KTV Vũ Minh Đức', radiologist: '' },
    { _id: 'STD-MOCK-009', studyUID: uid(9),  patientName: 'Đinh Thị Mai',      patientId: 'BN-MOCK-009', dob: '1975-08-09', gender: 'F', modality: 'US',  bodyPart: 'Ổ bụng',     clinicalInfo: 'Khám sức khỏe định kỳ',         site: SITE_A, scheduledDate: today(),       studyDate: today(),    status: 'pending_read', priority: 'routine', imageStatus: 'available', imageCount: 24,  technicianName: 'KTV Vũ Minh Đức', radiologist: '' },
    { _id: 'STD-MOCK-010', studyUID: uid(10), patientName: 'Phan Tuấn Kiệt',    patientId: 'BN-MOCK-010', dob: '1998-06-14', gender: 'M', modality: 'MRI', bodyPart: 'Sọ não',     clinicalInfo: 'Đau đầu migraine',              site: SITE_B, scheduledDate: today(),       studyDate: today(),    status: 'pending_read', priority: 'routine', imageStatus: 'available', imageCount: 180, technicianName: 'KTV Ngô Thu Hà', radiologist: '' },
    { _id: 'STD-MOCK-011', studyUID: uid(11), patientName: 'Trương Văn Hiếu',   patientId: 'BN-MOCK-011', dob: '1962-01-30', gender: 'M', modality: 'CT',  bodyPart: 'Sọ não',     clinicalInfo: 'Ngã đập đầu, mất ý thức thoáng', site: SITE_A, scheduledDate: today(),       studyDate: today(),    status: 'pending_read', priority: 'stat',    imageStatus: 'available', imageCount: 96,  technicianName: 'KTV Vũ Minh Đức', radiologist: '' },
    { _id: 'STD-MOCK-012', studyUID: uid(12), patientName: 'Ngô Thị Phương',    patientId: 'BN-MOCK-012', dob: '1984-10-22', gender: 'F', modality: 'XR',  bodyPart: 'Ngực',       clinicalInfo: 'Khám tiền phẫu',                site: SITE_B, scheduledDate: daysAgo(1),    studyDate: daysAgo(1), status: 'pending_read', priority: 'routine', imageStatus: 'available', imageCount: 2,   technicianName: 'KTV Ngô Thu Hà', radiologist: '' },

    // reading — claimed by a radiologist (uses displayName placeholder)
    { _id: 'STD-MOCK-013', studyUID: uid(13), patientName: 'Lý Bá Thành',       patientId: 'BN-MOCK-013', dob: '1970-07-07', gender: 'M', modality: 'MRI', bodyPart: 'Cột sống',   clinicalInfo: 'Đau lưng mạn tính',             site: SITE_A, scheduledDate: today(),       studyDate: today(),    status: 'reading',      priority: 'routine', imageStatus: 'available', imageCount: 210, technicianName: 'KTV Vũ Minh Đức', radiologistName: 'BS. Hoàng Văn Thịnh', assignedAt: hoursAgo(1) },

    // reported/verified — historical
    { _id: 'STD-MOCK-014', studyUID: uid(14), patientName: 'Dương Thu Thảo',    patientId: 'BN-MOCK-014', dob: '1993-04-11', gender: 'F', modality: 'US',  bodyPart: 'Tuyến giáp', clinicalInfo: 'Nhân tuyến giáp theo dõi',      site: SITE_A, scheduledDate: daysAgo(2),    studyDate: daysAgo(2), status: 'reported',     priority: 'routine', imageStatus: 'available', imageCount: 18,  technicianName: 'KTV Vũ Minh Đức', radiologistName: 'BS. Hoàng Văn Thịnh', reportedAt: daysAgo(2) + 'T14:20:00.000Z' },
    { _id: 'STD-MOCK-015', studyUID: uid(15), patientName: 'Mai Xuân Hoàng',    patientId: 'BN-MOCK-015', dob: '1958-11-19', gender: 'M', modality: 'CT',  bodyPart: 'Ngực',       clinicalInfo: 'Theo dõi sau điều trị lao',     site: SITE_B, scheduledDate: daysAgo(3),    studyDate: daysAgo(3), status: 'verified',     priority: 'routine', imageStatus: 'available', imageCount: 140, technicianName: 'KTV Ngô Thu Hà', radiologistName: 'BS. Lê Thị Phương', reportedAt: daysAgo(3) + 'T10:05:00.000Z', verifiedAt: daysAgo(3) + 'T15:30:00.000Z' },
  ]
  for (const s of studies) {
    await Study.findByIdAndUpdate(s._id, { ...studyTs, ...s }, { upsert: true, new: true, setDefaultsOnInsert: true })
  }
  console.log(`✓ ${String(studies.length).padStart(3)} Studies (Ca chụp / Ca đọc)`)

  console.log('\nDone. All mock docs tagged with _id containing "MOCK-".')
  console.log('Cleanup script: node scripts/seed-catalogs-mock-remove.js')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
