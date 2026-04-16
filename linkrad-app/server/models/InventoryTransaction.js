const mongoose = require('mongoose')

const txItemSchema = new mongoose.Schema({
  supplyId: String,
  supplyName: String,
  supplyCode: String,
  unit: String,
  packagingSpec: String,              // Quy cách đóng gói
  lotNumber: String,
  manufacturingDate: String,          // Ngày sản xuất
  expiryDate: String,
  quantity: Number,                    // SL (packages)
  conversionQuantity: { type: Number, default: 0 },  // SL chuyển đổi (base units)
  purchasePrice: { type: Number, default: 0 },        // Giá mua (per package)
  unitPrice: { type: Number, default: 0 },             // Giá từng đơn vị (per base unit)
  amountBeforeTax: { type: Number, default: 0 },       // Tổng tiền trước thuế
  vatRate: { type: Number, default: 0 },                // VAT %
  vatAmount: { type: Number, default: 0 },              // Tiền VAT
  amountAfterTax: { type: Number, default: 0 },         // Tổng tiền sau thuế
  discountPercent: { type: Number, default: 0 },        // Chiết khấu %
  discountAmount: { type: Number, default: 0 },         // Tiền chiết khấu
  amount: { type: Number, default: 0 },                 // Tổng tiền (final)
  notes: String,                                         // Ghi chú
}, { _id: false })

const inventoryTransactionSchema = new mongoose.Schema({
  _id: String,
  transactionNumber: String,
  type: { type: String, enum: ['import', 'export', 'adjustment', 'auto_deduct'] },
  site: String,
  warehouseId: String,
  warehouseName: String,
  warehouseCode: String,
  accountingPeriod: String,           // Kỳ kế toán (e.g. "04/2026")
  items: [txItemSchema],
  totalAmountBeforeTax: { type: Number, default: 0 },
  totalVat: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  totalAmount: { type: Number, default: 0 },
  supplierId: String,
  supplierName: String,
  reason: String,
  notes: String,
  relatedServiceOrderId: String,
  relatedVisitId: String,
  status: { type: String, enum: ['draft', 'confirmed', 'cancelled'], default: 'draft' },
  confirmedBy: String,
  confirmedAt: String,
  createdBy: String,
  createdAt: String,
  updatedAt: String,
}, { _id: false })

module.exports = mongoose.model('InventoryTransaction', inventoryTransactionSchema)
