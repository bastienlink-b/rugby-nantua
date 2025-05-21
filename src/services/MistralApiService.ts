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
 * Extracts text from a PDF file and uses Mistral AI to help with extraction
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
    
    // Get the Mistral API key
    const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
    
    if (!MISTRAL_API_KEY) {
      throw new Error('Clé API Mistral non définie. Veuillez définir VITE_MISTRAL_API_KEY dans votre fichier .env');
    }
    
    console.log('Envoi de la requête à l\'API Mistral pour l\'extraction de texte...');
    
    const extractedText = await callMistralApi(`
      Voici le contenu d'un PDF encodé en base64 (tronqué).
      Extrais tout le texte visible de ce PDF, en préservant autant que possible la structure.
      
      Base64 du PDF: ${pdfContent.substring(0, 5000)}... (tronqué)
    `, MISTRAL_API_KEY);
    
    console.log('Texte extrait avec succès du PDF');
    
    return extractedText;
    
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
    
    // Get the Mistral API key
    const MISTRAL_API_KEY = import.meta.env.VITE_MISTRAL_API_KEY;
    
    if (!MISTRAL_API_KEY) {
      throw new Error('Clé API Mistral non définie. Veuillez définir VITE_MISTRAL_API_KEY dans votre fichier .env');
    }
    
    console.log('Envoi de la requête à l\'API Mistral pour l\'analyse de structure...');
    
    const analysisResponse = await callMistralApi(prompt, MISTRAL_API_KEY);
    
    console.log('Analyse de structure terminée, traitement des résultats...');
    
    // Extraire le JSON de la réponse
    let jsonResponse: PdfFieldMapping[];
    
    try {
      // Tenter de parser directement la réponse
      jsonResponse = JSON.parse(analysisResponse);
    } catch (parseError) {
      // Si le JSON n'est pas directement parsable, essayer d'extraire le bloc JSON
      const jsonMatch = analysisResponse.match(/\[\s*{[\s\S]*}\s*\]/);
      if (jsonMatch) {
        try {
          jsonResponse = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          console.error('Erreur lors du parsing du JSON extrait:', innerError);
          throw new Error('Format de réponse de l\'API non valide');
        }
      } else {
        console.error('Pas de JSON trouvé dans la réponse de l\'API:', analysisResponse);
        throw new Error('Pas de JSON trouvé dans la réponse de l\'API');
      }
    }
    
    // Vérifier que nous avons un tableau
    if (!Array.isArray(jsonResponse)) {
      throw new Error('La réponse de l\'API n\'est pas un tableau');
    }
    
    // Vérifier la validité des mappings
    const validMappings = jsonResponse.filter(mapping => 
      mapping.champ_pdf && 
      mapping.type && 
      ['joueur', 'educateur', 'global', 'autre'].includes(mapping.type) && 
      mapping.mapping
    );
    
    if (validMappings.length === 0) {
      throw new Error('Aucun mapping valide trouvé dans la réponse de l\'API');
    }
    
    console.log(`${validMappings.length} mappings valides trouvés dans l'analyse`);
    
    return validMappings;
    
  } catch (error) {
    console.error('Erreur lors de l\'analyse de la structure du PDF avec Mistral:', error);
    throw new Error(`Échec de l'analyse de la structure: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Implémentation de l'appel à l'API Mistral
 */
async function callMistralApi(prompt: string, apiKey: string): Promise<string> {
  try {
    console.log('Appel à l\'API Mistral en cours...');
    
    const response = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
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
      throw new Error(`Erreur API Mistral: ${errorData.error?.message || response.statusText || 'Erreur inconnue'}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0 || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Format de réponse Mistral inattendu');
    }
    
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Erreur lors de l\'appel à l\'API Mistral:', error);
    throw error;
  }
}