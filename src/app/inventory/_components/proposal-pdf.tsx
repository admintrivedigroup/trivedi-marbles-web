"use client";

import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { formatSize } from "@/app/inventory/_lib/format";

// ── Update contact/address once available ─────────────────────────────────────
const CONTACT = {
  personName: "Mr. Saumil Patel",
  personPhone: "+91 90999 96869",
  personEmail: "info@trivedigranimarmo.com",
  companyName: "Trivedi Marbles Pvt. Ltd.",
  addressLines: [
    "S.No.: 698/4, Ognaj,",
    "Opp. Vasant Nagar Township, Gota-Vadsar Road,",
    "Ahmedabad-380060, Gujarat, INDIA.",
  ],
};
// ─────────────────────────────────────────────────────────────────────────────

const PROPOSAL_TITLE = "Marble Slab Collection";

const PROPOSAL_DESCRIPTION =
  "A curated selection of premium natural marble slabs, presented with full lot and quantity " +
  "specifications for your review.";

const INTRO_TEXT =
  "Thank you for the opportunity to present this selection of natural marble slabs. Each slab below has been " +
  "individually inspected, measured, and photographed to give you an accurate impression of veining, tone, and " +
  "finish before dispatch. Full measurements and available square footage are listed for your procurement records.";

const AVAILABILITY_NOTE =
  'Quantities marked "Plus" indicate additional material may be available beyond the stated footage upon ' +
  'confirmation. Quantities marked "Same" indicate the lot is a consistent single batch with uniform shade and ' +
  "veining throughout.";
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalPdfSlab = {
  slabCode: string;
  length: number | null;
  width: number | null;
  sqft: number;
  photoUrl: string | null;
};

export type ProposalPdfItem = {
  marbleName: string;
  lotNumber: string;
  sqft: number;
  quantityNote: "" | "Plus" | "Same";
  finish: string;
  origin: string;
  slabs: ProposalPdfSlab[];
};

export type ProposalPdfProps = {
  referenceNo: string;
  date: string;
  clientName: string;
  items: ProposalPdfItem[];
  logoUrl: string | null;
};

function qtyLabel(item: ProposalPdfItem): string {
  const base = `${item.sqft} sqft`;
  if (item.quantityNote === "Plus") return `${base}+`;
  if (item.quantityNote === "Same") return `${base} (Same)`;
  return base;
}

const GOLD = "#b8935a";
const GOLD_MUTED = "#8a6d1f";
const DARK = "#181410";
const CREAM = "#d9cdb8";
const MUTED = "#9c9184";

