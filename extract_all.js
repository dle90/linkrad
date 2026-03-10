const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('LinkRad-Planning_2026_070326.xlsx');

const SITES_MAIN = ['HaiDuong','CaMau','ThanhHoa','ThaiNguyen','ThaiBinh','YetKieu','NhaTrang','ThachThat','SocSon'];
const SITES_NAMES = ['Hải Dương','Cà Mau','Thanh Hóa','Thái Nguyên','Thái Bình','Yết Kiêu','Nha Trang','Thạch Thất','Sóc Sơn'];
const SERVICES = ['MRI','CT','Mammo X-Quang','X-Quang','Siêu âm'];
const MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];

// Helper: get sheet data
function getSheet(name) {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
}

// --- 1. SITE LIST ---
const siteData = getSheet('Site list');
const sites = [];
for (let i = 3; i < siteData.length; i++) {
  const row = siteData[i];
  if (row[0] && typeof row[0] === 'number') {
    sites.push({
      id: row[0],
      name: String(row[1]).trim().replace(/\r\n/g,' '),
      location: String(row[2]).trim(),
      startMonth: row[3],
      month7: row[4],
      month13: row[5],
      totalInvestment: row[6] || 0,
      linkradShare: row[7] || 0,
      linkradInvestment: row[8] || 0,
      bankLoan: row[9] || 0,
      note: String(row[10] || '').trim().replace(/\r\n/g,' '),
      bank: String(row[11] || '').trim(),
    });
  }
}

// --- 2. ANNUAL P&L CONSOLIDATED ---
const annualPL = getSheet('Annual_PL conso');
// Site columns: E=4(HaiDuong), F=5(CaMau), G=6(ThanhHoa), H=7(ThaiNguyen), I=8(ThaiBinh), J=9(YetKieu), K=10(NhaTrang), L=11(ThachThat), M=12(SocSon), N=13(HO), O=14(SiteLK)
// Total col P=15
const SITE_COLS_ANNUAL = [4,5,6,7,8,9,10,11,12]; // 9 main sites
const HO_COL = 13;
const SITE_LK_COL = 14;
const TOTAL_COL = 15;

function extractAnnualPLRow(data, rowIdx, colIndices) {
  const row = data[rowIdx] || [];
  const result = {};
  colIndices.forEach((ci, i) => { result[SITES_NAMES[i]] = typeof row[ci] === 'number' ? row[ci] : 0; });
  result['HO'] = typeof row[HO_COL] === 'number' ? row[HO_COL] : 0;
  result['Site LK'] = typeof row[SITE_LK_COL] === 'number' ? row[SITE_LK_COL] : 0;
  result['Tổng'] = typeof row[TOTAL_COL] === 'number' ? row[TOTAL_COL] : 0;
  return result;
}

const annualPLData = {
  year: 2025,
  revenue: {
    MRI: extractAnnualPLRow(annualPL, 10, SITE_COLS_ANNUAL),
    CT: extractAnnualPLRow(annualPL, 11, SITE_COLS_ANNUAL),
    'Mammo X-Quang': extractAnnualPLRow(annualPL, 12, SITE_COLS_ANNUAL),
    'X-Quang': extractAnnualPLRow(annualPL, 13, SITE_COLS_ANNUAL),
    'Siêu âm': extractAnnualPLRow(annualPL, 14, SITE_COLS_ANNUAL),
    'Tổng CĐHA': extractAnnualPLRow(annualPL, 15, SITE_COLS_ANNUAL),
    'Tổng khác': extractAnnualPLRow(annualPL, 16, SITE_COLS_ANNUAL),
    'Tổng doanh thu': extractAnnualPLRow(annualPL, 17, SITE_COLS_ANNUAL),
  },
  deductions: extractAnnualPLRow(annualPL, 18, SITE_COLS_ANNUAL),
  variableCosts: {
    'Vật tư tiêu hao': extractAnnualPLRow(annualPL, 20, SITE_COLS_ANNUAL),
    'Chi phí đọc KQ online': extractAnnualPLRow(annualPL, 21, SITE_COLS_ANNUAL),
    'Tiền thuốc': extractAnnualPLRow(annualPL, 22, SITE_COLS_ANNUAL),
    'Tư vấn chuyên môn': extractAnnualPLRow(annualPL, 23, SITE_COLS_ANNUAL),
    'Thưởng HQKD': extractAnnualPLRow(annualPL, 24, SITE_COLS_ANNUAL),
    'Truyền thông marketing': extractAnnualPLRow(annualPL, 25, SITE_COLS_ANNUAL),
    'Tổng biến phí': extractAnnualPLRow(annualPL, 26, SITE_COLS_ANNUAL),
  },
  contributionMargin: extractAnnualPLRow(annualPL, 27, SITE_COLS_ANNUAL),
  fixedCosts: {
    'Chi phí nhân sự': extractAnnualPLRow(annualPL, 29, SITE_COLS_ANNUAL),
    'Chi phí thuê địa điểm': extractAnnualPLRow(annualPL, 30, SITE_COLS_ANNUAL),
    'Chi phí bảo dưỡng sửa chữa': extractAnnualPLRow(annualPL, 31, SITE_COLS_ANNUAL),
    'Chi phí vận hành': extractAnnualPLRow(annualPL, 32, SITE_COLS_ANNUAL),
    'Chi phí khác': extractAnnualPLRow(annualPL, 33, SITE_COLS_ANNUAL),
    'Tổng định phí': extractAnnualPLRow(annualPL, 34, SITE_COLS_ANNUAL),
  },
  ebitdaBySite: extractAnnualPLRow(annualPL, 35, SITE_COLS_ANNUAL),
  hoCosts: {
    'Chi phí nhân sự HO': (annualPL[38] || [])[HO_COL] || 0,
    'Chi phí văn phòng HO': (annualPL[39] || [])[HO_COL] || 0,
    'Tổng chi phí HO': (annualPL[44] || [])[HO_COL] || 0,
  },
  ebitdaCompany: extractAnnualPLRow(annualPL, 45, SITE_COLS_ANNUAL),
  interestExpense: extractAnnualPLRow(annualPL, 47, SITE_COLS_ANNUAL),
  depreciation: {
    'Khấu hao máy CĐHA': extractAnnualPLRow(annualPL, 48, SITE_COLS_ANNUAL),
    'Khấu hao khác': extractAnnualPLRow(annualPL, 49, SITE_COLS_ANNUAL),
  },
  ebt: extractAnnualPLRow(annualPL, 51, SITE_COLS_ANNUAL),
  tax: extractAnnualPLRow(annualPL, 52, SITE_COLS_ANNUAL),
  pat: extractAnnualPLRow(annualPL, 53, SITE_COLS_ANNUAL),
  kpis: {
    cases: {
      MRI: extractAnnualPLRow(annualPL, 61, SITE_COLS_ANNUAL),
      CT: extractAnnualPLRow(annualPL, 62, SITE_COLS_ANNUAL),
      'Mammo X-Quang': extractAnnualPLRow(annualPL, 63, SITE_COLS_ANNUAL),
      'X-Quang': extractAnnualPLRow(annualPL, 64, SITE_COLS_ANNUAL),
      'Siêu âm': extractAnnualPLRow(annualPL, 65, SITE_COLS_ANNUAL),
    }
  }
};

