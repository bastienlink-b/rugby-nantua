import { PDFDocument, rgb, StandardFonts, PDFForm, PDFTextField, PDFCheckBox } from 'pdf-lib';
import { Tournament, Player, Coach, Template, PdfFieldMapping } from '../types';
import { getPdf } from './PdfStorage';

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

  console.log(`Chargement du modèle PDF: ${templateFileName}`);

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

  if (fields.length > 0) {
    // Si le PDF a des champs de formulaire, remplir ces champs
    console.log("PDF avec formulaire détecté, remplissage des champs...");
    
    // Afficher tous les noms de champs pour le débogage
    console.log("Noms des champs de formulaire détectés:");
    fields.forEach(field => {
      console.log(`- ${field.getName()} (${field.constructor.name})`);
    });
    
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
  } else {
    console.log("Aucun champ de formulaire détecté, dessin du texte sur le PDF...");
    
    // Si le template contient des mappings de champs, les utiliser pour positionner le texte
    if (template.fieldMappings && template.fieldMappings.length > 0) {
      console.log(`Utilisation de ${template.fieldMappings.length} mappings de champs pour le positionnement du texte`);
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      applyFieldMappings(pages, helveticaFont, data, template.fieldMappings);
    } else {
      // Fallback: utilisation de positions par défaut si aucun mapping n'est défini
      console.log("Aucun mapping défini, utilisation de positions par défaut");
      const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      applyDefaultPositions(pages[0], helveticaFont, data);
    }
  }

  // Aplatir le formulaire pour rendre les champs remplis non modifiables
  try {
    form.flatten();
    console.log("Formulaire aplati avec succès");
  } catch (e) {
    console.warn("Erreur lors de l'aplatissement du formulaire:", e);
  }

  // Enregistrement du PDF modifié
  return pdfDoc.save();
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
    `txt${baseFieldName}`
  ];
  
  // Essayer de remplir chaque variante
  variants.forEach(variant => {
    if (variant !== baseFieldName) {
      fillField(form, variant, value);
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
      // Pas d'erreur log si le champ n'existe pas, c'est normal dans notre approche d'essayer différentes variations
      return;
    }

    // Gérer différents types de champs
    if (field.constructor.name === 'PDFTextField') {
      const textValue = typeof value === 'boolean' 
        ? (value ? 'Oui' : 'Non')
        : String(value);
      form.getTextField(fieldName).setText(textValue);
      console.log(`✓ Champ texte ${fieldName} rempli avec: "${textValue}"`);
    } else if (field.constructor.name === 'PDFCheckBox') {
      if (typeof value === 'boolean') {
        if (value) {
          form.getCheckBox(fieldName).check();
        } else {
          form.getCheckBox(fieldName).uncheck();
        }
      } else if (typeof value === 'string') {
        const boolValue = value.toLowerCase() === 'true' || value.toLowerCase() === 'oui';
        if (boolValue) {
          form.getCheckBox(fieldName).check();
        } else {
          form.getCheckBox(fieldName).uncheck();
        }
      }
      console.log(`✓ Case à cocher ${fieldName} définie à: ${!!value}`);
    } else if (field.constructor.name === 'PDFDropdown') {
      const dropdownField = form.getDropdown(fieldName);
      const options = dropdownField.getOptions();
      const stringValue = String(value);
      
      if (options.includes(stringValue)) {
        dropdownField.select(stringValue);
        console.log(`✓ Liste déroulante ${fieldName} définie à: "${stringValue}"`);
      } else {
        console.warn(`Valeur "${value}" non trouvée dans les options de la liste déroulante ${fieldName}`);
      }
    } else if (field.constructor.name === 'PDFRadioGroup') {
      try {
        const radioGroup = form.getRadioGroup(fieldName);
        const options = radioGroup.getOptions();
        const stringValue = String(value);
        
        if (options.includes(stringValue)) {
          radioGroup.select(stringValue);
          console.log(`✓ Groupe radio ${fieldName} défini à: "${stringValue}"`);
        } else if (typeof value === 'boolean' && value === true) {
          // Si c'est un booléen true, sélectionnez la première option
          if (options.length > 0) {
            radioGroup.select(options[0]);
            console.log(`✓ Groupe radio ${fieldName} défini à la première option: "${options[0]}"`);
          }
        }
      } catch (e) {
        console.warn(`Erreur avec le groupe radio ${fieldName}:`, e);
      }
    } else {
      console.warn(`Type de champ non supporté pour ${fieldName}: ${field.constructor.name}`);
    }
  } catch (error) {
    console.warn(`Erreur lors du remplissage du champ ${fieldName}:`, error);
  }
};

