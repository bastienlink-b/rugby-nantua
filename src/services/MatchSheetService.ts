import { PDFDocument } from 'pdf-lib';
import { Player, Coach, Tournament, Template } from '../types';

/**
 * Service pour la gestion des feuilles de match 
 * et l'interaction avec les PDF de modèles
 */

/**
 * Vérifie si un PDF contient des champs de formulaire
 * @param pdfData Contenu du PDF en base64
 * @returns Promise<boolean> True si le PDF contient des champs de formulaire
 */
export const checkForFormFields = async (pdfData: string): Promise<{ hasFormFields: boolean, fieldNames: string[] }> => {
  try {
    // Si les données PDF sont en base64, les traiter correctement
    let pdfContent = pdfData;
    if (pdfData.startsWith('data:application/pdf;base64,')) {
      pdfContent = pdfData.split('base64,')[1];
    }
    
    // Convertir le base64 en Uint8Array
    const pdfBytes = Uint8Array.from(atob(pdfContent), c => c.charCodeAt(0));
    
    // Charger le PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Récupérer le formulaire et ses champs
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const fieldNames = fields.map(field => field.getName());
    
    console.log(`Le PDF contient ${fields.length} champs de formulaire:`, fieldNames);
    
    return { 
      hasFormFields: fields.length > 0,
      fieldNames 
    };
  } catch (error) {
    console.error('Erreur lors de la vérification des champs de formulaire:', error);
    return { 
      hasFormFields: false,
      fieldNames: [] 
    };
  }
};

/**
 * Extrait les informations sur les champs de formulaire d'un PDF
 * @param pdfData Contenu du PDF en base64
 * @returns Objet contenant les détails des champs de formulaire
 */
export const extractFormFieldsInfo = async (pdfData: string): Promise<{ 
  fields: { name: string, type: string, value?: string, options?: string[] }[] 
}> => {
  try {
    // Si les données PDF sont en base64, les traiter correctement
    let pdfContent = pdfData;
    if (pdfData.startsWith('data:application/pdf;base64,')) {
      pdfContent = pdfData.split('base64,')[1];
    }
    
    // Convertir le base64 en Uint8Array
    const pdfBytes = Uint8Array.from(atob(pdfContent), c => c.charCodeAt(0));
    
    // Charger le PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Récupérer le formulaire et ses champs
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    // Extraire les informations sur chaque champ
    const fieldsInfo = fields.map(field => {
      const fieldInfo: { 
        name: string, 
        type: string, 
        value?: string, 
        options?: string[] 
      } = {
        name: field.getName(),
        type: field.constructor.name
      };
      
      // Essayer d'obtenir la valeur actuelle et les options si disponibles
      try {
        if (field.constructor.name === 'PDFTextField') {
          const textField = form.getTextField(field.getName());
          fieldInfo.value = textField.getText();
        } else if (field.constructor.name === 'PDFDropdown') {
          const dropdown = form.getDropdown(field.getName());
          fieldInfo.options = dropdown.getOptions();
          fieldInfo.value = dropdown.getSelected()[0] || '';
        } else if (field.constructor.name === 'PDFRadioGroup') {
          const radioGroup = form.getRadioGroup(field.getName());
          fieldInfo.options = radioGroup.getOptions();
          fieldInfo.value = radioGroup.getSelected();
        } else if (field.constructor.name === 'PDFCheckBox') {
          const checkbox = form.getCheckBox(field.getName());
          fieldInfo.value = checkbox.isChecked() ? 'checked' : 'unchecked';
        }
      } catch (e) {
        console.warn(`Erreur lors de la récupération des informations du champ ${field.getName()}:`, e);
      }
      
      return fieldInfo;
    });
    
    console.log(`Informations extraites pour ${fieldsInfo.length} champs de formulaire`);
    
    return { fields: fieldsInfo };
  } catch (error) {
    console.error('Erreur lors de l\'extraction des informations des champs de formulaire:', error);
    return { fields: [] };
  }
};

/**
 * Prépare les données pour le remplissage d'un PDF de feuille de match
 * @param tournament Tournoi sélectionné 
 * @param players Joueurs sélectionnés
 * @param coaches Entraîneurs sélectionnés
 * @param referentCoachId ID de l'entraîneur référent
 * @returns Objet structuré avec toutes les données pour le PDF
 */
export const prepareMatchSheetData = (
  tournament: Tournament,
  players: Player[],
  coaches: Coach[],
  referentCoachId: string,
  template: Template
): any => {
  // Construire l'objet de données avec toutes les informations
  const matchSheetData = {
    // Informations globales
    tournoi: {
      nom: tournament.location,
      date: new Date(tournament.date).toLocaleDateString('fr-FR'),
      lieu: tournament.location
    },
    club: 'US Nantua Rugby',
    
    // Joueurs avec toutes leurs informations
    joueurs: players.map(player => ({
      nom: player.lastName,
      prenom: player.firstName,
      dateNaissance: new Date(player.dateOfBirth).toLocaleDateString('fr-FR'),
      licence: player.licenseNumber,
      peutJouerAvant: player.canPlayForward,
      peutArbitrer: player.canReferee
    })),
    
    // Éducateurs avec toutes leurs informations
    educateurs: coaches.map(coach => ({
      nom: coach.lastName,
      prenom: coach.firstName,
      licence: coach.licenseNumber,
      diplome: coach.diploma,
      estReferent: coach.id === referentCoachId
    })),
    
    // Informations supplémentaires
    nombreJoueurs: players.length,
    nombreEducateurs: coaches.length,
    nombreAvants: players.filter(p => p.canPlayForward).length,
    nombreArbitres: players.filter(p => p.canReferee).length,
    
    // Référent (éducateur principal)
    referent: coaches.find(c => c.id === referentCoachId)
  };
  
  console.log('Données de la feuille de match préparées:', matchSheetData);
  
  return matchSheetData;
};

/**
 * Valide qu'une feuille de match a toutes les données requises
 * @param tournament Tournoi sélectionné
 * @param templateId ID du template
 * @param ageCategoryId ID de la catégorie d'âge
 * @param players Joueurs sélectionnés
 * @param coaches Entraîneurs sélectionnés
 * @param referentCoachId ID de l'entraîneur référent
 * @returns Objet indiquant la validité et les éventuels problèmes
 */
export const validateMatchSheet = (
  tournament: Tournament | undefined,
  templateId: string,
  ageCategoryId: string,
  players: Player[],
  coaches: Coach[],
  referentCoachId: string
): { isValid: boolean, errors: string[] } => {
  const errors: string[] = [];
  
  // Vérifier que toutes les données essentielles sont présentes
  if (!tournament) {
    errors.push('Aucun tournoi sélectionné');
  }
  
  if (!templateId) {
    errors.push('Aucun modèle de feuille sélectionné');
  }
  
  if (!ageCategoryId) {
    errors.push("Aucune catégorie d'âge sélectionnée");
  }
  
  if (players.length === 0) {
    errors.push('Aucun joueur sélectionné');
  }
  
  if (coaches.length === 0) {
    errors.push('Aucun entraîneur sélectionné');
  }
  
  if (!referentCoachId) {
    errors.push('Aucun entraîneur référent sélectionné');
  }
  
  // Vérifier la cohérence des données
  if (referentCoachId && !coaches.some(c => c.id === referentCoachId)) {
    errors.push("L'entraîneur référent doit faire partie des entraîneurs sélectionnés");
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};