// --- 3. MONTHLY P&L CONSOLIDATED ---
const monthlyPLSheet = getSheet('Monthly_PL conso');
// months are in columns 4..15 (index), row 7 has month numbers
// Let's figure out structure: row 7 = [VND triệu,..., 1,2,3,...,12]
const MONTH_START_COL = 4;

function extractMonthlyRow(data, rowIdx) {
  const row = data[rowIdx] || [];
  const result = {};
  for (let m = 0; m < 12; m++) {
    const val = row[MONTH_START_COL + m];
    result[m+1] = typeof val === 'number' ? val : 0;
  }
  return result;
}

const monthlyPLData = {
  year: 2025,
  revenue: {
    MRI: extractMonthlyRow(monthlyPLSheet, 10),
    CT: extractMonthlyRow(monthlyPLSheet, 20),
    'Mammo X-Quang': extractMonthlyRow(monthlyPLSheet, 27),
    'X-Quang': extractMonthlyRow(monthlyPLSheet, 32),
    'Siêu âm': extractMonthlyRow(monthlyPLSheet, 36),
    'Tổng CĐHA': extractMonthlyRow(monthlyPLSheet, 40),
    'Tổng khác': extractMonthlyRow(monthlyPLSheet, 41),
    'Tổng doanh thu': extractMonthlyRow(monthlyPLSheet, 42),
  },
  variableCosts: {
    'Vật tư tiêu hao': extractMonthlyRow(monthlyPLSheet, 45),
    'Chi phí đọc KQ online': extractMonthlyRow(monthlyPLSheet, 46),
    'Tiền thuốc': extractMonthlyRow(monthlyPLSheet, 47),
    'Tư vấn chuyên môn': extractMonthlyRow(monthlyPLSheet, 48),
    'Thưởng HQKD': extractMonthlyRow(monthlyPLSheet, 49),
    'Truyền thông marketing': extractMonthlyRow(monthlyPLSheet, 50),
    'Tổng biến phí': extractMonthlyRow(monthlyPLSheet, 51),
  },
  contributionMargin: extractMonthlyRow(monthlyPLSheet, 52),
  fixedCosts: {
    'Chi phí nhân sự': extractMonthlyRow(monthlyPLSheet, 54),
    'Chi phí thuê địa điểm': extractMonthlyRow(monthlyPLSheet, 55),
    'Chi phí vận hành': extractMonthlyRow(monthlyPLSheet, 57),
    'Chi phí khác': extractMonthlyRow(monthlyPLSheet, 58),
    'Tổng định phí': extractMonthlyRow(monthlyPLSheet, 59),
  },
  ebitda: extractMonthlyRow(monthlyPLSheet, 60),
};

// Print monthly PL to check row indices
monthlyPLSheet.slice(0, 70).forEach((row, i) => {
  const nonEmpty = row.filter(c => c !== '');
  if (nonEmpty.length > 0) console.log(i+1, JSON.stringify(row.slice(0, 20)));
});

