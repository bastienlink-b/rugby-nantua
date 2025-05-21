import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Tournament, Player, Coach, Template } from '../types';
import { getPdf, createPdfBlobUrl, storePdf } from './PdfStorage';
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
): Promise<Uint8Array> => {
  try {
    console.log("Génération d'une feuille de match pour téléchargement avec les données suivantes:");
    console.log("- Template:", template.name);
    console.log("- Tournoi:", tournament.location);
    console.log("- Nombre de joueurs:", players.length);
    console.log("- Nombre d'entraîneurs:", coaches.length);
    
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
    
    // If preview only, return the PDF bytes
    if (previewOnly) {
      console.log("Mode prévisualisation uniquement, retour des données PDF");
      return pdfBytes;
    }
    
    // Conversion en Base64
    const pdfBase64 = btoa(
      Array.from(new Uint8Array(pdfBytes))
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
    
    // Création d'une URL de blob
    const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;
    
    // Nettoyer les champs du formulaire avant de créer le blob
    const cleanedPdfDataUri = await cleanPdfFormFields(pdfDataUri);
    
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
    
    console.log("PDF généré et téléchargé avec succès");
    
    return pdfBytes;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    throw error;
  }
};

/**
 * Génère un PDF pour une feuille de match et le stocke dans Supabase
 * @returns Le nom du fichier généré
 */
export const generateAndStorePdf = async (
  templateId: string,
  tournamentId: string,
  players: Player[],
  coaches: Coach[],
  referentCoachId: string,
  template: Template,
  tournament: Tournament
): Promise<string> => {
  try {
    console.log("Début de la génération du PDF pour stockage...");
    console.log("- Template:", template.name);
    console.log("- Tournoi:", tournament.location);
    console.log("- Nombre de joueurs:", players.length);
    console.log("- Nombre d'entraîneurs:", coaches.length);
    
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
    
    console.log("PDF généré avec succès, conversion en Base64...");
    // Conversion en Base64
    const pdfBase64 = btoa(
      Array.from(new Uint8Array(pdfBytes))
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
    
    // Créer un nom de fichier unique
    const timestamp = Date.now();
    const filename = `feuille_match_${tournament.location.replace(/\s+/g, '_')}_${tournament.date}_${timestamp}.pdf`;
    
    console.log(`Stockage du PDF généré sous: ${filename}`);
    // Stocker le PDF dans Supabase
    const pdfDataUri = `data:application/pdf;base64,${pdfBase64}`;
    await storePdf(filename, pdfDataUri, true);
    
    console.log(`PDF généré et stocké avec succès: ${filename}`);
    
    return filename;
  } catch (error) {
    console.error('Erreur lors de la génération et du stockage du PDF:', error);
    throw error;
  }
};