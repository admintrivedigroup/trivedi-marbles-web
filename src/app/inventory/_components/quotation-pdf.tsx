"use client";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

// ── Update phone once available ────────────────────────────────────────────
const COMPANY = {
  name: "Trivedi Marbles Pvt. Ltd.",
  address: "1, Kumbharita Road, Ambaji, Banaskantha, Gujarat - 385110",
  phone: "",
  email: "admin@trivedigranimarmo.com",
  gst: "24AAACT5711G1ZP",
  pan: "AAACT5711G",
  bankName: "Bank of Baroda",
  branch: "Ashram Road",
  accountNo: "08490200000863",
  ifsc: "BARB0ASHRAM",
  accountHolder: "Trivedi Marbles Pvt. Ltd.",
  jurisdiction: "Subject to Ambaji Jurisdiction",
};

const TERMS = [
  "Measurements are approximate estimates; final billing on actual sqft.",
  "This quotation is valid for 15 days from the date of issue.",
  "100% advance is required to confirm the order.",
  "Transportation and installation charges are not included.",
];

const DECLARATION =
  "We declare that this quotation shows the actual price of the goods described and that all particulars are true and correct.";
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
  customerCompany: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerAddress: string;
  customerGstin: string;
  customerPan: string;
  items: QuotationPdfItem[];
  totalSqft: number;
  subtotal: number;
  discountPercent: number;
  discountAmount: number;
  gstPercent: number;
  gstAmount: number;
  grandTotal: number;
  logoUrl: string | null;
};

// ── Number → words (Indian numbering system) ───────────────────────────────
const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ` ${ONES[o]}` : "");
}

function numberToWordsIndian(value: number): string {
  let num = Math.round(value);
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 1e7); num %= 1e7;
  const lakh = Math.floor(num / 1e5); num %= 1e5;
  const thousand = Math.floor(num / 1e3); num %= 1e3;
  const hundred = Math.floor(num / 100); num %= 100;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (num) parts.push(twoDigitWords(num));
  return parts.join(" ");
}

function amountInWords(amount: number): string {
  return `Rupees ${numberToWordsIndian(amount)} Only`;
}
// ─────────────────────────────────────────────────────────────────────────────