/**
 * Tente automatiquement de remplir les champs communs d'un formulaire PDF
 * @param form Formulaire PDF
 * @param data Données à insérer
 */
const autoFillFormFields = (form: PDFForm, data: PdfData) => {
  const fields = form.getFields();
  console.log("Tentative de remplissage automatique avec les données suivantes:", data);
  
  // Tableau de correspondances entre les noms de champs communs et leurs valeurs
  const fieldMappings: Record<string, any[]> = {
    // Informations sur le tournoi
    'tournoi': [data.nom_manifestation, ['nom', 'tournoi', 'tournament', 'evenement', 'event']],
    'manifestation': [data.nom_manifestation, ['nom', 'manifestation']],
    'evenement': [data.nom_manifestation, ['nom', 'evenement', 'event']],
    'date': [data.date_manifestation, ['date', 'jour', 'day']],
    'lieu': [data.lieu_manifestation, ['lieu', 'location', 'place', 'site']],
    
    // Informations sur le club
    'club': [data.club, ['club', 'equipe', 'team']],
    'categorie': [data.categorie, ['categorie', 'category', 'age', 'classe']],
    
    // Référent
    'referent': [data.educateurs.find(e => e.est_referent)?.nom, ['responsable', 'referent', 'principal']],
  };
  
  // Essayer de remplir tous les champs en fonction des correspondances
  fields.forEach(field => {
    const fieldName = field.getName().toLowerCase();
    
    // Parcourir toutes les correspondances possibles
    Object.entries(fieldMappings).forEach(([key, [value, keywords]]) => {
      if (value) {
        // Vérifier si le nom du champ contient l'un des mots-clés
        if (keywords.some(keyword => fieldName.includes(keyword))) {
          try {
            fillField(form, field.getName(), value);
          } catch (error) {
            console.warn(`Erreur lors du remplissage automatique du champ ${fieldName}:`, error);
          }
        }
      }
    });
    
    // Traitement spécial pour les joueurs
    if (fieldName.includes('joueur') || fieldName.includes('player')) {
      tryFillPlayerField(form, field, data.joueurs);
    }
    
    // Traitement spécial pour les entraîneurs
    if (fieldName.includes('educateur') || 
        fieldName.includes('entraineur') || 
        fieldName.includes('coach')) {
      tryFillCoachField(form, field, data.educateurs);
    }
  });
  
  // Essai agressif de remplissage de champs par position numérique
  tryNumericPositionFill(form, data);
};

/**
 * Essaie de remplir les champs en fonction de leur position numérique
 * Par exemple: champ1, champ2, etc.
 */
