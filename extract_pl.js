const XLSX = require('xlsx');
const fs = require('fs');
const wb = XLSX.readFile('LinkRad-Planning_2026_070326.xlsx');

// Extract Annual P&L consolidated
const ws = wb.Sheets['Annual_PL conso'];
const data = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});

data.slice(0, 80).forEach((row, i) => {
  const nonEmpty = row.filter(c => c !== '');
  if (nonEmpty.length > 0) console.log(i+1, JSON.stringify(row.slice(0, 20)));
});
