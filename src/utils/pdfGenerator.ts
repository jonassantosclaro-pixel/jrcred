import { jsPDF } from "jspdf";
import { Simulation } from "../types";
import { formatCurrency, formatCPF, formatNIS } from "./helpers";

export function generateSimulationPDF(simulation: Simulation) {
  const doc = new jsPDF();
  
  // Cores institucionais
  const primaryNavy = [10, 15, 29]; // #0A0F1D
  const goldAccent = [212, 175, 55]; // #D4AF37
  const greyText = [100, 116, 139]; // #64748B
  
  // Cabeçalho - Logomarca Simula
  doc.rect(0, 0, 210, 35, "F");
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  
  // Título do Cabeçalho
  doc.setTextColor(goldAccent[0], goldAccent[1], goldAccent[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("JR CRÉDITO E SOLUÇÕES", 15, 18);
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Correspondente Bancário Autorizado & Consultoria Financeira", 15, 25);
  doc.text("Soluções Inteligentes em Crédito Consignado e Benefícios", 15, 30);
  
  // Data e Código de Simulação
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`SIMULAÇÃO #${simulation.id.slice(0, 8).toUpperCase()}`, 155, 18);
  const simDate = new Date(simulation.createdAt).toLocaleString("pt-BR");
  doc.text(`Data: ${simDate}`, 155, 24);
  
  // Corpo do PDF
  // Informações do Cliente
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("1. Dados do Beneficiário", 15, 50);
  
  // Linha divisória dourada
  doc.setDrawColor(goldAccent[0], goldAccent[1], goldAccent[2]);
  doc.setLineWidth(1);
  doc.line(15, 53, 195, 53);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let y = 62;
  
  doc.text(`Nome Completo:`, 15, y);
  doc.setFont("helvetica", "bold");
  doc.text(`${simulation.clientName}`, 55, y);
  
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.text(`CPF:`, 15, y);
  doc.setFont("helvetica", "bold");
  doc.text(`${formatCPF(simulation.cpf)}`, 55, y);
  
  if (simulation.nis) {
    doc.setFont("helvetica", "normal");
    y += 8;
    doc.text(`NIS (Bolsa Família):`, 15, y);
    doc.setFont("helvetica", "bold");
    doc.text(`${formatNIS(simulation.nis)}`, 55, y);
  }
  
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.text(`Telefone de Contato:`, 15, y);
  doc.setFont("helvetica", "bold");
  doc.text(`${simulation.phone}`, 55, y);
  
  // Detalhes da Proposta de Empréstimo
  y += 18;
  doc.setTextColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("2. Parâmetros do Crédito Especial", 15, y);
  
  // Linha divisória dourada
  y += 3;
  doc.setDrawColor(goldAccent[0], goldAccent[1], goldAccent[2]);
  doc.line(15, y, 195, y);
  
  doc.setTextColor(0, 0, 0);
  y += 10;
  
  // Caixa cinza de resumo dos cálculos
  doc.setFillColor(248, 250, 252);
  doc.rect(15, y - 4, 180, 52, "F");
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Tipo de Benefício:", 20, y + 2);
  doc.setFont("helvetica", "bold");
  doc.text(
    simulation.type === "bolsa_familia" ? "Bolsa Família (Crédito Bolsa+)" : "Aposentado/Pensionista INSS",
    65,
    y + 2
  );
  
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.text("Valor Atual do Benefício:", 20, y + 2);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(simulation.benefitAmount), 65, y + 2);
  
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.text("Margem Consignável (Utilizada):", 20, y + 2);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${simulation.marginRate}% – ${formatCurrency(simulation.marginAmount)}`,
    65,
    y + 2
  );
  
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.text("Mensalidade (Parcela):", 20, y + 2);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(goldAccent[0], goldAccent[1], goldAccent[2]);
  doc.text(formatCurrency(simulation.installmentAmount), 65, y + 2);
  
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  y += 8;
  doc.text("Quantidade de Parcelas:", 20, y + 2);
  doc.setFont("helvetica", "bold");
  doc.text(`${simulation.installmentsCount} meses`, 65, y + 2);
  
  // Quadro de Destaque - VALOR ESTIMADO LIBERADO
  y += 22;
  doc.setFillColor(primaryNavy[0], primaryNavy[1], primaryNavy[2]);
  doc.rect(15, y, 180, 22, "F");
  
  // Borda lateral esquerda dourada
  doc.setFillColor(goldAccent[0], goldAccent[1], goldAccent[2]);
  doc.rect(15, y, 4, 22, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("VALOR ESTIMADO LIBERADO NO SEU CAIXA:", 24, y + 9);
  
  doc.setFontSize(16);
  doc.setTextColor(goldAccent[0], goldAccent[1], goldAccent[2]);
  doc.text(formatCurrency(simulation.requestedAmount), 24, y + 17);
  
  // Selo de Pré-Aprovação Inteligente IA
  y += 33;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(1);
  doc.rect(15, y, 180, 16, "F");
  
  doc.setTextColor(21, 128, 61);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PRÉ-APROVAÇÃO INSTANTÂNEA CONFIRMADA (Selo Inteligente JR Crédito)", 20, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Margem compatível. Estudo preliminar de viabilidade efetuado com juros de ${simulation.interestRate}% a.m.`, 20, y + 12);
  
  // Notas legais no rodapé
  y += 28;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(15, y, 195, y);
  
  y += 6;
  doc.setTextColor(greyText[0], greyText[1], greyText[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "* Esta simulação reflete regras regulamentares em vigor na data de emissão. Valores e prazos estão sujeitos ao",
    15,
    y
  );
  doc.text(
    "enquadramento definitivo do convênio e averbação das fontes pagadoras oficiais (MDS / INSS).",
    15,
    y + 4
  );
  doc.text(
    "* JR Crédito e Soluções Financeiras - Correspondente Bancário certificado pela ANEPS & FEBRABAN.",
    15,
    y + 8
  );
  
  // Salvar PDF
  doc.save(`simulacao_jr_credito_${simulation.clientName.toLowerCase().replace(/\s+/g, "_")}.pdf`);
}
