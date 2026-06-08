"use client";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// ── Update these with your actual company details ────────────────────────────
const COMPANY = {
  name: "Trivedi Grani Marmo",
  address: "Your Address, City, State - PIN Code",
  phone: "+91 XXXXX XXXXX",
  email: "admin@trivedigranimarmo.com",
  gst: "GSTIN: XXXXXXXXXXXX",
  bankName: "Your Bank Name",
  accountNo: "XXXXXXXXXXXX",
  ifsc: "XXXXXX0000000",
  accountHolder: "Trivedi Grani Marmo",
};

const TERMS = [
  "Measurements are approximate estimates; final billing on actual sqft.",
  "This quotation is valid for 15 days from the date of issue.",
  "50% advance is required to confirm the order.",
  "Transportation and installation charges are not included.",
  "GST as applicable will be charged on actuals.",
];
// ─────────────────────────────────────────────────────────────────────────────

export type QuotationPdfItem = {
  slabCode: string;
  marbleName: string;
  lotNumber: string | null;
  length: number | null;
  width: number | null;
  sqft: number;
  pricePerSqft: number;
  thumbnailUrl: string | null;
};

export type QuotationPdfProps = {
  quotationNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  items: QuotationPdfItem[];
  totalSqft: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111827",
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 40,
  },
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  companyName: { fontSize: 17, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  companyDetail: { fontSize: 9, color: "#6B7280", marginBottom: 2 },
  quotationTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", textAlign: "right", marginBottom: 4 },
  quotationMeta: { fontSize: 9, color: "#6B7280", textAlign: "right", marginBottom: 2 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#E5E7EB", marginBottom: 16 },
  // Bill To
  infoLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: { fontSize: 10, color: "#111827", marginBottom: 2 },
  infoValueBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#111827", marginBottom: 2 },
  // Table
  table: { marginBottom: 16 },
  tableHead: {
    flexDirection: "row",
    backgroundColor: "#111827",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginBottom: 1,
  },
  tableHeadCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    paddingVertical: 5,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#F9FAFB" },
  cell: { fontSize: 9, color: "#374151" },
  cellBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#111827" },
  // Column widths
  colNo: { width: 20 },
  colImg: { width: 42 },
  colItem: { flex: 1 },
  colCode: { width: 52 },
  colLen: { width: 38, textAlign: "right" },
  colBreadth: { width: 38, textAlign: "right" },
  colSqft: { width: 40, textAlign: "right" },
  colRate: { width: 58, textAlign: "right" },
  colAmt: { width: 64, textAlign: "right" },
  // Slab thumbnail
  thumbImg: { width: 34, height: 26, objectFit: "cover", borderRadius: 2 },
  thumbPlaceholder: { width: 34, height: 26, borderRadius: 2, backgroundColor: "#E5E7EB" },
  // Totals
  totalsWrap: { marginLeft: "auto", width: 215, marginBottom: 24 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: "#6B7280" },
  totalsValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#374151" },
  totalsDiscount: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#DC2626" },
  totalsDivider: { borderBottomWidth: 1, borderBottomColor: "#E5E7EB", marginVertical: 4 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#111827",
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  grandLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  grandValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  // Footer (fixed at bottom of every page)
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 10,
  },
  footerLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  footerText: { fontSize: 8, color: "#9CA3AF", marginBottom: 2 },
  pageNum: { position: "absolute", bottom: 8, right: 40, fontSize: 8, color: "#D1D5DB" },
});

const inr = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;

