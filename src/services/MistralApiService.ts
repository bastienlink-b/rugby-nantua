// Types for PDF field mapping
export interface PdfFieldMapping {
  champ_pdf: string;
  type: 'joueur' | 'educateur' | 'global' | 'autre';
  mapping: string;
  valeur_possible?: string[];
}

// Storage key prefix for saved analysis results
const ANALYSIS_STORAGE_PREFIX = 'pdf_analysis_';

/**
 * Save PDF analysis results to localStorage
 * @param pdfKey A unique identifier for the PDF (usually the filename)
 * @param mappings The field mappings from the analysis
 */
export const savePdfAnalysis = (pdfKey: string, mappings: PdfFieldMapping[]): void => {
  try {
    localStorage.setItem(
      `${ANALYSIS_STORAGE_PREFIX}${pdfKey}`, 
      JSON.stringify({
        timestamp: new Date().toISOString(),
        mappings
      })
    );
    console.log(`Analysis for ${pdfKey} saved to local storage`);
  } catch (error) {
    console.error('Error saving PDF analysis:', error);
  }
};

/**
 * Retrieve saved PDF analysis results from localStorage
 * @param pdfKey A unique identifier for the PDF (usually the filename)
 * @returns The saved field mappings or null if not found
 */
export const getSavedPdfAnalysis = (pdfKey: string): PdfFieldMapping[] | null => {
  try {
    const savedData = localStorage.getItem(`${ANALYSIS_STORAGE_PREFIX}${pdfKey}`);
    if (!savedData) return null;
    
    const parsedData = JSON.parse(savedData);
    console.log(`Loaded saved analysis for ${pdfKey} from ${parsedData.timestamp}`);
    return parsedData.mappings;
  } catch (error) {
    console.error('Error retrieving PDF analysis:', error);
    return null;
  }
};

/**
 * Check if analysis exists for a PDF
 * @param pdfKey A unique identifier for the PDF (usually the filename)
 * @returns True if analysis exists
 */
export const hasAnalysis = (pdfKey: string): boolean => {
  return localStorage.getItem(`${ANALYSIS_STORAGE_PREFIX}${pdfKey}`) !== null;
};

/**
 * Extracts text from a PDF file
 * @param pdfData Can be a URL or base64 encoded PDF data
 * @returns The extracted text
 */
export const extractTextFromPdf = async (pdfData: string): Promise<string> => {
  // Simulation de l'extraction de texte depuis PDF
  // Dans une application réelle, cette fonction appellerait l'API Mistral
  
  // Simuler un délai de traitement
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Vérifier si c'est une URL ou des données directes
  if (pdfData.startsWith('data:application/pdf;base64,')) {
    // Traiter les données PDF en base64
    console.log('Processing base64 PDF data...');
    
    // Dans une implémentation réelle, on enverrait les données à l'API
    // Pour l'instant, on renvoie juste un texte simulé
    return `
      Club organisateur: RC MASSY ESSONNE
      Catégorie: M14
      Date: 15/10/2024
      Lieu: Stade Jules Ladoumègue
      
      ÉQUIPE A:
      Nom du club: RC MASSY ESSONNE
      Éducateur responsable: DUPONT Jean
      
      Joueurs:
      1. MARTIN Thomas - License: 1234567
      2. PETIT Lucas - License: 2345678
      3. DUBOIS Nathan - License: 3456789
      
      ÉQUIPE B:
      Nom du club: US OLYMPIQUE
      Éducateur responsable: LEROY Marc
      
      Joueurs:
      1. BERNARD Hugo - License: 4567890
      2. DURAND Louis - License: 5678901
      3. MOREAU Jules - License: 6789012
    `;
  } else {
    // Si c'est une URL, renvoyer une erreur
    throw new Error("Format de données PDF non pris en charge");
  }
};

/**
 * Analyzes the structure of a PDF based on extracted text
 * @param extractedText The text extracted from the PDF
 * @returns An array of field mappings
 */
export const analyzePdfStructure = async (extractedText: string): Promise<PdfFieldMapping[]> => {
  // Simuler un délai de traitement
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Analyse simulée du texte extrait
  // Dans une application réelle, cette fonction appellerait l'API Mistral
  
  // Exemple de mappings détectés - séparé les noms et prénoms
  const mappings: PdfFieldMapping[] = [
    {
      champ_pdf: "Club organisateur",
      type: "global",
      mapping: "tournoi.club_organisateur",
    },
    {
      champ_pdf: "Catégorie",
      type: "global",
      mapping: "tournoi.categorie",
    },
    {
      champ_pdf: "Date",
      type: "global",
      mapping: "tournoi.date",
    },
    {
      champ_pdf: "Lieu",
      type: "global",
      mapping: "tournoi.lieu",
    },
    {
      champ_pdf: "Nom du club (Équipe A)",
      type: "global",
      mapping: "equipe_a.nom",
    },
    {
      champ_pdf: "Nom de l'éducateur (Équipe A)",
      type: "educateur",
      mapping: "equipe_a.educateur.nom",
    },
    {
      champ_pdf: "Prénom de l'éducateur (Équipe A)",
      type: "educateur",
      mapping: "equipe_a.educateur.prenom",
    },
    {
      champ_pdf: "Nom du joueur (Équipe A)",
      type: "joueur",
      mapping: "equipe_a.joueur.nom",
      valeur_possible: ["MARTIN", "PETIT", "DUBOIS"]
    },
    {
      champ_pdf: "Prénom du joueur (Équipe A)",
      type: "joueur",
      mapping: "equipe_a.joueur.prenom",
      valeur_possible: ["Thomas", "Lucas", "Nathan"]
    },
    {
      champ_pdf: "Licence joueur (Équipe A)",
      type: "joueur",
      mapping: "equipe_a.joueur.license",
      valeur_possible: ["1234567", "2345678", "3456789"]
    },
    {
      champ_pdf: "Nom du club (Équipe B)",
      type: "global",
      mapping: "equipe_b.nom",
    },
    {
      champ_pdf: "Nom de l'éducateur (Équipe B)",
      type: "educateur",
      mapping: "equipe_b.educateur.nom",
    },
    {
      champ_pdf: "Prénom de l'éducateur (Équipe B)",
      type: "educateur",
      mapping: "equipe_b.educateur.prenom",
    },
    {
      champ_pdf: "Nom du joueur (Équipe B)",
      type: "joueur",
      mapping: "equipe_b.joueur.nom",
      valeur_possible: ["BERNARD", "DURAND", "MOREAU"]
    },
    {
      champ_pdf: "Prénom du joueur (Équipe B)",
      type: "joueur",
      mapping: "equipe_b.joueur.prenom",
      valeur_possible: ["Hugo", "Louis", "Jules"]
    },
    {
      champ_pdf: "Licence joueur (Équipe B)",
      type: "joueur",
      mapping: "equipe_b.joueur.license",
      valeur_possible: ["4567890", "5678901", "6789012"]
    }
  ];
  
  return mappings;
};