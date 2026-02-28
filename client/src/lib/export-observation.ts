import type { Observation, CodeReference } from "@shared/schema";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function exportObservationPDF(
  obs: Observation,
  codeRefMap: Map<string, CodeReference>,
  jobsiteName?: string,
  inspectionDate?: string,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("SafeSite", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Construction Safety Observation Report", margin, 19);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth - margin, 19, { align: "right" });
  y = 36;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Observation Details", margin, y);
  y += 8;

  const addField = (label: string, value: string) => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(label.toUpperCase(), margin, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    doc.text(value || "N/A", margin + 40, y);
    y += 6;
  };

  addField("Category", obs.category);
  addField("Severity", obs.severity);
  addField("Status", obs.status);
  addField("Location", obs.location);
  addField("Source", obs.source === "ai" ? "AI-Assisted" : "Manual");
  if (jobsiteName) addField("Jobsite", jobsiteName);
  if (inspectionDate) addField("Inspected", inspectionDate);
  if (obs.assignedTo) addField("Assigned To", obs.assignedTo);
  if (obs.dueDate) addField("Due Date", obs.dueDate);
  addField("Created", new Date(obs.createdAt).toLocaleDateString());

  if (obs.source === "ai" && obs.aiFindings && obs.aiFindings.length > 0) {
    addField("AI Confidence", `${Math.round(obs.aiFindings[0].confidence * 100)}%`);
  }

  y += 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("Description", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const descLines = doc.splitTextToSize(obs.description, contentWidth);
  doc.text(descLines, margin, y);
  y += descLines.length * 4.5 + 4;

  if (obs.recommendedActions.length > 0) {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Recommended Actions", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    obs.recommendedActions.forEach((a, i) => {
      if (y > 275) { doc.addPage(); y = margin; }
      const lines = doc.splitTextToSize(`${i + 1}. ${a}`, contentWidth - 5);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.5 + 2;
    });
    y += 2;
  }

  if (obs.linkedCodeReferenceIds.length > 0) {
    if (y > 260) { doc.addPage(); y = margin; }
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Linked Code References", margin, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    obs.linkedCodeReferenceIds.forEach(refId => {
      if (y > 275) { doc.addPage(); y = margin; }
      const ref = codeRefMap.get(refId);
      const text = ref ? `${refId} — ${ref.title}` : refId;
      const lines = doc.splitTextToSize(`• ${text}`, contentWidth - 5);
      doc.text(lines, margin + 2, y);
      y += lines.length * 4.5 + 2;
    });
    y += 2;
  }

  if (obs.photoUrls && obs.photoUrls.length > 0) {
    for (let i = 0; i < obs.photoUrls.length; i++) {
      try {
        if (y > 180) { doc.addPage(); y = margin; }
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Photo ${i + 1}`, margin, y);
        y += 5;

        const img = await loadImage(obs.photoUrls[i]);
        const maxImgW = contentWidth;
        const maxImgH = 100;
        const imgScale = Math.min(maxImgW / img.width, maxImgH / img.height, 1);
        const imgW = img.width * imgScale;
        const imgH = img.height * imgScale;

        const url = obs.photoUrls[i];
        const format = url.startsWith("data:image/jpeg") || url.startsWith("data:image/jpg") ? "JPEG" : "PNG";
        doc.addImage(img, format, margin, y, imgW, imgH);
        y += imgH + 6;
      } catch {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("[Photo could not be loaded]", margin, y);
        y += 6;
      }
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `SafeSite — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
  }

  const filename = `observation-${obs.id}-${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