const tryNumericPositionFill = (form: PDFForm, data: PdfData) => {
  const fields = form.getFields();
  const fieldNames = fields.map(f => f.getName());
  
  // Recherche des patterns de noms de champs numériques
  const patterns = [
    /^(.+?)(\d+)$/, // Forme: "champ1", "champ2", etc.
    /^(.+?)\[(\d+)\]$/, // Forme: "champ[1]", "champ[2]", etc.
    /^(.+?)_(\d+)$/ // Forme: "champ_1", "champ_2", etc.
  ];
  
  // Grouper les champs par préfixe et numéro
  const groupedFields: Record<string, Record<string, string>> = {};
  
  fieldNames.forEach(name => {
    for (const pattern of patterns) {
      const match = name.match(pattern);
      if (match) {
        const [_, prefix, indexStr] = match;
        const index = parseInt(indexStr, 10);
        
        if (!groupedFields[prefix]) {
          groupedFields[prefix] = {};
        }
        
        groupedFields[prefix][index] = name;
        break;
      }
    }
  });
  
  // Remplir les champs par groupes
  Object.entries(groupedFields).forEach(([prefix, indexedFields]) => {
    const lowerPrefix = prefix.toLowerCase();
    
    // Détecter le type de données par le préfixe
    const isPlayerName = lowerPrefix.includes('joueur') || 
                         lowerPrefix.includes('player') || 
                         lowerPrefix.includes('nom');
                         
    const isPlayerFirstName = lowerPrefix.includes('prenom') || lowerPrefix.includes('firstname');
    
    const isLicense = lowerPrefix.includes('licence') || 
                      lowerPrefix.includes('license') || 
                      lowerPrefix.includes('numero');
    
    const isCoach = lowerPrefix.includes('educateur') || 
                    lowerPrefix.includes('entraineur') || 
                    lowerPrefix.includes('coach');
    
    // Remplir selon le type détecté
    if (isPlayerName) {
      Object.entries(indexedFields).forEach(([indexStr, fieldName]) => {
        const index = parseInt(indexStr, 10) - 1;
        if (index >= 0 && index < data.joueurs.length) {
          fillField(form, fieldName, data.joueurs[index].nom);
        }
      });
    } else if (isPlayerFirstName) {
      Object.entries(indexedFields).forEach(([indexStr, fieldName]) => {
        const index = parseInt(indexStr, 10) - 1;
        if (index >= 0 && index < data.joueurs.length) {
          fillField(form, fieldName, data.joueurs[index].prenom);
        }
      });
    } else if (isLicense) {
      Object.entries(indexedFields).forEach(([indexStr, fieldName]) => {
        const index = parseInt(indexStr, 10) - 1;
        if (index >= 0 && index < data.joueurs.length) {
          fillField(form, fieldName, data.joueurs[index].licence);
        }
      });
    } else if (isCoach) {
      Object.entries(indexedFields).forEach(([indexStr, fieldName]) => {
        const index = parseInt(indexStr, 10) - 1;
        if (index >= 0 && index < data.educateurs.length) {
          // Déterminer quelle information de l'éducateur utiliser
          if (lowerPrefix.includes('nom')) {
            fillField(form, fieldName, data.educateurs[index].nom);
          } else if (lowerPrefix.includes('prenom')) {
            fillField(form, fieldName, data.educateurs[index].prenom);
          } else if (lowerPrefix.includes('licence')) {
            fillField(form, fieldName, data.educateurs[index].licence);
          } else if (lowerPrefix.includes('diplome')) {
            fillField(form, fieldName, data.educateurs[index].diplome);
          } else {
            // Par défaut, utiliser le nom complet
            fillField(form, fieldName, `${data.educateurs[index].prenom} ${data.educateurs[index].nom}`);
          }
        }
      });
    }
  });
};

/**
 * Tente de remplir un champ de joueur en fonction de son nom
 */
const tryFillPlayerField = (form: PDFForm, field: PDFField, players: PdfData['joueurs']) => {
  const fieldName = field.getName().toLowerCase();
  
  // Extraire l'index du joueur du nom du champ s'il est présent
  const indexMatch = fieldName.match(/(\d+)/);
  const playerIndex = indexMatch ? parseInt(indexMatch[1], 10) - 1 : -1;
  
  // Si nous avons un index spécifique et qu'il existe dans nos données
  if (playerIndex >= 0 && playerIndex < players.length) {
    const player = players[playerIndex];
    
    // Déterminer quel type de données de joueur ce champ contient
    if (fieldName.includes('nom')) {
      fillField(form, field.getName(), player.nom);
    } else if (fieldName.includes('prenom')) {
      fillField(form, field.getName(), player.prenom);
    } else if (fieldName.includes('licence')) {
      fillField(form, field.getName(), player.licence);
    } else if (fieldName.includes('avant')) {
      fillField(form, field.getName(), player.est_avant);
    } else if (fieldName.includes('arbitre')) {
      fillField(form, field.getName(), player.est_arbitre);
    } else if (fieldName.match(/joueur\d+|player\d+/)) {
      // Lorsque nous avons un nom du type "joueur1" sans autre précision, utiliser le nom complet
      fillField(form, field.getName(), `${player.prenom} ${player.nom}`);
    }
  }
  // Si pas d'index spécifique mais c'est un champ pour plusieurs joueurs
  else if (playerIndex === -1) {
    // Ça pourrait être un champ pour plusieurs joueurs (moins courant)
    if (field instanceof PDFTextField) {
      if (fieldName.includes('joueurs') || fieldName.includes('players')) {
        const playerText = players.map(p => `${p.nom} ${p.prenom}`).join('\n');
        fillField(form, field.getName(), playerText);
      } else if (fieldName.match(/^joueur$|^player$/i)) {
        // S'il y a juste "joueur" ou "player", essayer avec le premier joueur
        if (players.length > 0) {
          fillField(form, field.getName(), `${players[0].prenom} ${players[0].nom}`);
        }
      }
    }
  }
};

/**
 * Tente de remplir un champ d'entraîneur en fonction de son nom
 */
