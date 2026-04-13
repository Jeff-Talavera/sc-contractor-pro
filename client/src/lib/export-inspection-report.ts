import type { Inspection, Observation, Jobsite, Client, User, CodeReference, EmployeeProfile, Organization } from "@shared/schema";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function splitLines(doc: any, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text || "", maxWidth);
}

function checkPage(doc: any, y: number, needed: number, margin: number): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - 20) {
    doc.addPage();
    return margin;
  }
  return y;
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

function addPageFooter(doc: any, pageWidth: number, pageNum: number, total: number, ccLine: string) {
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200, 200, 200);
  doc.line(10, pageH - 14, pageWidth - 10, pageH - 14);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);
  if (ccLine) doc.text(ccLine, 10, pageH - 9);
  doc.text(`Page ${pageNum} of ${total}`, pageWidth - 10, pageH - 9, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

export async function exportInspectionReportPDF(
  inspection: Inspection,
  observations: Observation[],
  jobsite: Jobsite,
  client: Client,
  inspector: User,
  codeRefMap: Map<string, CodeReference>,
  org: Organization,
  employee?: EmployeeProfile,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const orgName = org.name;

  const inspectorCredentials = employee?.certifications?.join(", ") ?? "";
  const inspectorPhone = employee?.phone ?? "";
  const inspectorEmail = inspector.email;

  const reportTitle = `Safety Inspection Report — ${inspection.date}`;
  const ccLine = inspection.ccList?.length
    ? `CC: ${inspection.ccList.join(" | ")}`
    : "";

  const issueObs = observations.filter(o => o.type === "issue");
  const positiveObs = observations.filter(o => o.type === "positive");
  const totalCount = observations.length;
  const positiveCount = positiveObs.length;
  const score = totalCount > 0 ? Math.round((positiveCount / totalCount) * 1000) / 10 : 0;

  const categories = Array.from(new Set(observations.map(o => o.category))).sort();

  const formattedDate = new Date(inspection.date + "T12:00:00").toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  // ─── PAGE 1: COVER LETTER ──────────────────────────────────────────────────
  let y = margin;

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 36, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(orgName, margin, 17);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const contactLine = [inspectorPhone, inspectorEmail].filter(Boolean).join("  •  ");
  doc.text(contactLine, margin, 25);
  doc.text("Construction Safety Consulting", margin, 31);
  doc.setTextColor(0, 0, 0);
  y = 48;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(formattedDate, pageWidth - margin, y, { align: "right" });
  y += 10;

  if (inspection.recipientName) {
    doc.setFont("helvetica", "bold");
    doc.text(inspection.recipientName, margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    if (inspection.recipientTitle) { doc.text(inspection.recipientTitle, margin, y); y += 5; }
    if (inspection.recipientCompany) { doc.text(inspection.recipientCompany, margin, y); y += 5; }
    if (inspection.recipientAddress) {
      const addrLines = splitLines(doc, inspection.recipientAddress, contentWidth / 2);
      doc.text(addrLines, margin, y);
      y += addrLines.length * 5;
    }
    y += 2;
  }

  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Re: Safety Inspection Report — ${jobsite.name}`, margin, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`${jobsite.address}, ${jobsite.city}${jobsite.state ? `, ${jobsite.state}` : ""}`, margin, y);
  y += 10;
  doc.setFont("helvetica", "normal");

  const greeting = inspection.recipientName
    ? `Dear ${inspection.recipientName.split(" ")[0]},`
    : "Dear Project Team,";
  doc.text(greeting, margin, y);
  y += 7;

  const bodyText = `Please find enclosed the results of the safety inspection conducted at the above-referenced project on ${formattedDate}. This inspection was performed by ${inspector.name}${inspectorCredentials ? `, ${inspectorCredentials}` : ""}, on behalf of ${orgName}.`;
  const bodyLines = splitLines(doc, bodyText, contentWidth);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * 5 + 5;

  const body2 = `A total of ${totalCount} inspection item${totalCount !== 1 ? "s were" : " was"} reviewed. ${positiveCount} item${positiveCount !== 1 ? "s" : ""} were found to be in compliance, and ${issueObs.length} item${issueObs.length !== 1 ? "s" : ""} required corrective action. The overall compliance score for this inspection is ${score}%. Please review the attached findings and ensure all corrective actions are completed in a timely manner.`;
  const body2Lines = splitLines(doc, body2, contentWidth);
  doc.text(body2Lines, margin, y);
  y += body2Lines.length * 5 + 5;

  const body3 = "Should you have any questions or require clarification regarding any of the findings in this report, please do not hesitate to contact our office directly.";
  const body3Lines = splitLines(doc, body3, contentWidth);
  doc.text(body3Lines, margin, y);
  y += body3Lines.length * 5 + 10;

  doc.text("Respectfully submitted,", margin, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text(inspector.name, margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  if (inspectorCredentials) { doc.text(inspectorCredentials, margin, y); y += 5; }
  doc.text(orgName, margin, y);
  y += 3;

  if (inspection.ccList && inspection.ccList.length > 0) {
    y = Math.max(y, pageH - 60);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("CC:", margin, y);
    doc.setFont("helvetica", "normal");
    inspection.ccList.forEach(cc => {
      y += 5;
      doc.text(`• ${cc}`, margin + 8, y);
    });
    y += 5;
  }

  const disclaimer = "This report is prepared for the exclusive use of the recipient and may not be used or relied upon by any other person. The findings in this report reflect conditions observed during the inspection visit only and are not a guarantee of overall site safety compliance.";
  const discLines = splitLines(doc, disclaimer, contentWidth);
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  const discY = pageH - 20;
  doc.text(discLines, margin, discY);
  doc.setTextColor(0, 0, 0);

  // ─── PAGE 2: REPORT SUMMARY ────────────────────────────────────────────────
  doc.addPage();
  addPageHeader(doc, pageWidth, orgName, reportTitle);
  y = 22;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin - 4, y - 4, contentWidth + 8, 16, 2, 2, "F");
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("SAFETY INSPECTION REPORT", margin, y + 8);
  doc.setTextColor(0, 0, 0);
  y += 20;

  const scoreColor: [number, number, number] = score >= 80 ? [22, 163, 74] : score >= 60 ? [234, 179, 8] : [220, 38, 38];
  doc.setFillColor(...scoreColor);
  doc.roundedRect(pageWidth - margin - 30, y - 6, 30, 16, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`${score}%`, pageWidth - margin - 15, y + 5, { align: "center" });
  doc.setFontSize(7);
  doc.text("SCORE", pageWidth - margin - 15, y + 11, { align: "center" });
  doc.setTextColor(0, 0, 0);

  const recipientContact = [
    inspection.recipientName,
    inspection.recipientTitle,
    inspection.recipientCompany,
  ].filter(Boolean).join(", ");

  const summaryRows: [string, string][] = [
    ["Report Type", "Construction Site Safety Inspection"],
    ["Completed For", `${client.name}`],
    ...(recipientContact ? [["Contact", recipientContact] as [string, string]] : []),
    ["Inspection Date", formattedDate],
    ["Location", `${jobsite.address}, ${jobsite.city}${jobsite.state ? `, ${jobsite.state}` : ""}`],
    ["Inspector", `${inspector.name}${inspectorCredentials ? `, ${inspectorCredentials}` : ""}`],
    ["Total Items Reviewed", `${totalCount} (${positiveCount} compliant, ${issueObs.length} requiring action)`],
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
  y += 6;

  if (inspection.scopeOfWork) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Scope of Work", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const scopeLines = splitLines(doc, inspection.scopeOfWork, contentWidth);
    doc.text(scopeLines, margin, y);
    y += scopeLines.length * 5 + 8;
  }

  // ─── PAGES 3+: FINDINGS BY CATEGORY ────────────────────────────────────────
  doc.addPage();
  addPageHeader(doc, pageWidth, orgName, reportTitle);
  y = 22;

  let pageNum = 3;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Inspection Findings", margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `${positiveCount} compliant item${positiveCount !== 1 ? "s" : ""} / ${issueObs.length} issue${issueObs.length !== 1 ? "s" : ""} identified`,
    margin, y
  );
  doc.setTextColor(0, 0, 0);
  y += 10;

  for (const category of categories) {
    const catObs = observations.filter(o => o.category === category);
    const catPositive = catObs.filter(o => o.type === "positive");
    const catIssues = catObs.filter(o => o.type === "issue");

    y = checkPage(doc, y, 20, margin);
    if (y === margin) {
      addPageHeader(doc, pageWidth, orgName, reportTitle);
      pageNum++;
      y = 22;
    }

    doc.setFillColor(30, 41, 59);
    doc.rect(margin - 4, y - 3, contentWidth + 8, 11, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(category.toUpperCase(), margin, y + 5);
    doc.setTextColor(0, 0, 0);
    y += 14;

    for (const obs of catPositive) {
      y = checkPage(doc, y, 16, margin);
      if (y === margin) {
        addPageHeader(doc, pageWidth, orgName, reportTitle);
        pageNum++;
        y = 22;
      }

      doc.setFillColor(240, 253, 244);
      doc.rect(margin - 4, y - 2, contentWidth + 8, 13, "F");
      doc.setDrawColor(134, 239, 172);
      doc.line(margin - 4, y - 2, margin - 4, y + 11);

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(22, 163, 74);
      doc.text("✓  COMPLIANT", margin + 1, y + 4.5);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      const descLines = splitLines(doc, obs.description, contentWidth - 28);
      doc.setFontSize(8.5);
      doc.text(descLines, margin + 28, y + 2);

      if (obs.linkedCodeReferenceIds.length > 0) {
        const refs = obs.linkedCodeReferenceIds.map(id => id).join(", ");
        doc.setFontSize(7);
        doc.setTextColor(100, 116, 139);
        const refText = splitLines(doc, refs, contentWidth - 28);
        doc.text(refText, margin + 28, y + 2 + descLines.length * 4.5);
        doc.setTextColor(0, 0, 0);
        y += Math.max(13, descLines.length * 4.5 + refText.length * 3.5 + 4);
      } else {
        y += Math.max(13, descLines.length * 4.5 + 4);
      }
      y += 2;
    }

    for (const obs of catIssues) {
      const linesNeeded = 45;
      y = checkPage(doc, y, linesNeeded, margin);
      if (y === margin) {
        addPageHeader(doc, pageWidth, orgName, reportTitle);
        pageNum++;
        y = 22;
      }

      const severityColor: Record<string, [number, number, number]> = {
        High: [220, 38, 38],
        Medium: [234, 179, 8],
        Low: [100, 116, 139],
      };
      const sColor = severityColor[obs.severity] ?? [100, 116, 139];

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin - 4, y - 2, contentWidth + 8, 5, "F");

      doc.setFillColor(...sColor);
      doc.rect(margin - 4, y - 2, 3, 5, "F");

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...sColor);
      doc.text(`⚠  ${obs.severity.toUpperCase()} — ISSUE IDENTIFIED`, margin + 1, y + 1.5);

      if (obs.correctedOnSite) {
        doc.setFillColor(22, 163, 74);
        const corrW = 28;
        doc.roundedRect(pageWidth - margin - corrW, y - 2, corrW, 5, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text("CORRECTED ON SITE", pageWidth - margin - corrW / 2, y + 1.5, { align: "center" });
      }
      doc.setTextColor(0, 0, 0);
      y += 7;

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      const descLines = splitLines(doc, obs.description, contentWidth);
      doc.text(descLines, margin, y);
      y += descLines.length * 4.5 + 3;

      if (obs.location) {
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Location: ${obs.location}`, margin, y);
        doc.setTextColor(0, 0, 0);
        y += 4.5;
      }

      if (obs.recommendedActions.length > 0) {
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Recommendation:", margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        obs.recommendedActions.forEach(action => {
          const actionLines = splitLines(doc, `• ${action}`, contentWidth - 4);
          doc.setFontSize(8);
          doc.text(actionLines, margin + 2, y);
          y += actionLines.length * 4.5 + 1;
        });
      }

      if (obs.linkedCodeReferenceIds.length > 0) {
        const refs = obs.linkedCodeReferenceIds
          .map(id => {
            const ref = codeRefMap.get(id);
            return ref ? `${id} — ${ref.title}` : id;
          })
          .join(";  ");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const refLines = splitLines(doc, `Ref: ${refs}`, contentWidth);
        doc.text(refLines, margin, y);
        doc.setTextColor(0, 0, 0);
        y += refLines.length * 4 + 3;
      }

      if (obs.photoUrls && obs.photoUrls.length > 0) {
        for (const photoUrl of obs.photoUrls.slice(0, 2)) {
          try {
            y = checkPage(doc, y, 70, margin);
            if (y === margin) {
              addPageHeader(doc, pageWidth, orgName, reportTitle);
              pageNum++;
              y = 22;
            }
            const img = await loadImage(photoUrl);
            const maxW = contentWidth * 0.6;
            const maxH = 60;
            const scale = Math.min(maxW / img.width, maxH / img.height, 1);
            const imgW = img.width * scale;
            const imgH = img.height * scale;
            const format = photoUrl.startsWith("data:image/jpeg") || photoUrl.startsWith("data:image/jpg") ? "JPEG" : "PNG";
            doc.addImage(img, format, margin, y, imgW, imgH);
            y += imgH + 4;
          } catch {
            // skip unloadable photos
          }
        }
      }

      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    }

    y += 4;
  }

  // Fix page footers (re-render all pages now that we know total page count)
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    if (p === 1) {
      // cover letter — already has disclaimer
      continue;
    }
    addPageFooter(doc, pageWidth, p, totalPages, ccLine);
  }

  const filename = `safety-inspection-report-${jobsite.name.replace(/\s+/g, "-").toLowerCase()}-${inspection.date}.pdf`;
  doc.save(filename);
}
