import type { SafetyReport, Client, Organization } from "@shared/schema";

function splitLines(doc: any, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "", maxWidth);
}

function addPageHeader(doc: any, pageWidth: number, orgName: string, reportTitle: string) {
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(orgName, 10, 8);
  doc.setFont("helvetica", "normal");
  doc.text(reportTitle, pageWidth - 10, 8, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function addPageFooter(doc: any, pageWidth: number, page: number, total: number) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(10, pageH - 14, pageWidth - 10, pageH - 14);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  doc.text("Confidential — for recipient use only", 10, pageH - 9);
  doc.text(`Page ${page} of ${total}`, pageWidth - 10, pageH - 9, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function gradeColor(grade: string): [number, number, number] {
  if (grade === "A") return [22, 163, 74];
  if (grade === "B") return [37, 99, 235];
  if (grade === "C") return [234, 179, 8];
  return [220, 38, 38];
}

function scoreColor(score: number): [number, number, number] {
  if (score >= 90) return [22, 163, 74];
  if (score >= 75) return [37, 99, 235];
  if (score >= 60) return [234, 179, 8];
  return [220, 38, 38];
}

function checkPage(doc: any, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 20) {
    doc.addPage();
    return margin;
  }
  return y;
}

export async function exportSafetyReportPDF(
  report: SafetyReport,
  client: Client,
  org: Organization,
  parentClient?: Client,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;

  const periodLabel = `${new Date(report.periodStart + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  const reportTitle = `Contractor Safety Rating — ${periodLabel}`;
  const generatedDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 50, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(org.name, margin, 20);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Contractor Safety Rating Report", margin, 30);
  doc.setFontSize(8.5);
  doc.text(reportTitle, margin, 38);
  doc.text(client.name, margin, 45);
  doc.setTextColor(0, 0, 0);

  let y = 65;

  // Grade badge
  const gc = gradeColor(report.letterGrade);
  doc.setFillColor(...gc);
  doc.roundedRect(pageWidth - margin - 36, 55, 36, 30, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(report.letterGrade, pageWidth - margin - 18, 72, { align: "center" });
  doc.setFontSize(7);
  doc.text("GRADE", pageWidth - margin - 18, 80, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Overall score
  const sc = scoreColor(report.overallScore);
  doc.setFillColor(...sc);
  doc.roundedRect(pageWidth - margin - 80, 55, 36, 30, 4, 4, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(`${report.overallScore}`, pageWidth - margin - 62, 72, { align: "center" });
  doc.setFontSize(7);
  doc.text("SCORE", pageWidth - margin - 62, 80, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // Summary table
  const summaryRows: [string, string][] = [
    ["Contractor", client.name],
    ...(parentClient ? [["Parent Contractor", parentClient.name] as [string, string]] : []),
    ["Contact", `${client.contactName} — ${client.contactEmail}`],
    ["Report Period", `${new Date(report.periodStart + "T12:00:00").toLocaleDateString("en-US")} – ${new Date(report.periodEnd + "T12:00:00").toLocaleDateString("en-US")}`],
    ["Period Type", report.periodType.charAt(0).toUpperCase() + report.periodType.slice(1)],
    ["Project Risk Tier", report.projectRiskTier],
    ["Total Manhours", report.totalManhours.toLocaleString()],
    ["Total Headcount", report.totalHeadcount.toLocaleString()],
    ["Report Prepared By", org.name],
    ["Report Date", generatedDate],
  ];

  const rowH = 9;
  summaryRows.forEach(([label, value]) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin - 4, y - 2, contentWidth + 8, rowH, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(margin - 4, y + rowH - 2, margin - 4 + contentWidth + 8, y + rowH - 2);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label.toUpperCase(), margin, y + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const valLines = splitLines(doc, value, contentWidth * 0.55);
    doc.text(valLines, margin + contentWidth * 0.42, y + 4.5);
    y += rowH;
  });

  y += 8;

  // ── PAGE 2: SCORING BREAKDOWN ───────────────────────────────────────────────
  doc.addPage();
  addPageHeader(doc, pageWidth, org.name, reportTitle);
  y = 22;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Scoring Breakdown", margin, y);
  y += 10;

  const categories: Array<{ label: string; score: number; weight: string }> = [
    { label: "Incident History (Lagging)", score: report.incidentHistoryScore, weight: "35%" },
    { label: "Training Compliance", score: report.trainingComplianceScore, weight: "20%" },
    { label: "Hazard Management", score: report.hazardManagementScore, weight: "20%" },
    { label: "Permit & Pre-Task", score: report.permitPreTaskScore, weight: "15%" },
    { label: "Reporting Culture", score: report.reportingCultureScore, weight: "10%" },
  ];

  const barMaxW = contentWidth * 0.5;
  categories.forEach(cat => {
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.text(cat.label, margin, y + 4);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Weight: ${cat.weight}`, pageWidth - margin - 20, y + 4, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 7;

    doc.setFillColor(226, 232, 240);
    doc.roundedRect(margin, y, barMaxW, 6, 2, 2, "F");
    const barW = (cat.score / 100) * barMaxW;
    const barC = scoreColor(cat.score);
    doc.setFillColor(...barC);
    if (barW > 2) doc.roundedRect(margin, y, barW, 6, 2, 2, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`${cat.score}`, margin + barMaxW + 5, y + 4.5);

    const grade =
      cat.score >= 90 ? "A" : cat.score >= 75 ? "B" : cat.score >= 60 ? "C" : "D";
    const gc2 = gradeColor(grade);
    doc.setTextColor(...gc2);
    doc.text(grade, margin + barMaxW + 14, y + 4.5);
    doc.setTextColor(0, 0, 0);
    y += 12;
  });

  // Overall
  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Overall Score", margin, y + 4);
  const oc = scoreColor(report.overallScore);
  doc.setFillColor(...oc);
  doc.roundedRect(pageWidth - margin - 40, y - 2, 40, 12, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`${report.overallScore} / 100 (${report.letterGrade})`, pageWidth - margin - 20, y + 6, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 18;

  // ── LAGGING INDICATORS ──────────────────────────────────────────────────────
  y = checkPage(doc, y, 50, margin);
  if (y === margin) { addPageHeader(doc, pageWidth, org.name, reportTitle); y = 22; }

  doc.setFillColor(30, 41, 59);
  doc.rect(margin - 4, y - 3, contentWidth + 8, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("LAGGING INDICATORS — INCIDENT HISTORY", margin, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 14;

  const trir = ((report.recordableIncidents / Math.max(report.totalManhours, 1)) * 200000).toFixed(2);
  const dart = ((report.dartCases / Math.max(report.totalManhours, 1)) * 200000).toFixed(2);
  const ltir = ((report.lostTimeIncidents / Math.max(report.totalManhours, 1)) * 200000).toFixed(2);

  const laggingRows: [string, string, string][] = [
    ["TRIR", `${trir} (Industry avg: ~2.8)`, `${report.recordableIncidents} recordable incident${report.recordableIncidents !== 1 ? "s" : ""}`],
    ["DART Rate", `${dart} (Industry avg: ~1.5)`, `${report.dartCases} DART case${report.dartCases !== 1 ? "s" : ""}`],
    ["LTIR", `${ltir}`, `${report.lostTimeIncidents} lost-time incident${report.lostTimeIncidents !== 1 ? "s" : ""}`],
    ["EMR", `${report.emr.toFixed(2)} (Benchmark: 1.0)`, report.emr < 1.0 ? "Below benchmark — favorable" : "Above benchmark — review program"],
    ["OSHA Citations", `Willful: ${report.oshaWillfulCitations} / Serious: ${report.oshaSeriousCitations} / Other: ${report.oshaOtherCitations}`, ""],
    ["Open WC Claims", `${report.openWcClaims}`, ""],
  ];

  laggingRows.forEach(([label, value, note]) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin - 4, y - 2, contentWidth + 8, rowH, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(margin - 4, y + rowH - 2, margin - 4 + contentWidth + 8, y + rowH - 2);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value, margin + contentWidth * 0.35, y + 4.5);
    if (note) {
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.text(note, pageWidth - margin - 2, y + 4.5, { align: "right" });
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(8);
    }
    y += rowH;
  });
  y += 8;

  // ── LEADING INDICATORS ──────────────────────────────────────────────────────
  y = checkPage(doc, y, 14, margin);
  if (y === margin) { addPageHeader(doc, pageWidth, org.name, reportTitle); y = 22; }

  doc.setFillColor(30, 41, 59);
  doc.rect(margin - 4, y - 3, contentWidth + 8, 11, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("LEADING INDICATORS", margin, y + 5);
  doc.setTextColor(0, 0, 0);
  y += 14;

  const inspRatio = report.inspectionsScheduled > 0
    ? `${report.inspectionsCompleted}/${report.inspectionsScheduled} (${Math.round(report.inspectionsCompleted / report.inspectionsScheduled * 100)}%)`
    : `${report.inspectionsCompleted}`;
  const caRatio = report.correctiveActionsOpened > 0
    ? `${report.correctiveActionsClosed}/${report.correctiveActionsOpened} (${Math.round(report.correctiveActionsClosed / report.correctiveActionsOpened * 100)}%)`
    : `${report.correctiveActionsClosed}`;

  const leadingRows: [string, string][] = [
    ["Inspections Completed / Scheduled", inspRatio],
    ["Avg Corrective Action Close Time", `${report.avgCorrectiveActionDays} day${report.avgCorrectiveActionDays !== 1 ? "s" : ""}`],
    ["Corrective Actions Closed / Opened", caRatio],
    ["Near-Miss Reports", `${report.nearMissReports} (per ${report.totalHeadcount} workers)`],
    ["Toolbox Talks", `${report.toolboxTalksCompleted}/${report.toolboxTalksScheduled}`],
    ["Certified Workforce", `${report.certifiedWorkforcePercent}%`],
    ["JHA Compliance", `${report.jhaCompliancePercent}%`],
    ["Permit Compliance", `${report.permitCompliancePercent}%`],
  ];

  leadingRows.forEach(([label, value]) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin - 4, y - 2, contentWidth + 8, rowH, "F");
    doc.setDrawColor(226, 232, 240);
    doc.line(margin - 4, y + rowH - 2, margin - 4 + contentWidth + 8, y + rowH - 2);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, margin, y + 4.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value, margin + contentWidth * 0.55, y + 4.5);
    y += rowH;
  });
  y += 8;

  // ── RISK SUMMARY ────────────────────────────────────────────────────────────
  if (report.topRiskAreas || report.recommendedActions) {
    y = checkPage(doc, y, 40, margin);
    if (y === margin) { addPageHeader(doc, pageWidth, org.name, reportTitle); y = 22; }

    doc.setFillColor(30, 41, 59);
    doc.rect(margin - 4, y - 3, contentWidth + 8, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("RISK SUMMARY & RECOMMENDATIONS", margin, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 14;

    if (report.topRiskAreas) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("Top Risk Areas:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const riskLines = splitLines(doc, report.topRiskAreas, contentWidth);
      doc.text(riskLines, margin + 4, y);
      y += riskLines.length * 4.5 + 4;
    }

    if (report.recommendedActions) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text("Recommended Actions:", margin, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      const recLines = splitLines(doc, report.recommendedActions, contentWidth);
      doc.text(recLines, margin + 4, y);
      y += recLines.length * 4.5 + 4;
    }
  }

  // Fix footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    addPageFooter(doc, pageWidth, p, totalPages);
  }

  const filename = `safety-rating-${client.name.replace(/\s+/g, "-").toLowerCase()}-${report.periodStart}.pdf`;
  doc.save(filename);
}