const tryFillCoachField = (form: PDFForm, field: PDFField, coaches: PdfData['educateurs']) => {
  const fieldName = field.getName().toLowerCase();
  
  // Extraire l'index de l'entraîneur du nom du champ s'il est présent
  const indexMatch = fieldName.match(/(\d+)/);
  const coachIndex = indexMatch ? parseInt(indexMatch[1], 10) - 1 : -1;
  
  // Si nous avons un index spécifique et qu'il existe dans nos données
  if (coachIndex >= 0 && coachIndex < coaches.length) {
    const coach = coaches[coachIndex];
    
    // Déterminer quel type de données d'entraîneur ce champ contient
    if (fieldName.includes('nom')) {
      fillField(form, field.getName(), coach.nom);
    } else if (fieldName.includes('prenom')) {
      fillField(form, field.getName(), coach.prenom);
    } else if (fieldName.includes('licence')) {
      fillField(form, field.getName(), coach.licence);
    } else if (fieldName.includes('diplome')) {
      fillField(form, field.getName(), coach.diplome);
    } else if (fieldName.includes('referent')) {
      fillField(form, field.getName(), coach.est_referent);
    } else if (fieldName.match(/educateur\d+|coach\d+|entraineur\d+/)) {
      // Lorsque nous avons un nom du type "educateur1" sans autre précision, utiliser le nom complet
      fillField(form, field.getName(), `${coach.prenom} ${coach.nom}`);
    }
  }
  // Si pas d'index spécifique mais c'est un champ pour un référent
  else if (fieldName.includes('referent') || fieldName.includes('responsable')) {
    const referentCoach = coaches.find(c => c.est_referent);
    if (referentCoach) {
      if (field instanceof PDFTextField) {
        fillField(form, field.getName(), `${referentCoach.prenom} ${referentCoach.nom}`);
      } else {
        fillField(form, field.getName(), true);
      }
    }
  }
  // Si pas d'index spécifique mais c'est un champ pour plusieurs entraîneurs
  else if (coachIndex === -1) {
    // Ça pourrait être un champ pour plusieurs entraîneurs (moins courant)
    if (field instanceof PDFTextField) {
      if (fieldName.includes('educateurs') || fieldName.includes('entraineurs') || fieldName.includes('coaches')) {
        const coachText = coaches.map(c => `${c.prenom} ${c.nom}`).join('\n');
        fillField(form, field.getName(), coachText);
      } else if (fieldName.match(/^educateur$|^entraineur$|^coach$/i)) {
        // S'il y a juste "educateur", essayer avec le premier entraîneur
        if (coaches.length > 0) {
          fillField(form, field.getName(), `${coaches[0].prenom} ${coaches[0].nom}`);
        }
      }
    }
  }
};

/**
 * Applique les mappings de champs pour positionner le texte dans le PDF
 * @param pages Pages du PDF
 * @param font Police à utiliser
 * @param data Données à insérer
 * @param fieldMappings Mappings des champs
 */