// Single accent color; everything else is grayscale.
const INK = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const BORDER = "#e2e8f0";
const ACCENT = "#4338ca";

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9.5,
    color: BODY,
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 44,
  },
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  logo: { width: 40, height: 40, objectFit: "contain", marginRight: 12 },
  headerRight: { width: 200 },
  companyName: { fontSize: 12.5, lineHeight: 1.3, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 6 },
  companyDetail: { fontSize: 8, lineHeight: 1.4, color: MUTED, marginBottom: 2 },
  quotationEyebrow: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: ACCENT,
    letterSpacing: 2,
    textAlign: "right",
    marginBottom: 6,
  },
  quotationTitle: { fontSize: 15, lineHeight: 1.3, fontFamily: "Helvetica-Bold", textAlign: "right", color: INK, marginBottom: 10 },
  quotationMeta: { fontSize: 8.5, lineHeight: 1.4, color: MUTED, textAlign: "right", marginBottom: 2 },
  quotationMetaBold: { fontSize: 8.5, lineHeight: 1.4, fontFamily: "Helvetica-Bold", color: INK, textAlign: "right", marginBottom: 2 },
  headerRule: { borderBottomWidth: 1, borderBottomColor: INK, marginBottom: 16 },

  // Bill To
  infoGrid: { flexDirection: "row", marginBottom: 16 },
  infoCol: { flex: 1 },
  infoLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: FAINT,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  infoValue: { fontSize: 9.5, lineHeight: 1.4, color: BODY, marginBottom: 2 },
  infoValueBold: { fontSize: 10, lineHeight: 1.4, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 3 },
  infoMeta: { fontSize: 8, lineHeight: 1.4, color: MUTED, marginTop: 2 },

  // Table
  table: { marginBottom: 16 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: INK,
    paddingBottom: 7,
    marginBottom: 1,
    paddingHorizontal: 4,
  },
  tableHeadCell: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
    paddingVertical: 7,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  cell: { fontSize: 8.5, color: MUTED },
  cellBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: INK },
  // Column widths
  colNo: { width: 20 },
  colImg: { width: 40 },
  colItem: { flex: 1 },
  colCode: { width: 50 },
  colLen: { width: 36, textAlign: "right" },
  colBreadth: { width: 36, textAlign: "right" },
  colSqft: { width: 40, textAlign: "right" },
  colRate: { width: 56, textAlign: "right" },
  colAmt: { width: 64, textAlign: "right" },
  // Slab thumbnail
  thumbImg: { width: 32, height: 24, objectFit: "cover", borderRadius: 3 },
  thumbPlaceholder: { width: 32, height: 24, borderRadius: 3, backgroundColor: BORDER },

  // Totals
  totalsWrap: { marginLeft: "auto", width: 220, marginBottom: 14 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5 },
  totalsLabel: { fontSize: 8.5, color: MUTED },
  totalsValue: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: BODY },
  totalsDiscount: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#B91C1C" },
  totalsDivider: { borderBottomWidth: 1, borderBottomColor: INK, marginVertical: 6 },
  grandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  grandLabel: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: INK, letterSpacing: 0.3 },
  grandValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: ACCENT },

  // Amount in words
  wordsBox: { marginBottom: 14 },
  wordsLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: FAINT,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  wordsValue: { fontSize: 9.5, fontFamily: "Helvetica-Oblique", color: BODY },

  // Bottom grid: declaration + bank
  bottomGrid: { flexDirection: "row", marginBottom: 14, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 14 },
  bottomCol: { flex: 1 },
  bottomColGap: { width: 32 },
  bottomLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: FAINT,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  bottomText: { fontSize: 8, color: MUTED, lineHeight: 1.55 },
  bankLine: { fontSize: 8.5, lineHeight: 1.4, color: BODY, marginBottom: 4 },
  bankLineLabel: { fontFamily: "Helvetica-Bold", color: MUTED },

  // Signature — one cohesive block directly under the bank details
  signatureWrap: { alignItems: "flex-end", marginTop: 10, marginBottom: 16 },
  signatureFor: { fontSize: 9, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 26 },
  signatureLine: { width: 160, borderTopWidth: 1, borderTopColor: INK, paddingTop: 5 },
  signatureText: { fontSize: 7.5, color: MUTED, textAlign: "center" },

  // Footer — normal flowing content at the end of the document, not pinned per-page
  footer: {
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 10,
  },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  footerLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: FAINT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerText: { fontSize: 7.5, color: MUTED, marginBottom: 2, lineHeight: 1.35 },
  footerBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerBrand: { fontSize: 7.5, color: FAINT, letterSpacing: 0.3 },
  footerJurisdiction: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: MUTED },
});

const inr = (n: number) => `Rs. ${Math.round(n).toLocaleString("en-IN")}`;

