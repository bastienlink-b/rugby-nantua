import { PDFDocument, rgb, StandardFonts, PDFForm, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { Tournament, Player, Coach, Template, PdfFieldMapping } from '../types';
import { getPdf } from './PdfStorage';
import { cleanPdfFormFields } from './PdfStorage';

interface GeneratePdfOptions {
  templateId: string;
  tournamentId: string;
  players: Player[];
  coaches: Coach[];
  referentCoachId: string;
  template: Template;
  tournament: Tournament;
}

interface PdfData {
  nom_manifestation?: string;
  date_manifestation?: string;
  lieu_manifestation?: string;
  categorie?: string;
  club?: string;
  joueurs: {
    nom: string;
    prenom: string;
    licence: string;
    est_avant?: boolean;
    est_arbitre?: boolean;
  }[];
  educateurs: {
    nom: string;
    prenom: string;
    licence: string;
    diplome?: string;
    est_referent?: boolean;
  }[];
}

/**
 * Génère un PDF rempli avec les données fournies
 * @param options Options pour la génération du PDF
 * @returns PDF généré au format Uint8Array
 */
export const generatePdf = async (options: GeneratePdfOptions): Promise<Uint8Array> => {
  const { templateId, players, coaches, referentCoachId, template, tournament } = options;

  // Extraction du nom du fichier à partir de l'URL du template
  const templateFileName = template.fileUrl.split('/').pop();
  
  if (!templateFileName) {
    throw new Error('Nom de fichier du template non valide');
  }

  console.log(`Génération du PDF pour ${templateFileName}`);

  // Récupération du contenu du PDF depuis le stockage local ou Supabase
  const pdfContent = await getPdf(templateFileName);
  
  if (!pdfContent) {
    throw new Error('Fichier PDF non trouvé');
  }

  // Extraction de la partie base64 (après la virgule)
  const base64Data = pdfContent.includes('base64,') ? pdfContent.split(',')[1] : pdfContent;
  const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // Chargement du PDF
  const pdfDoc = await PDFDocument.load(pdfBytes);
  
  // Vérifier si le PDF a un formulaire
  const form = pdfDoc.getForm();
  const fields = form.getFields();

  console.log(`Le PDF contient ${fields.length} champs de formulaire`);
  
  // Log détaillé des champs trouvés
  console.log('Champs détectés dans le PDF:');
  fields.forEach(field => {
    console.log(`- ${field.getName()} (${field.constructor.name})`);
  });
  
  // Préparation des données à insérer dans le PDF
  const data: PdfData = {
    nom_manifestation: tournament.location,
    date_manifestation: new Date(tournament.date).toLocaleDateString('fr-FR'),
    lieu_manifestation: tournament.location,
    categorie: 'M14', // Ideally this should come from the age category
    club: 'US Nantua Rugby',
    joueurs: players.map(player => ({
      nom: player.lastName,
      prenom: player.firstName,
      licence: player.licenseNumber,
      est_avant: player.canPlayForward,
      est_arbitre: player.canReferee
    })),
    educateurs: coaches.map(coach => ({
      nom: coach.lastName,
      prenom: coach.firstName,
      licence: coach.licenseNumber || '',
      diplome: coach.diploma,
      est_referent: coach.id === referentCoachId
    }))
  };

  console.log("Données préparées pour le remplissage du PDF:", JSON.stringify(data, null, 2));

  if (fields.length > 0) {
    console.log("PDF avec formulaire détecté, remplissage des champs...");
    
    fillFormFields(form, data, template.fieldMappings || []);
    
    // Vérification post-remplissage
    console.log("Vérification des champs après remplissage:");
    fields.forEach(field => {
      if (field.constructor.name === 'PDFTextField') {
        try {
          const value = form.getTextField(field.getName()).getText();
          console.log(`- ${field.getName()}: "${value}"`);
        } catch (e) {
          console.warn(`Erreur lors de la lecture du champ ${field.getName()}:`, e);
        }
      }
    });
    
    // Aplatir le formulaire pour rendre les modifications permanentes
    try {
      console.log("Aplatissement du formulaire PDF...");
      form.flatten();
      console.log("Formulaire aplati avec succès");
    } catch (error) {
      console.warn("Erreur lors de l'aplatissement du formulaire:", error);
    }
  }

  // Enregistrement du PDF modifié
  console.log("Enregistrement du PDF modifié...");
  const modifiedPdfBytes = await pdfDoc.save();
  console.log("PDF modifié enregistré avec succès.");
  
  return modifiedPdfBytes;
};

/**
 * Remplit les champs d'un formulaire PDF avec les données fournies
 * @param form Formulaire PDF
 * @param data Données à insérer
 * @param fieldMappings Mappings des champs (optionnel)
 */
const fillFormFields = (form: PDFForm, data: PdfData, fieldMappings: PdfFieldMapping[]) => {
  // Loggez les noms de tous les champs pour le débogage
  const fieldNames = form.getFields().map(field => field.getName());
  console.log("Champs disponibles dans le formulaire:", fieldNames);
  
  try {
    // Si des mappings sont fournis, les utiliser pour remplir les champs
    if (fieldMappings.length > 0) {
      console.log("Utilisation des mappings de champs pour le remplissage");
      
      // Mappings pour les champs globaux
      fieldMappings
        .filter(mapping => mapping.type === 'global')
        .forEach(mapping => {
          try {
            console.log(`Traitement du mapping global: ${mapping.champ_pdf} -> ${mapping.mapping}`);
            const value = getValueFromMapping(mapping.mapping, data);
            if (value !== null && value !== undefined) {
              console.log(`  Valeur trouvée: "${value}", tentative de remplissage du champ "${mapping.champ_pdf}"`);
              fillField(form, mapping.champ_pdf, value);
              
              // Essayez aussi des variantes communes du nom de champ
              tryFillVariantFieldNames(form, mapping.champ_pdf, value);
            } else {
              console.log(`  Aucune valeur trouvée pour le mapping "${mapping.mapping}"`);
            }
          } catch (error) {
            console.warn(`Erreur lors du remplissage du champ ${mapping.champ_pdf}:`, error);
          }
        });
      
      // Mappings pour les joueurs
      data.joueurs.forEach((joueur, index) => {
        fieldMappings
          .filter(mapping => mapping.type === 'joueur')
          .forEach(mapping => {
            try {
              let value = null;
              console.log(`Traitement du mapping joueur: ${mapping.champ_pdf} -> ${mapping.mapping} pour le joueur ${index+1}`);
              
              if (mapping.mapping.includes('nom')) value = joueur.nom;
              else if (mapping.mapping.includes('prenom')) value = joueur.prenom;
              else if (mapping.mapping.includes('licence')) value = joueur.licence;
              else if (mapping.mapping.includes('avant')) value = joueur.est_avant;
              else if (mapping.mapping.includes('arbitre')) value = joueur.est_arbitre;
              
              if (value !== null && value !== undefined) {
                // Remplacer [n] ou {n} ou n par l'index du joueur
                const patterns = [
                  { regex: /\[n\]/, replace: `[${index + 1}]` },
                  { regex: /\{n\}/, replace: `{${index + 1}}` },
                  { regex: /^(.*?)n$/, replace: `$1${index + 1}` },
                  { regex: /^(.*?)n(.*)$/, replace: `$1${index + 1}$2` }
                ];
                
                for (const pattern of patterns) {
                  const fieldName = mapping.champ_pdf.replace(pattern.regex, pattern.replace);
                  if (fieldName !== mapping.champ_pdf) {
                    console.log(`  Tentative avec le champ "${fieldName}" pour la valeur "${value}"`);
                    fillField(form, fieldName, value);
                  }
                }
                
                // Essayer aussi un format avec numéro à la fin
                const indexFieldName = `${mapping.champ_pdf}${index + 1}`;
                console.log(`  Tentative avec le champ "${indexFieldName}" pour la valeur "${value}"`);
                fillField(form, indexFieldName, value);
              }
            } catch (error) {
              console.warn(`Erreur lors du remplissage du champ joueur ${mapping.champ_pdf}:`, error);
            }
          });
      });
      
      // Mappings pour les éducateurs
      data.educateurs.forEach((educateur, index) => {
        fieldMappings
          .filter(mapping => mapping.type === 'educateur')
          .forEach(mapping => {
            try {
              let value = null;
              console.log(`Traitement du mapping éducateur: ${mapping.champ_pdf} -> ${mapping.mapping} pour l'éducateur ${index+1}`);
              
              if (mapping.mapping.includes('nom')) value = educateur.nom;
              else if (mapping.mapping.includes('prenom')) value = educateur.prenom;
              else if (mapping.mapping.includes('licence')) value = educateur.licence;
              else if (mapping.mapping.includes('diplome')) value = educateur.diplome;
              else if (mapping.mapping.includes('referent')) value = educateur.est_referent;
              
              if (value !== null && value !== undefined) {
                // Remplacer [n] ou {n} ou n par l'index de l'éducateur
                const patterns = [
                  { regex: /\[n\]/, replace: `[${index + 1}]` },
                  { regex: /\{n\}/, replace: `{${index + 1}}` },
                  { regex: /^(.*?)n$/, replace: `$1${index + 1}` },
                  { regex: /^(.*?)n(.*)$/, replace: `$1${index + 1}$2` }
                ];
                
                for (const pattern of patterns) {
                  const fieldName = mapping.champ_pdf.replace(pattern.regex, pattern.replace);
                  if (fieldName !== mapping.champ_pdf) {
                    console.log(`  Tentative avec le champ "${fieldName}" pour la valeur "${value}"`);
                    fillField(form, fieldName, value);
                  }
                }
                
                // Essayer aussi un format avec numéro à la fin
                const indexFieldName = `${mapping.champ_pdf}${index + 1}`;
                console.log(`  Tentative avec le champ "${indexFieldName}" pour la valeur "${value}"`);
                fillField(form, indexFieldName, value);
                
                // Essayer les variantes du nom de champ
                tryFillVariantFieldNames(form, indexFieldName, value);
              }
            } catch (error) {
              console.warn(`Erreur lors du remplissage du champ éducateur ${mapping.champ_pdf}:`, error);
            }
          });
      });
      
    } else {
      // Si aucun mapping n'est fourni, essayer de détecter et remplir les champs communs
      console.log("Aucun mapping fourni, tentative de remplissage automatique des champs communs");
      autoFillFormFields(form, data);
    }
  } catch (error) {
    console.error("Erreur lors du remplissage du formulaire:", error);
  }
};

/**
 * Tente de remplir des variations du nom de champ avec la même valeur
 */
const tryFillVariantFieldNames = (form: PDFForm, baseFieldName: string, value: any) => {
  // Liste des variantes communes de noms de champs
  const variants = [
    // Variations avec case différente
    baseFieldName.toLowerCase(),
    baseFieldName.toUpperCase(),
    baseFieldName.charAt(0).toUpperCase() + baseFieldName.slice(1),
    
    // Variations avec underscore ou tiret
    baseFieldName.replace(/\s+/g, '_'),
    baseFieldName.replace(/\s+/g, '-'),
    baseFieldName.replace(/_/g, ''),
    baseFieldName.replace(/-/g, ''),
    
    // Variations avec préfixes/suffixes communs
    `form_${baseFieldName}`,
    `field_${baseFieldName}`,
    `${baseFieldName}_field`,
    `txt${baseFieldName}`,
    
    // Autres variations courantes dans les PDFs
    `fld${baseFieldName}`,
    `f${baseFieldName}`,
    `${baseFieldName.replace(/[^a-zA-Z0-9]/g, "")}` // Supprime tous les caractères spéciaux
  ];
  
  // Essayer de remplir chaque variante
  variants.forEach(variant => {
    if (variant !== baseFieldName) {
      try {
        fillField(form, variant, value);
      } catch (e) {
        // Ignore les erreurs pour les variantes
      }
    }
  });
};

/**
 * Remplit un champ de formulaire avec une valeur donnée
 * @param form Formulaire PDF
 * @param fieldName Nom du champ
 * @param value Valeur à insérer
 */
const fillField = (form: PDFForm, fieldName: string, value: any) => {
  try {
    // Vérifier si le champ existe
    const field = form.getFields().find(f => f.getName() === fieldName);
    if (!field) {
      console.log(`Champ "${fieldName}" non trouvé dans le formulaire`);
      return;
    }

    console.log(`Tentative de remplissage du champ "${fieldName}" avec la valeur:`, value);

    // Gérer différents types de champs
    if (field.constructor.name === 'PDFTextField') {
      const textValue = typeof value === 'boolean' 
        ? (value ? 'Oui' : 'Non')
        : String(value);
      const textField = form.getTextField(fieldName);
      textField.setText(textValue);
      textField.setFontSize(11);
      console.log(`✓ Champ texte ${fieldName} rempli avec: "${textValue}"`);
    } else if (field.constructor.name === 'PDFCheckBox') {
      if (typeof value === 'boolean') {
        if (value) {
          const checkbox = form.getCheckBox(fieldName);
          checkbox.check();
        } else {
          const checkbox = form.getCheckBox(fieldName);
          checkbox.uncheck();
        }
      } else if (typeof value === 'string') {
        const boolValue = value.toLowerCase() === 'true' || value.toLowerCase() === 'oui';
        if (boolValue) {
          const checkbox = form.getCheckBox(fieldName);
          checkbox.check();
        } else {
          const checkbox = form.getCheckBox(fieldName);
          checkbox.uncheck();
        }
      }
      console.log(`✓ Case à cocher ${fieldName} définie à: ${!!value}`);
    }
  } catch (error) {
    console.warn(`Erreur lors du remplissage du champ ${fieldName}:`, error);
  }
};

/**
 * Remplit automatiquement les champs du formulaire en se basant sur les noms communs
 */
const autoFillFormFields = (form: PDFForm, data: PdfData) => {
  console.log("Tentative de remplissage automatique des champs");
  
  // Mappings communs pour les champs globaux
  const commonMappings = [
    { field: 'nom_manifestation', value: data.nom_manifestation },
    { field: 'date_manifestation', value: data.date_manifestation },
    { field: 'lieu_manifestation', value: data.lieu_manifestation },
    { field: 'categorie', value: data.categorie },
    { field: 'club', value: data.club }
  ];

  // Remplir les champs globaux
  commonMappings.forEach(mapping => {
    if (mapping.value) {
      fillField(form, mapping.field, mapping.value);
      tryFillVariantFieldNames(form, mapping.field, mapping.value);
    }
  });

  // Remplir les champs des joueurs
  data.joueurs.forEach((joueur, index) => {
    const playerFields = [
      { suffix: 'nom', value: joueur.nom },
      { suffix: 'prenom', value: joueur.prenom },
      { suffix: 'licence', value: joueur.licence },
      { suffix: 'avant', value: joueur.est_avant },
      { suffix: 'arbitre', value: joueur.est_arbitre }
    ];

    playerFields.forEach(field => {
      if (field.value !== undefined) {
        const fieldName = `joueur${index + 1}_${field.suffix}`;
        fillField(form, fieldName, field.value);
        tryFillVariantFieldNames(form, fieldName, field.value);
      }
    });
  });

  // Remplir les champs des éducateurs
  data.educateurs.forEach((educateur, index) => {
    const coachFields = [
      { suffix: 'nom', value: educateur.nom },
      { suffix: 'prenom', value: educateur.prenom },
      { suffix: 'licence', value: educateur.licence },
      { suffix: 'diplome', value: educateur.diplome },
      { suffix: 'referent', value: educateur.est_referent }
    ];

    coachFields.forEach(field => {
      if (field.value !== undefined) {
        const fieldName = `educateur${index + 1}_${field.suffix}`;
        fillField(form, fieldName, field.value);
        tryFillVariantFieldNames(form, fieldName, field.value);
      }
    });
  });
};

/**
 * Récupère une valeur à partir d'un mapping et des données
 */
const getValueFromMapping = (mapping: string, data: PdfData): any => {
  const parts = mapping.split('.');
  let value: any = data;
  
  for (const part of parts) {
    if (value === undefined || value === null) return null;
    value = value[part];
  }
  
  return value;
};