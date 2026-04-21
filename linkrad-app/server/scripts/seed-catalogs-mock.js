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

const now = () => new Date().toISOString()
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
    { _id: 'SVC-MOCK-001', code: 'SA020', name: 'Siêu âm ổ bụng tổng quát', serviceTypeCode: 'CDHA', modality: 'US',  bodyPart: 'Ổ bụng',     basePrice: 150000,  points: 1,   unit: 'lần', technicalInfo: 'Máy SA 2D' },
    { _id: 'SVC-MOCK-002', code: 'SA026', name: 'Siêu âm tuyến giáp',       serviceTypeCode: 'CDHA', modality: 'US',  bodyPart: 'Tuyến giáp', basePrice: 150000,  points: 1,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-003', code: 'SA028', name: 'Siêu âm vú hai bên',       serviceTypeCode: 'CDHA', modality: 'US',  bodyPart: 'Vú',         basePrice: 180000,  points: 1,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-004', code: 'XQ001', name: 'X-Quang ngực thẳng',       serviceTypeCode: 'CDHA', modality: 'XR',  bodyPart: 'Ngực',       basePrice: 120000,  points: 1,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-005', code: 'XQ002', name: 'X-Quang xương',            serviceTypeCode: 'CDHA', modality: 'XR',  bodyPart: 'Xương',      basePrice: 120000,  points: 1,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-006', code: 'CT001', name: 'CT sọ não không tiêm',     serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Sọ não',     basePrice: 800000,  points: 3,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-007', code: 'CT002', name: 'CT sọ não có tiêm thuốc',  serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Sọ não',     basePrice: 1200000, points: 4,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-008', code: 'CT003', name: 'CT ngực',                  serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Ngực',       basePrice: 900000,  points: 3,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-009', code: 'CT004', name: 'CT bụng - tiểu khung',     serviceTypeCode: 'CDHA', modality: 'CT',  bodyPart: 'Bụng',       basePrice: 1000000, points: 3,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-010', code: 'MR001', name: 'MRI sọ não',               serviceTypeCode: 'CDHA', modality: 'MRI', bodyPart: 'Sọ não',     basePrice: 2500000, points: 5,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-011', code: 'MR002', name: 'MRI cột sống thắt lưng',   serviceTypeCode: 'CDHA', modality: 'MRI', bodyPart: 'Cột sống',   basePrice: 2800000, points: 5,   unit: 'lần', technicalInfo: '' },
    { _id: 'SVC-MOCK-012', code: 'XN001', name: 'Công thức máu',            serviceTypeCode: 'XN',   modality: 'LAB', bodyPart: '',           basePrice: 80000,   points: 0.5, unit: 'lần', technicalInfo: '' },
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

  console.log('\nDone. All mock docs tagged with _id containing "MOCK-".')
  console.log('Cleanup script: node scripts/seed-catalogs-mock-remove.js')
  process.exit(0)
}

seed().catch(err => { console.error(err); process.exit(1) })