const s = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: "#1f2937" },

  wordmarkFallback: { fontFamily: "Times-Bold", fontSize: 22, color: "#f5f1e8", textAlign: "center" },

  // ── Cover page ──
  coverPage: {
    backgroundColor: DARK,
    padding: 30,
  },
  coverFrame: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: "#4a4030",
    paddingHorizontal: 44,
    paddingVertical: 50,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  coverLogoWrap: { alignItems: "center" },
  coverLogo: { width: 118, height: 118, objectFit: "contain" },
  coverCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  coverRule: { width: 44, height: 1, backgroundColor: GOLD, marginVertical: 22 },
  coverEyebrow: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 3,
    marginBottom: 14,
    textAlign: "center",
  },
  coverTitle: {
    fontSize: 30,
    fontFamily: "Times-Bold",
    color: "#ffffff",
    marginBottom: 16,
    textAlign: "center",
  },
  coverDesc: {
    fontSize: 10.5,
    color: CREAM,
    lineHeight: 1.6,
    textAlign: "center",
    maxWidth: 360,
  },
  coverFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.75,
    borderTopColor: "#4a4030",
    paddingTop: 16,
  },
  coverFooterCol: { flex: 1 },
  coverFooterColCenter: { flex: 1, alignItems: "center" },
  coverFooterColRight: { flex: 1, alignItems: "flex-end" },
  coverFooterLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  coverFooterValue: { fontSize: 10.5, color: "#ffffff", fontFamily: "Times-Roman" },

  // ── Shared light header/footer (overview page) ──
  lightPage: { paddingTop: 34, paddingHorizontal: 44, paddingBottom: 56 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 0.75,
    borderBottomColor: "#111827",
    paddingBottom: 10,
    marginBottom: 26,
  },
  headerBrand: { fontSize: 10.5, fontFamily: "Times-Bold", color: "#111827", letterSpacing: 0.5 },
  headerBrandAccent: { color: GOLD_MUTED },
  headerTag: { fontSize: 7.5, color: "#9CA3AF", letterSpacing: 1.5 },
  lightPageFooter: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E1D8",
    paddingTop: 8,
  },
  lightPageFooterText: { fontSize: 7.5, color: "#B0A794", letterSpacing: 0.5 },

  // ── Overview page ──
  h1: { fontSize: 21, fontFamily: "Times-Bold", color: "#111827", marginBottom: 8 },
  h1Rule: { width: 34, height: 1.5, backgroundColor: GOLD, marginBottom: 10 },
  h1Sub: { fontSize: 8, color: "#9CA3AF", letterSpacing: 1, marginBottom: 18 },
  introText: { fontSize: 9.5, color: "#4B5563", lineHeight: 1.6, marginBottom: 22 },
  table: { marginBottom: 20 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
    paddingBottom: 7,
    marginBottom: 2,
  },
  tableHeadCell: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: GOLD_MUTED,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#EDE9E1",
    paddingVertical: 9,
    alignItems: "center",
  },
  tableRowAlt: { backgroundColor: "#FAF8F4" },
  tableTotalRow: {
    flexDirection: "row",
    paddingTop: 12,
    marginTop: 2,
    borderTopWidth: 1.5,
    borderTopColor: "#111827",
    alignItems: "center",
  },
  colNo: { width: 26, fontSize: 8.5, color: "#B0A794", fontFamily: "Times-Roman" },
  colName: { flex: 1, fontSize: 10.5, fontFamily: "Times-Bold", color: "#111827" },
  colLot: { width: 90, fontSize: 9.5, color: "#374151", fontFamily: "Helvetica" },
  colSqft: { width: 100, fontSize: 9.5, color: "#374151", fontFamily: "Helvetica" },
  totalLabel: { flex: 1, fontSize: 10.5, fontFamily: "Times-Bold", color: "#111827" },
  totalValue: { width: 100, fontSize: 10.5, fontFamily: "Times-Bold", color: "#111827" },
  noteBox: {
    backgroundColor: "#FAF6EC",
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    padding: 14,
  },
  noteLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD_MUTED,
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  noteText: { fontSize: 8.5, color: "#57534a", lineHeight: 1.55 },

  // ── Lot detail page (full dark "plate") ──
  detailPage: {
    backgroundColor: DARK,
    paddingHorizontal: 40,
    paddingTop: 30,
    paddingBottom: 46,
  },
  detailHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  detailBrand: { fontSize: 10, fontFamily: "Times-Bold", color: "#f5f1e8" },
  detailTag: { fontSize: 7.5, color: MUTED, letterSpacing: 1.5 },

  bigPhotoFrame: { borderWidth: 1, borderColor: GOLD, padding: 6, marginBottom: 22 },
  bigPhotoWrap: { height: 460, backgroundColor: "#2a2419", alignItems: "center", justifyContent: "center" },
  bigPhoto: { width: "100%", height: "100%", objectFit: "cover" },
  noPhotoText: { fontSize: 9, color: MUTED },

  detailTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  detailIndex: { fontSize: 26, fontFamily: "Times-Bold", color: GOLD, marginRight: 12 },
  detailName: { fontSize: 20, color: "#ffffff", fontFamily: "Times-Bold" },
  detailBadge: {
    borderWidth: 0.75,
    borderColor: GOLD,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 12,
  },
  detailBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GOLD, letterSpacing: 0.5 },
  detailRule: { width: 40, height: 1.5, backgroundColor: GOLD, marginBottom: 18 },

  specsRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  specCard: { width: "33.333%", paddingHorizontal: 4, marginBottom: 8 },
  specCardInner: {
    borderWidth: 0.5,
    borderColor: "#3a3226",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  specLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1,
    marginBottom: 5,
  },
  specValue: { fontSize: 11, color: "#ffffff", fontFamily: "Times-Roman" },

  pageFooter: {
    position: "absolute",
    bottom: 22,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: "#3a3226",
    paddingTop: 10,
  },
  pageFooterText: { fontSize: 7.5, color: MUTED, letterSpacing: 0.5 },

  // ── Final page: contact ──
  contactPage: { backgroundColor: DARK, paddingHorizontal: 44, paddingVertical: 40, flex: 1 },
  contactHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 0.75,
    borderBottomColor: "#4a4030",
    paddingBottom: 10,
    marginBottom: 34,
  },
  contactColsRow: {
    flexDirection: "row",
    borderTopWidth: 0.75,
    borderTopColor: "#4a4030",
    borderBottomWidth: 0.75,
    borderBottomColor: "#4a4030",
    paddingVertical: 22,
    marginBottom: 30,
  },
  contactCol: { flex: 1 },
  contactColLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: GOLD,
    letterSpacing: 1.5,
    marginBottom: 9,
  },
  contactColLine: { fontSize: 10.5, color: "#ffffff", fontFamily: "Times-Roman", marginBottom: 4 },
  contactThanks: { fontSize: 11, fontFamily: "Times-Italic", color: CREAM, textAlign: "center" },
  contactFooterLogo: { marginTop: "auto", alignItems: "center" },
  contactLogo: { width: 84, height: 84, objectFit: "contain" },
});