export function QuotationDocument({
  quotationNumber,
  date,
  customerCompany,
  customerName,
  customerPhone,
  customerEmail,
  customerAddress,
  customerGstin,
  customerPan,
  items,
  totalSqft,
  subtotal,
  discountPercent,
  discountAmount,
  gstPercent,
  gstAmount,
  grandTotal,
  logoUrl,
}: QuotationPdfProps) {
  const hasCustomer =
    customerCompany || customerName || customerPhone || customerEmail || customerAddress || customerGstin || customerPan;
  const taxIdLine = [customerGstin ? `GSTIN: ${customerGstin}` : "", customerPan ? `PAN: ${customerPan}` : ""]
    .filter(Boolean)
    .join("  ·  ");
  const cgstPercent = gstPercent / 2;
  const sgstPercent = gstPercent / 2;
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;

  return (
    <Document title={`Quotation ${quotationNumber}`} author={COMPANY.name} creator={COMPANY.name}>
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            {logoUrl ? <Image src={logoUrl} style={s.logo} /> : null}
            <View>
              <Text style={s.companyName}>Trivedi Marbles Pvt. Ltd.</Text>
              <Text style={s.companyDetail}>{COMPANY.address}</Text>
              <Text style={s.companyDetail}>
                {COMPANY.phone ? `${COMPANY.phone} · ${COMPANY.email}` : COMPANY.email}
              </Text>
              <Text style={s.companyDetail}>
                GSTIN: {COMPANY.gst}  ·  PAN: {COMPANY.pan}
              </Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.quotationEyebrow}>QUOTATION</Text>
            <Text style={s.quotationTitle}>{quotationNumber}</Text>
            <Text style={s.quotationMetaBold}>Date: {date}</Text>
            <Text style={s.quotationMeta}>Valid for 15 days</Text>
          </View>
        </View>

        <View style={s.headerRule} />

        {/* ── Bill To ── */}
        {hasCustomer ? (
          <View style={s.infoGrid}>
            <View style={s.infoCol}>
              <Text style={s.infoLabel}>Bill To</Text>
              {customerCompany ? (
                <Text style={s.infoValueBold}>{customerCompany}</Text>
              ) : customerName ? (
                <Text style={s.infoValueBold}>{customerName}</Text>
              ) : null}
              {customerCompany && customerName ? (
                <Text style={s.infoValue}>Attn: {customerName}</Text>
              ) : null}
              {customerPhone ? <Text style={s.infoValue}>{customerPhone}</Text> : null}
              {customerEmail ? <Text style={s.infoValue}>{customerEmail}</Text> : null}
              {customerAddress ? <Text style={s.infoValue}>{customerAddress}</Text> : null}
              {taxIdLine ? <Text style={s.infoMeta}>{taxIdLine}</Text> : null}
            </View>
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
              <View key={i} style={s.tableRow} wrap={false}>
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
                    <Text style={[s.cell, { fontSize: 7.5, color: FAINT }]}>
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
            <>
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>CGST ({cgstPercent}%)</Text>
                <Text style={s.totalsValue}>+ {inr(cgstAmount)}</Text>
              </View>
              <View style={s.totalsRow}>
                <Text style={s.totalsLabel}>SGST ({sgstPercent}%)</Text>
                <Text style={s.totalsValue}>+ {inr(sgstAmount)}</Text>
              </View>
            </>
          ) : null}
          <View style={s.totalsDivider} />
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>GRAND TOTAL</Text>
            <Text style={s.grandValue}>{inr(grandTotal)}</Text>
          </View>
        </View>

        {/* ── Amount in words ── */}
        <View style={s.wordsBox}>
          <Text style={s.wordsLabel}>Amount Chargeable (in words)</Text>
          <Text style={s.wordsValue}>{amountInWords(grandTotal)}</Text>
        </View>

        {/* ── Declaration + Bank details ── */}
        <View style={s.bottomGrid}>
          <View style={s.bottomCol}>
            <Text style={s.bottomLabel}>Declaration</Text>
            <Text style={s.bottomText}>{DECLARATION}</Text>
          </View>
          <View style={s.bottomColGap} />
          <View style={s.bottomCol}>
            <Text style={s.bottomLabel}>Company&apos;s Bank Details</Text>
            <Text style={s.bankLine}>
              <Text style={s.bankLineLabel}>A/c Holder: </Text>
              {COMPANY.accountHolder}
            </Text>
            <Text style={s.bankLine}>
              <Text style={s.bankLineLabel}>Bank: </Text>
              {COMPANY.bankName}, {COMPANY.branch}
            </Text>
            <Text style={s.bankLine}>
              <Text style={s.bankLineLabel}>A/c No.: </Text>
              {COMPANY.accountNo}
            </Text>
            <Text style={s.bankLine}>
              <Text style={s.bankLineLabel}>IFSC: </Text>
              {COMPANY.ifsc}
            </Text>
          </View>
        </View>

        {/* ── Signature ── */}
        <View style={s.signatureWrap}>
          <Text style={s.signatureFor}>For {COMPANY.name}</Text>
          <View style={s.signatureLine}>
            <Text style={s.signatureText}>Authorised Signatory</Text>
          </View>
        </View>

        {/* ── Terms & Conditions + jurisdiction (flows once, at the end) ── */}
        <View style={s.footer}>
          <Text style={s.footerLabel}>Terms & Conditions</Text>
          {TERMS.map((t, i) => (
            <Text key={i} style={s.footerText}>
              {i + 1}. {t}
            </Text>
          ))}
          <View style={s.footerBottomRow}>
            <Text style={s.footerBrand}>
              TRIVEDI MARBLES  ·  This is a computer generated quotation
            </Text>
            <Text style={s.footerJurisdiction}>{COMPANY.jurisdiction}</Text>
          </View>
        </View>

        <Text
          style={{ position: "absolute", bottom: 16, right: 44, fontSize: 7.5, color: FAINT }}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