export function QuotationDocument({
  quotationNumber,
  date,
  customerName,
  customerPhone,
  customerEmail,
  items,
  totalSqft,
  subtotal,
  discountPercent,
  discountAmount,
  gstPercent,
  gstAmount,
  grandTotal,
}: QuotationPdfProps) {
  const hasCustomer = customerName || customerPhone || customerEmail;

  return (
    <Document title={`Quotation ${quotationNumber}`} author={COMPANY.name} creator={COMPANY.name}>
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>{COMPANY.name}</Text>
            <Text style={s.companyDetail}>{COMPANY.address}</Text>
            <Text style={s.companyDetail}>{COMPANY.phone} · {COMPANY.email}</Text>
            <Text style={s.companyDetail}>{COMPANY.gst}</Text>
          </View>
          <View>
            <Text style={s.quotationTitle}>QUOTATION</Text>
            <Text style={s.quotationMeta}>{quotationNumber}</Text>
            <Text style={s.quotationMeta}>Date: {date}</Text>
            <Text style={s.quotationMeta}>Valid for 15 days</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Bill To ── */}
        {hasCustomer ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={s.infoLabel}>Bill To</Text>
            {customerName ? <Text style={s.infoValueBold}>{customerName}</Text> : null}
            {customerPhone ? <Text style={s.infoValue}>{customerPhone}</Text> : null}
            {customerEmail ? <Text style={s.infoValue}>{customerEmail}</Text> : null}
          </View>
        ) : null}

        {/* ── Slab Table ── */}
        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.tableHeadCell, s.colNo]}>#</Text>
            <Text style={[s.tableHeadCell, s.colImg]}> </Text>
            <Text style={[s.tableHeadCell, s.colItem]}>Item</Text>
            <Text style={[s.tableHeadCell, s.colCode]}>Code</Text>
            <Text style={[s.tableHeadCell, s.colLen]}>L (ft)</Text>
            <Text style={[s.tableHeadCell, s.colBreadth]}>B (ft)</Text>
            <Text style={[s.tableHeadCell, s.colSqft]}>Sqft</Text>
            <Text style={[s.tableHeadCell, s.colRate]}>Rate/sqft</Text>
            <Text style={[s.tableHeadCell, s.colAmt]}>Amount</Text>
          </View>

          {items.map((item, i) => {
            const amt = item.sqft * item.pricePerSqft;
            return (
              <View
                key={i}
                style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}
                wrap={false}
              >
                <Text style={[s.cell, s.colNo]}>{i + 1}</Text>

                <View style={s.colImg}>
                  {item.thumbnailUrl ? (
                    <Image src={item.thumbnailUrl} style={s.thumbImg} />
                  ) : (
                    <View style={s.thumbPlaceholder} />
                  )}
                </View>

                <View style={s.colItem}>
                  <Text style={s.cellBold}>{item.marbleName}</Text>
                  {item.lotNumber ? (
                    <Text style={[s.cell, { fontSize: 8, color: "#9CA3AF" }]}>
                      Lot {item.lotNumber}
                    </Text>
                  ) : null}
                </View>

                <Text style={[s.cell, s.colCode]}>{item.slabCode}</Text>
                <Text style={[s.cell, s.colLen]}>
                  {item.length !== null ? item.length : "—"}
                </Text>
                <Text style={[s.cell, s.colBreadth]}>
                  {item.width !== null ? item.width : "—"}
                </Text>
                <Text style={[s.cell, s.colSqft]}>{item.sqft}</Text>
                <Text style={[s.cell, s.colRate]}>
                  {item.pricePerSqft > 0 ? inr(item.pricePerSqft) : "—"}
                </Text>
                <Text style={[s.cellBold, s.colAmt]}>
                  {item.pricePerSqft > 0 ? inr(amt) : "—"}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Totals ── */}
        <View style={s.totalsWrap}>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Total Sqft (est.)</Text>
            <Text style={s.totalsValue}>{totalSqft.toLocaleString("en-IN")} sqft</Text>
          </View>
          <View style={s.totalsRow}>
            <Text style={s.totalsLabel}>Subtotal</Text>
            <Text style={s.totalsValue}>{inr(subtotal)}</Text>
          </View>
          {discountPercent > 0 ? (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>Discount ({discountPercent}%)</Text>
              <Text style={s.totalsDiscount}>– {inr(discountAmount)}</Text>
            </View>
          ) : null}
          {gstPercent > 0 ? (
            <View style={s.totalsRow}>
              <Text style={s.totalsLabel}>GST ({gstPercent}%)</Text>
              <Text style={s.totalsValue}>+ {inr(gstAmount)}</Text>
            </View>
          ) : null}
          <View style={s.totalsDivider} />
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>Grand Total</Text>
            <Text style={s.grandValue}>{inr(grandTotal)}</Text>
          </View>
        </View>

        {/* ── Footer (fixed) ── */}
        <View style={s.footer} fixed>
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={s.footerLabel}>Terms & Conditions</Text>
            {TERMS.map((t, i) => (
              <Text key={i} style={s.footerText}>
                {i + 1}. {t}
              </Text>
            ))}
          </View>
          <View style={{ width: 160 }}>
            <Text style={s.footerLabel}>Bank Details</Text>
            <Text style={s.footerText}>Bank: {COMPANY.bankName}</Text>
            <Text style={s.footerText}>A/C No.: {COMPANY.accountNo}</Text>
            <Text style={s.footerText}>IFSC: {COMPANY.ifsc}</Text>
            <Text style={s.footerText}>Name: {COMPANY.accountHolder}</Text>
          </View>
        </View>

        <Text
          style={s.pageNum}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
