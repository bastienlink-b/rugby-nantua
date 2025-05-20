import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Tournament, Player, Coach, Template } from '../types';
import { getPdf, createPdfBlobUrl } from './PdfStorage';
import { generatePdf } from './PdfGenerator';

/**
 * Génère et télécharge un PDF rempli avec les données fournies
 */
export const generateAndDownloadMatchSheet = async (
  templateId: string,
  tournamentId: string,
  players: Player[],
  coaches: Coach[],
  referentCoachId: string,
  template: Template,
  tournament: Tournament,
  previewOnly: boolean = false
): Promise<void> => {
  try {
    // Génération du PDF
    const pdfBytes = await generatePdf({
      templateId,
      tournamentId,
      players,
      coaches,
      referentCoachId,
      template,
      tournament
    });
    
    // Conversion en Base64
    // If preview only, return the PDF bytes
    if (previewOnly) {
      return pdfBytes;
    }
    
    const pdfBase64 = btoa(
      Array.from(new Uint8Array(pdfBytes))
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
    
    // Création d'une URL de blob
    const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;
    const blobUrl = createPdfBlobUrl(pdfDataUri);
    
    // Téléchargement du fichier
    const filename = `feuille_match_${tournament.location.replace(/\s+/g, '_')}_${tournament.date}.pdf`;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw error;
  }
};