function LightHeader({ tag }: { tag: string }) {
  return (
    <View style={s.headerRow} fixed>
      <Text style={s.headerBrand}>
        VIJAY <Text style={s.headerBrandAccent}>TRIVEDI</Text> GROUP
      </Text>
      <Text style={s.headerTag}>{tag}</Text>
    </View>
  );
}

function LightFooter() {
  return (
    <View style={s.lightPageFooter} fixed>
      <Text style={s.lightPageFooterText}>VIJAY TRIVEDI GROUP  ·  PRODUCT PROPOSAL</Text>
      <Text
        style={s.lightPageFooterText}
        render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
      />
    </View>
  );
}

function SpecCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.specCard}>
      <View style={s.specCardInner}>
        <Text style={s.specLabel}>{label}</Text>
        <Text style={s.specValue}>{value}</Text>
      </View>
    </View>
  );
}

export function ProposalDocument({ referenceNo, date, clientName, items, logoUrl }: ProposalPdfProps) {
  const totalSqft = items.reduce((sum, i) => sum + i.sqft, 0);
  const hasPlus = items.some((i) => i.quantityNote === "Plus");
  const hasNote = items.some((i) => i.quantityNote !== "");

  const slabPages = items.flatMap((item) => item.slabs.map((slab) => ({ item, slab })));

  return (
    <Document title={`Product Proposal ${referenceNo}`} author={CONTACT.companyName}>
      {/* ── Page 1: Cover ── */}
      <Page size="A4" style={s.coverPage}>
        <View style={s.coverFrame}>
          <View style={s.coverLogoWrap}>
            {logoUrl ? (
              <Image src={logoUrl} style={s.coverLogo} />
            ) : (
              <Text style={s.wordmarkFallback}>VIJAY TRIVEDI GROUP</Text>
            )}
          </View>

          <View style={s.coverCenter}>
            <Text style={s.coverEyebrow}>PRODUCT PROPOSAL</Text>
            <Text style={s.coverTitle}>{PROPOSAL_TITLE}</Text>
            <View style={s.coverRule} />
            <Text style={s.coverDesc}>{PROPOSAL_DESCRIPTION}</Text>
          </View>

          <View style={s.coverFooterRow}>
            <View style={s.coverFooterCol}>
              <Text style={s.coverFooterLabel}>PREPARED FOR</Text>
              <Text style={s.coverFooterValue}>{clientName}</Text>
            </View>
            <View style={s.coverFooterColCenter}>
              <Text style={s.coverFooterLabel}>REFERENCE NO.</Text>
              <Text style={s.coverFooterValue}>{referenceNo}</Text>
            </View>
            <View style={s.coverFooterColRight}>
              <Text style={s.coverFooterLabel}>DATE</Text>
              <Text style={s.coverFooterValue}>{date}</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ── Page 2: Overview ── */}
      <Page size="A4" style={[s.page, s.lightPage]}>
        <LightHeader tag="PRODUCT PROPOSAL" />

        <Text style={s.h1}>Proposal Overview</Text>
        <View style={s.h1Rule} />
        <Text style={s.h1Sub}>PREPARED EXCLUSIVELY FOR {clientName.toUpperCase()}</Text>

        <Text style={s.introText}>{INTRO_TEXT}</Text>

        <View style={s.table}>
          <View style={s.tableHead}>
            <Text style={[s.tableHeadCell, s.colNo]}>#</Text>
            <Text style={[s.tableHeadCell, s.colName]}>Marble Name</Text>
            <Text style={[s.tableHeadCell, s.colLot]}>Lot No.</Text>
            <Text style={[s.tableHeadCell, s.colSqft]}>Available Sqft</Text>
          </View>

          {items.map((item, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
              <Text style={s.colNo}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={s.colName}>{item.marbleName}</Text>
              <Text style={s.colLot}>{item.lotNumber}</Text>
              <Text style={s.colSqft}>{qtyLabel(item)}</Text>
            </View>
          ))}

          <View style={s.tableTotalRow}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>
              {totalSqft.toLocaleString("en-IN")}
              {hasPlus ? "+" : ""} sqft
            </Text>
          </View>
        </View>

        {hasNote ? (
          <View style={s.noteBox}>
            <Text style={s.noteLabel}>NOTE ON AVAILABILITY</Text>
            <Text style={s.noteText}>{AVAILABILITY_NOTE}</Text>
          </View>
        ) : null}

        <LightFooter />
      </Page>

      {/* ── Pages 3..N: one big photo + full detail per slab ── */}
      {slabPages.map(({ item, slab }, i) => (
        <Page key={i} size="A4" style={s.detailPage}>
          <View style={s.detailHeaderRow} fixed>
            <Text style={s.detailBrand}>
              VIJAY <Text style={{ color: GOLD }}>TRIVEDI</Text> GROUP
            </Text>
            <Text style={s.detailTag}>SLAB DETAIL</Text>
          </View>

          <View style={s.bigPhotoFrame}>
            <View style={s.bigPhotoWrap}>
              {slab.photoUrl ? (
                <Image src={slab.photoUrl} style={s.bigPhoto} />
              ) : (
                <Text style={s.noPhotoText}>No image available</Text>
              )}
            </View>
          </View>

          <View style={s.detailTitleRow}>
            <Text style={s.detailIndex}>{String(i + 1).padStart(2, "0")}</Text>
            <Text style={s.detailName}>{item.marbleName}</Text>
            {item.quantityNote ? (
              <View style={s.detailBadge}>
                <Text style={s.detailBadgeText}>
                  {item.quantityNote === "Plus" ? "PLUS AVAILABLE" : "SAME BATCH"}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={s.detailRule} />

          <View style={s.specsRow}>
            <SpecCard label="LOT NUMBER" value={item.lotNumber} />
            <SpecCard label="SLAB CODE" value={slab.slabCode} />
            <SpecCard label="SIZE" value={formatSize(slab.length, slab.width) ?? "N/A"} />
            <SpecCard label="SQFT" value={`${slab.sqft} sqft`} />
            <SpecCard label="FINISH" value={item.finish || "-"} />
            <SpecCard label="ORIGIN" value={item.origin || "-"} />
          </View>

          <View style={s.pageFooter} fixed>
            <Text style={s.pageFooterText}>VIJAY TRIVEDI GROUP  ·  PRODUCT PROPOSAL</Text>
            <Text
              style={s.pageFooterText}
              render={({ pageNumber, totalPages }) => `PAGE ${pageNumber} OF ${totalPages}`}
            />
          </View>
        </Page>
      ))}

      {/* ── Final page: contact ── */}
      <Page size="A4" style={s.page}>
        <View style={s.contactPage}>
          <View style={s.contactHeaderRow}>
            <Text style={s.detailBrand}>
              VIJAY <Text style={{ color: GOLD }}>TRIVEDI</Text> GROUP
            </Text>
            <Text style={s.detailTag}>CONTACT &amp; TERMS</Text>
          </View>

          <View style={s.contactColsRow}>
            <View style={s.contactCol}>
              <Text style={s.contactColLabel}>CONTACT PERSON</Text>
              <Text style={s.contactColLine}>{CONTACT.personName}</Text>
              <Text style={s.contactColLine}>{CONTACT.personPhone}</Text>
              <Text style={s.contactColLine}>{CONTACT.personEmail}</Text>
            </View>
            <View style={s.contactCol}>
              <Text style={s.contactColLabel}>COMPANY</Text>
              <Text style={s.contactColLine}>{CONTACT.companyName}</Text>
              {CONTACT.addressLines.map((line, i) => (
                <Text key={i} style={s.contactColLine}>
                  {line}
                </Text>
              ))}
            </View>
          </View>

          <Text style={s.contactThanks}>Thank you for considering Vijay Trivedi Group.</Text>

          <View style={s.contactFooterLogo}>
            {logoUrl ? (
              <Image src={logoUrl} style={s.contactLogo} />
            ) : (
              <Text style={[s.wordmarkFallback, { fontSize: 14 }]}>VIJAY TRIVEDI GROUP</Text>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