const applyFieldMappings = (
  pages: PDFPage[], 
  font: PDFFont, 
  data: PdfData, 
  fieldMappings: PdfFieldMapping[]
) => {
  // Tri des mappings par type pour traiter d'abord les champs globaux
  const globalMappings = fieldMappings.filter(m => m.type === 'global');
  const joueurMappings = fieldMappings.filter(m => m.type === 'joueur');
  const educateurMappings = fieldMappings.filter(m => m.type === 'educateur');
  
  // Page par défaut (première page)
  const defaultPage = pages[0];
  
  // Traitement des champs globaux
  globalMappings.forEach(mapping => {
    const value = getValueFromMapping(mapping.mapping, data);
    if (value) {
      // Les coordonnées devraient être incluses dans le mapping
      // Pour cet exemple, nous utilisons une fonction utilitaire pour les extraire
      const { x, y, pageIndex = 0 } = extractCoordinates(mapping.champ_pdf);
      
      // Utiliser la page spécifiée ou la page par défaut
      const page = pages[pageIndex] || defaultPage;
      
      // Dessiner le texte sur la page
      page.drawText(value.toString(), {
        x,
        y,
        size: 11,
        font,
        color: rgb(0, 0, 0)
      });
    }
  });
  
  // Traitement des joueurs
  data.joueurs.forEach((joueur, index) => {
    joueurMappings.forEach(mapping => {
      let value = null;
      
      // Déterminer quelle valeur utiliser selon le mapping
      if (mapping.mapping.includes('nom')) {
        value = joueur.nom;
      } else if (mapping.mapping.includes('prenom')) {
        value = joueur.prenom;
      } else if (mapping.mapping.includes('licence')) {
        value = joueur.licence;
      }
      
      if (value) {
        // Extraire les coordonnées de base
        const { x: baseX, y: baseY, pageIndex = 0 } = extractCoordinates(mapping.champ_pdf);
        
        // Calcul de la position Y pour chaque joueur (décalage vertical)
        // Pour cet exemple, on suppose un espacement de 20 points entre chaque joueur
        const y = baseY - (index * 20);
        
        // Utiliser la page spécifiée ou la page par défaut
        const page = pages[pageIndex] || defaultPage;
        
        // Dessiner le texte sur la page
        page.drawText(value, {
          x: baseX,
          y,
          size: 10,
          font,
          color: rgb(0, 0, 0)
        });
      }
    });
  });
  
  // Traitement des éducateurs
  data.educateurs.forEach((educateur, index) => {
    educateurMappings.forEach(mapping => {
      let value = null;
      
      // Déterminer quelle valeur utiliser selon le mapping
      if (mapping.mapping.includes('nom')) {
        value = educateur.nom;
      } else if (mapping.mapping.includes('prenom')) {
        value = educateur.prenom;
      } else if (mapping.mapping.includes('licence')) {
        value = educateur.licence;
      } else if (mapping.mapping.includes('diplome')) {
        value = educateur.diplome;
      }
      
      if (value) {
        // Extraire les coordonnées de base
        const { x: baseX, y: baseY, pageIndex = 0 } = extractCoordinates(mapping.champ_pdf);
        
        // Calcul de la position Y pour chaque éducateur (décalage vertical)
        // Pour cet exemple, on suppose un espacement de 25 points entre chaque éducateur
        const y = baseY - (index * 25);
        
        // Utiliser la page spécifiée ou la page par défaut
        const page = pages[pageIndex] || defaultPage;
        
        // Dessiner le texte sur la page
        page.drawText(value, {
          x: baseX,
          y,
          size: 10,
          font,
          color: rgb(0, 0, 0)
        });
      }
    });
  });
};

/**
 * Position par défaut pour les champs si aucun mapping n'est défini
 * @param page Page du PDF
 * @param font Police à utiliser
 * @param data Données à insérer
 */
