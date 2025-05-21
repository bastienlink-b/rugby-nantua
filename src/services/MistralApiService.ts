// Types for PDF field mapping
export interface PdfFieldMapping {
  champ_pdf: string;
  type: 'joueur' | 'educateur' | 'global' | 'autre';
  mapping: string;
  valeur_possible?: string[];
  obligatoire?: boolean;
  format?: string;
}

// Storage key prefix for saved analysis results
const ANALYSIS_STORAGE_PREFIX = 'pdf_analysis_';

// Mistral API configuration
const MISTRAL_API_KEY = 'MISTRAL_API_KEY'; // Remplacer par la clé réelle ou utiliser une variable d'environnement
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

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
 * Extracts text from a PDF file using pdf.js
 * @param pdfData Base64 encoded PDF data
 * @returns The extracted text
 */
export const extractTextFromPdf = async (pdfData: string): Promise<string> => {
  try {
    console.log('Démarrage de l\'extraction de texte depuis le PDF...');
    
    // Si les données PDF sont en base64, on doit les traiter
    let pdfContent = pdfData;
    if (pdfData.startsWith('data:application/pdf;base64,')) {
      pdfContent = pdfData.split('base64,')[1];
    }
    
    // Préparation des données pour envoi à l'API Mistral
    const prompt = `
    Tu es un expert en extraction de texte et analyse de PDFs. 
    Je vais te fournir le contenu d'un PDF encodé en base64 (celle-ci a été tronquée pour cette simulation).
    Ton objectif est d'extraire tout le texte visible du PDF, en préservant autant que possible la structure.
    Représente les champs de formulaire, tableaux et zones de texte de manière claire.
    
    Base64 du PDF: ${pdfContent.substring(0, 1000)}... (tronqué)
    `;
    
    console.log('Préparation de la requête à l\'API Mistral pour l\'extraction de texte...');
    
    // Dans une implémentation réelle, on appellerait l'API Mistral ici
    // Pour cette démonstration, on simule la réponse
    
    // Simulation d'un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log('Texte extrait avec succès du PDF');
    
    // Texte extrait simulé
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
    
  } catch (error) {
    console.error('Erreur lors de l\'extraction de texte depuis le PDF:', error);
    throw new Error(`Échec de l'extraction de texte: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Analyzes the structure of a PDF based on extracted text using Mistral API
 * @param extractedText The text extracted from the PDF
 * @returns An array of field mappings
 */
export const analyzePdfStructure = async (extractedText: string): Promise<PdfFieldMapping[]> => {
  try {
    console.log('Démarrage de l\'analyse de la structure du PDF avec Mistral...');
    
    // Construction du prompt pour l'API Mistral
    const prompt = `
    Tu es un expert en analyse de formulaires et de documents PDF pour le rugby.
    
    Voici le texte extrait d'un PDF qui est un modèle de feuille de match de rugby:
    
    ${extractedText}
    
    Je veux que tu identifies tous les champs de formulaire et zones où des informations doivent être remplies.
    Pour chaque champ identifié, détermine:
    
    1. Le nom du champ (tel qu'il apparaît dans le PDF)
    2. Le type de données qu'il contient (joueur, educateur, global, autre)
    3. La correspondance (mapping) avec notre structure de données
    
    Types de données possibles:
    - "joueur": informations sur un joueur (nom, prénom, licence, etc.)
    - "educateur": informations sur un entraîneur/éducateur
    - "global": informations générales sur le tournoi, la date, etc.
    - "autre": autres types d'informations
    
    Structure de nos données:
    - Joueurs: nom, prénom, licence, peut_jouer_avant, peut_arbitrer
    - Éducateurs: nom, prénom, licence, diplôme, est_referent
    - Tournoi: nom, date, lieu, catégorie
    
    Réponds avec une liste JSON au format suivant:
    [
      {
        "champ_pdf": "Nom du champ dans le PDF",
        "type": "joueur|educateur|global|autre",
        "mapping": "correspondance.avec.notre.structure",
        "valeur_possible": ["valeur1", "valeur2"] // Optionnel: exemples de valeurs trouvées
      },
      ...
    ]
    
    Ne fournis que le JSON, sans autre texte autour.
    `;
    
    console.log('Envoi de la requête à l\'API Mistral...');
    
    // Dans une implémentation réelle, on appellerait l'API Mistral ici
    // Pour cette démonstration, on simule la réponse
    
    // Simulation d'un délai de traitement
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('Analyse de structure terminée, réception des résultats...');
    
    // Exemple de mappings que l'API Mistral pourrait retourner
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
        mapping: "educateur.nom",
      },
      {
        champ_pdf: "Prénom de l'éducateur (Équipe A)",
        type: "educateur",
        mapping: "educateur.prenom",
      },
      {
        champ_pdf: "Nom du joueur (Équipe A)",
        type: "joueur",
        mapping: "joueur.nom",
        valeur_possible: ["MARTIN", "PETIT", "DUBOIS"]
      },
      {
        champ_pdf: "Prénom du joueur (Équipe A)",
        type: "joueur",
        mapping: "joueur.prenom",
        valeur_possible: ["Thomas", "Lucas", "Nathan"]
      },
      {
        champ_pdf: "Licence joueur (Équipe A)",
        type: "joueur",
        mapping: "joueur.licence",
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
        mapping: "educateur.nom",
      },
      {
        champ_pdf: "Prénom de l'éducateur (Équipe B)",
        type: "educateur",
        mapping: "educateur.prenom",
      },
      {
        champ_pdf: "Nom du joueur (Équipe B)",
        type: "joueur",
        mapping: "joueur.nom",
        valeur_possible: ["BERNARD", "DURAND", "MOREAU"]
      },
      {
        champ_pdf: "Prénom du joueur (Équipe B)",
        type: "joueur",
        mapping: "joueur.prenom",
        valeur_possible: ["Hugo", "Louis", "Jules"]
      },
      {
        champ_pdf: "Licence joueur (Équipe B)",
        type: "joueur",
        mapping: "joueur.licence",
        valeur_possible: ["4567890", "5678901", "6789012"]
      }
    ];
    
    return mappings;
    
  } catch (error) {
    console.error('Erreur lors de l\'analyse de la structure du PDF avec Mistral:', error);
    throw new Error(`Échec de l'analyse de la structure: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Implémentation réelle de l'appel à l'API Mistral (désactivée pour la démo)
 */
async function callMistralApi(prompt: string): Promise<string> {
  try {
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: 'Vous êtes un assistant spécialisé dans l\'analyse de documents PDF et la détection de champs de formulaire.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Erreur API Mistral: ${errorData.error?.message || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API Mistral:', error);
    throw error;
  }
}