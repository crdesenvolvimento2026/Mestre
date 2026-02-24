import { jsPDF } from "jspdf";
import "jspdf-autotable";
import { CalcInput, CalcResult } from "./electricalLogic";

export function generateMemorialPDF(input: CalcInput, result: CalcResult, clientName: string) {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("MESTRE ENGEHALL", 15, 20);
  doc.setFontSize(10);
  doc.text("Memorial de Cálculo Elétrico - NBR 5410", 15, 30);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Cliente: ${clientName}`, 15, 50);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 15, 57);
  
  // Input Data Table
  doc.setFontSize(14);
  doc.text("1. Dados de Entrada", 15, 70);
  
  const inputData = [
    ["Tipo de Sistema", input.systemType.toUpperCase()],
    ["Tensão", `${input.voltage} V`],
    ["Potência", `${input.power} W`],
    ["Fator de Potência", input.powerFactor.toString()],
    ["Tipo de Carga", input.loadType.toUpperCase()],
    ["Comprimento", `${input.length} m`],
    ["Método de Instalação", input.method],
    ["Temperatura Ambiente", `${input.temp} °C`],
    ["Circuitos Agrupados", input.grouping.toString()],
    ["Curva do Disjuntor", input.breakerCurve],
    ["Corrente Nominal (In)", `${input.breakerRating} A`],
  ];

  (doc as any).autoTable({
    startY: 75,
    head: [['Parâmetro', 'Valor']],
    body: inputData,
    theme: 'striped',
    headStyles: { fillColor: [51, 65, 85] }
  });

  // Results Table
  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.text("2. Resultados do Dimensionamento", 15, finalY);

  const resultData = [
    ["Corrente de Projeto (Ib)", `${result.current.toFixed(2)} A`],
    ["Seção do Condutor (Fase)", `${result.cableSection} mm²`],
    ["Seção do Condutor (Neutro)", `${result.neutralSection} mm²`],
    ["Seção do Condutor (Terra)", `${result.earthSection} mm²`],
    ["Eletroduto Sugerido", result.conduitSize],
    ["Disjuntor (In)", `${result.breakerRating} A`],
    ["Queda de Tensão (V)", `${result.voltageDrop.toFixed(2)} V`],
    ["Queda de Tensão (%)", `${result.voltageDropPercent.toFixed(2)} %`],
    ["Status de Conformidade", result.isConform ? "CONFORME" : "NÃO CONFORME"],
  ];

  (doc as any).autoTable({
    startY: finalY + 5,
    head: [['Parâmetro', 'Valor']],
    body: resultData,
    theme: 'grid',
    headStyles: { fillColor: result.isConform ? [22, 163, 74] : [220, 38, 38] }
  });

  // BOM Table
  const bomY = (doc as any).lastAutoTable.finalY + 15;
  doc.text("3. Lista de Materiais Estimada (BOM)", 15, bomY);

  const bomData = result.bom.map(item => [item.item, item.quantity, `R$ ${item.estimatedPrice.toFixed(2)}`]);

  (doc as any).autoTable({
    startY: bomY + 5,
    head: [['Item', 'Quantidade', 'Preço Est.']],
    body: bomData,
    theme: 'striped',
    headStyles: { fillColor: [5, 150, 105] }
  });

  // Footer
  doc.setFontSize(10);
  doc.text("Este documento foi gerado automaticamente pelo aplicativo Mestre Engehall.", 15, 280);
  doc.text("Responsável Técnico: Engehall Engenharia", 15, 285);

  doc.save(`Memorial_Calculo_${clientName.replace(/\s/g, '_')}.pdf`);
}

export function generateServiceOrderPDF(ticket: any, nr10: any, signature: string | null, calculations: any[]) {
  const doc = new jsPDF();
  
  // Header
  doc.setFillColor(220, 38, 38); // Red 600
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.text("ORDEM DE SERVIÇO", 15, 20);
  doc.setFontSize(10);
  doc.text(`Chamado #${ticket.id} - MESTRE ENGEHALL`, 15, 30);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.text(`Cliente: ${ticket.client_name}`, 15, 50);
  doc.text(`Título: ${ticket.title}`, 15, 57);
  doc.text(`Status: ${ticket.status.toUpperCase()}`, 15, 64);
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 15, 71);

  // NR10 Section
  doc.setFontSize(14);
  doc.text("1. Segurança (NR10)", 15, 85);
  const nr10Data = nr10 ? [
    ["Uso de EPIs", nr10.epi ? "OK" : "PENDENTE"],
    ["Desenergizado", nr10.desenergizado ? "OK" : "PENDENTE"],
    ["Sinalizado", nr10.sinalizado ? "OK" : "PENDENTE"],
    ["Ferramentas Isoladas", nr10.ferramentas_isoladas ? "OK" : "PENDENTE"],
    ["Área Isolada", nr10.area_isolada ? "OK" : "PENDENTE"],
  ] : [["Status", "NÃO REALIZADO"]];

  (doc as any).autoTable({
    startY: 90,
    head: [['Item de Segurança', 'Status']],
    body: nr10Data,
    theme: 'grid',
    headStyles: { fillColor: [185, 28, 28] }
  });

  // Calculations Section
  const calcY = (doc as any).lastAutoTable.finalY + 15;
  doc.text("2. Memoriais de Cálculo Associados", 15, calcY);
  const calcData = calculations.map(c => [c.description, "Anexo ao Memorial"]);
  
  (doc as any).autoTable({
    startY: calcY + 5,
    head: [['Descrição do Cálculo', 'Observação']],
    body: calcData,
    theme: 'striped'
  });

  // Signature Section
  const sigY = (doc as any).lastAutoTable.finalY + 20;
  doc.text("3. Assinatura do Cliente", 15, sigY);
  if (signature) {
    doc.addImage(signature, 'PNG', 15, sigY + 5, 50, 20);
  } else {
    doc.rect(15, sigY + 5, 100, 30);
    doc.text("Assinatura não coletada digitalmente", 20, sigY + 20);
  }

  doc.save(`OS_${ticket.id}_${ticket.client_name.replace(/\s/g, '_')}.pdf`);
}