const applyDefaultPositions = (page: PDFPage, font: PDFFont, data: PdfData) => {
  // Écriture des informations générales
  if (data.nom_manifestation) {
    page.drawText(`Tournoi: ${data.nom_manifestation}`, {
      x: 50,
      y: 750,
      size: 14,
      font,
      color: rgb(0, 0, 0)
    });
  }
  
  if (data.date_manifestation) {
    page.drawText(`Date: ${data.date_manifestation}`, {
      x: 50,
      y: 730,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });
  }
  
  if (data.lieu_manifestation) {
    page.drawText(`Lieu: ${data.lieu_manifestation}`, {
      x: 50,
      y: 710,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });
  }
  
  if (data.club) {
    page.drawText(`Club: ${data.club}`, {
      x: 50,
      y: 690,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });
  }
  
  // En-têtes de la liste des joueurs
  page.drawText("LISTE DES JOUEURS", {
    x: 50,
    y: 670,
    size: 12,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Nom", {
    x: 50,
    y: 650,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Prénom", {
    x: 150,
    y: 650,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Licence", {
    x: 250,
    y: 650,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Avant", {
    x: 350,
    y: 650,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Arbitre", {
    x: 400,
    y: 650,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  // Liste des joueurs
  data.joueurs.forEach((joueur, i) => {
    const y = 630 - (i * 20); // Espacement de 20 points entre les joueurs
    
    // Nom du joueur
    page.drawText(joueur.nom, {
      x: 50,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Prénom du joueur
    page.drawText(joueur.prenom, {
      x: 150,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Numéro de licence
    page.drawText(joueur.licence, {
      x: 250,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Indications pour les avants et arbitres
    if (joueur.est_avant) {
      page.drawText('✓', {
        x: 350,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    if (joueur.est_arbitre) {
      page.drawText('✓', {
        x: 400,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0)
      });
    }
  });
  
  // Liste des éducateurs
  const educateurStartY = Math.max(630 - (data.joueurs.length * 20) - 40, 250); // Espace après les joueurs
  
  page.drawText('ÉDUCATEURS:', {
    x: 50,
    y: educateurStartY,
    size: 12,
    font,
    color: rgb(0, 0, 0)
  });
  
  // En-têtes de la liste des éducateurs
  page.drawText("Nom", {
    x: 50,
    y: educateurStartY - 20,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Prénom", {
    x: 150,
    y: educateurStartY - 20,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Licence", {
    x: 250,
    y: educateurStartY - 20,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Diplôme", {
    x: 320,
    y: educateurStartY - 20,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  page.drawText("Référent", {
    x: 400,
    y: educateurStartY - 20,
    size: 10,
    font,
    color: rgb(0, 0, 0)
  });
  
  data.educateurs.forEach((educateur, i) => {
    const y = educateurStartY - 40 - (i * 20);
    
    // Nom de l'éducateur
    page.drawText(educateur.nom, {
      x: 50,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Prénom de l'éducateur
    page.drawText(educateur.prenom, {
      x: 150,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Numéro de licence
    page.drawText(educateur.licence || '', {
      x: 250,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Diplôme
    page.drawText(educateur.diplome || '', {
      x: 320,
      y,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
    
    // Indication pour l'éducateur référent
    if (educateur.est_referent) {
      page.drawText('✓', {
        x: 400,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0)
      });
    }
  });
};

/**
 * Extrait une valeur à partir d'un mapping et des données
 * @param mapping Chemin du mapping (ex: "equipe_a.joueur.nom")
 * @param data Données
 * @returns Valeur correspondant au mapping
 */
const getValueFromMapping = (mapping: string, data: any): any => {
  console.log(`Recherche de valeur pour le mapping: ${mapping}`);
  
  // Mappings de base pour les champs globaux
  if (mapping === 'tournoi.lieu' || mapping === 'tournoi.location') return data.lieu_manifestation;
  if (mapping === 'tournoi.date') return data.date_manifestation;
  if (mapping === 'tournoi.club_organisateur' || mapping === 'tournoi.nom') return data.nom_manifestation;
  if (mapping === 'club') return data.club;
  if (mapping === 'categorie' || mapping === 'category') return data.categorie;
  
  // Pour un référent, retourner le nom complet
  if (mapping === 'educateur.referent' || mapping === 'coach.referent') {
    const referent = data.educateurs.find(e => e.est_referent);
    return referent ? `${referent.prenom} ${referent.nom}` : null;
  }
  
  // Mappings pour des chemins d'accès imbriqués avec notation par points
  const keys = mapping.split('.');
  let value = data;
  
  for (const key of keys) {
    if (value === undefined || value === null) return null;
    
    // Cas spécial pour "joueurs" et "educateurs"
    if (key === 'joueurs' && Array.isArray(data.joueurs) && data.joueurs.length > 0) {
      return data.joueurs;
    }
    
    if (key === 'educateurs' && Array.isArray(data.educateurs) && data.educateurs.length > 0) {
      return data.educateurs;
    }
    
    value = value[key];
  }
  
  return value;
};

/**
 * Extrait les coordonnées x, y et l'index de page à partir d'une chaîne de description
 * Dans une implémentation réelle, ces informations viendraient du mapping
 * @param fieldDescription Description du champ
 * @returns Coordonnées x, y et index de page
 */
const extractCoordinates = (fieldDescription: string): { x: number, y: number, pageIndex?: number } => {
  // Cette fonction est un exemple simplifié
  // Dans une implémentation réelle, les coordonnées seraient extraites du mapping ou d'une analyse du PDF
  
  // Par défaut, retourner des coordonnées arbitraires
  // Ces valeurs devraient venir des données de mapping réelles
  switch (fieldDescription) {
    case 'Club organisateur':
      return { x: 85, y: 750 };
    case 'Date':
      return { x: 85, y: 730 };
    case 'Lieu':
      return { x: 85, y: 710 };
    case 'Nom du club (Équipe A)':
      return { x: 85, y: 690 };
    case 'Nom de l\'éducateur (Équipe A)':
      return { x: 50, y: 550 };
    case 'Prénom de l\'éducateur (Équipe A)':
      return { x: 150, y: 550 };
    case 'Nom du joueur (Équipe A)':
      return { x: 50, y: 650 };
    case 'Prénom du joueur (Équipe A)':
      return { x: 150, y: 650 };
    case 'Licence joueur (Équipe A)':
      return { x: 250, y: 650 };
    default:
      // Valeurs par défaut
      return { x: 100, y: 700 };
  }
};

// Types nécessaires pour TypeScript
type PDFPage = ReturnType<typeof PDFDocument.prototype.getPages>[0];
type PDFFont = Awaited<ReturnType<typeof PDFDocument.prototype.embedFont>>;
type PDFField = PDFTextField | PDFCheckBox | ReturnType<typeof PDFForm.prototype.getFields>[0];