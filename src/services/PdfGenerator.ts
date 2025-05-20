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
    fillFormFields(form, data, template.fieldMappings || []);
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
  form.flatten();

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
            const value = getValueFromMapping(mapping.mapping, data);
            if (value !== null && value !== undefined) {
              fillField(form, mapping.champ_pdf, value);
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
              
              if (mapping.mapping.includes('nom')) value = joueur.nom;
              else if (mapping.mapping.includes('prenom')) value = joueur.prenom;
              else if (mapping.mapping.includes('licence')) value = joueur.licence;
              else if (mapping.mapping.includes('avant')) value = joueur.est_avant;
              else if (mapping.mapping.includes('arbitre')) value = joueur.est_arbitre;
              
              if (value !== null && value !== undefined) {
                // Utiliser la position du joueur pour construire le nom du champ
                // Par exemple, si le champ est "joueurNom", utilisez "joueurNom1", "joueurNom2", etc.
                const fieldName = `${mapping.champ_pdf}${index + 1}`;
                fillField(form, fieldName, value);
                
                // Essayer aussi avec un format alternatif, par exemple "joueur[1].nom"
                const altFieldName = mapping.champ_pdf.replace('[n]', `[${index + 1}]`);
                if (altFieldName !== mapping.champ_pdf) {
                  fillField(form, altFieldName, value);
                }
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
              
              if (mapping.mapping.includes('nom')) value = educateur.nom;
              else if (mapping.mapping.includes('prenom')) value = educateur.prenom;
              else if (mapping.mapping.includes('licence')) value = educateur.licence;
              else if (mapping.mapping.includes('diplome')) value = educateur.diplome;
              else if (mapping.mapping.includes('referent')) value = educateur.est_referent;
              
              if (value !== null && value !== undefined) {
                // Utiliser la position de l'éducateur pour construire le nom du champ
                const fieldName = `${mapping.champ_pdf}${index + 1}`;
                fillField(form, fieldName, value);
                
                // Essayer aussi avec un format alternatif
                const altFieldName = mapping.champ_pdf.replace('[n]', `[${index + 1}]`);
                if (altFieldName !== mapping.champ_pdf) {
                  fillField(form, altFieldName, value);
                }
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
 * Remplit un champ de formulaire avec une valeur donnée
 * @param form Formulaire PDF
 * @param fieldName Nom du champ
 * @param value Valeur à insérer
 */
const fillField = (form: PDFForm, fieldName: string, value: any) => {
  try {
    // Check if the field exists
    const field = form.getFields().find(f => f.getName() === fieldName);
    if (!field) {
      // console.warn(`Champ ${fieldName} non trouvé dans le formulaire`);
      return;
    }

    // Handle different field types
    if (field.constructor.name === 'PDFTextField') {
      const textValue = typeof value === 'boolean' 
        ? (value ? 'Oui' : 'Non')
        : String(value);
      form.getTextField(fieldName).setText(textValue);
      console.log(`Champ texte ${fieldName} rempli avec: ${textValue}`);
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
      console.log(`Case à cocher ${fieldName} définie à: ${!!value}`);
    } else if (field.constructor.name === 'PDFDropdown') {
      const dropdownField = form.getDropdown(fieldName);
      const options = dropdownField.getOptions();
      const stringValue = String(value);
      
      if (options.includes(stringValue)) {
        dropdownField.select(stringValue);
      } else {
        console.warn(`Valeur ${value} non trouvée dans les options de la liste déroulante ${fieldName}`);
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
  
  // Map of common field names to their values
  const commonFieldMappings: Record<string, any> = {
    // Event details
    'tournoi': data.nom_manifestation,
    'manifestation': data.nom_manifestation,
    'evenement': data.nom_manifestation,
    'date': data.date_manifestation,
    'lieu': data.lieu_manifestation,
    'location': data.lieu_manifestation,
    
    // Tournament details
    'club': data.club,
    'categorie': data.categorie,
    'category': data.categorie,
  };
  
  // Try to fill in fields based on their names
  fields.forEach(field => {
    const fieldName = field.getName();
    const lowerFieldName = fieldName.toLowerCase();
    
    // Check for direct matches in our mapping
    for (const [key, value] of Object.entries(commonFieldMappings)) {
      if (value && (lowerFieldName === key || lowerFieldName.includes(key))) {
        try {
          fillField(form, fieldName, value);
        } catch (error) {
          console.warn(`Erreur lors du remplissage automatique du champ ${fieldName}:`, error);
        }
      }
    }
    
    // Check for players
    if (lowerFieldName.includes('joueur') || lowerFieldName.includes('player')) {
      tryFillPlayerField(form, field, data.joueurs);
    }
    
    // Check for coaches
    if (lowerFieldName.includes('educateur') || 
        lowerFieldName.includes('entraineur') || 
        lowerFieldName.includes('coach')) {
      tryFillCoachField(form, field, data.educateurs);
    }
  });
};

/**
 * Tente de remplir un champ de joueur en fonction de son nom
 */
const tryFillPlayerField = (form: PDFForm, field: PDFField, players: PdfData['joueurs']) => {
  const fieldName = field.getName().toLowerCase();
  
  // Extract player index from field name if present
  const indexMatch = fieldName.match(/(\d+)/);
  const playerIndex = indexMatch ? parseInt(indexMatch[1], 10) - 1 : -1;
  
  // If we have a specific player index and it exists in our data
  if (playerIndex >= 0 && playerIndex < players.length) {
    const player = players[playerIndex];
    
    // Determine what type of player data this field contains
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
    }
  }
  // If no specific index but it's a multi-player field
  else if (playerIndex === -1) {
    // It could be a field for multiple players (less common)
    if (field instanceof PDFTextField) {
      if (fieldName.includes('joueurs') || fieldName.includes('players')) {
        const playerText = players.map(p => `${p.nom} ${p.prenom}`).join('\n');
        fillField(form, field.getName(), playerText);
      }
    }
  }
};

/**
 * Tente de remplir un champ d'entraîneur en fonction de son nom
 */
const tryFillCoachField = (form: PDFForm, field: PDFField, coaches: PdfData['educateurs']) => {
  const fieldName = field.getName().toLowerCase();
  
  // Extract coach index from field name if present
  const indexMatch = fieldName.match(/(\d+)/);
  const coachIndex = indexMatch ? parseInt(indexMatch[1], 10) - 1 : -1;
  
  // If we have a specific coach index and it exists in our data
  if (coachIndex >= 0 && coachIndex < coaches.length) {
    const coach = coaches[coachIndex];
    
    // Determine what type of coach data this field contains
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
    }
  }
  // If no specific index but it's a multi-coach field
  else if (coachIndex === -1) {
    // It could be a field for multiple coaches (less common)
    if (field instanceof PDFTextField) {
      if (fieldName.includes('educateurs') || fieldName.includes('coaches')) {
        const coachText = coaches.map(c => `${c.nom} ${c.prenom}`).join('\n');
        fillField(form, field.getName(), coachText);
      }
      
      // Special case for the referent coach
      if (fieldName.includes('referent')) {
        const referentCoach = coaches.find(c => c.est_referent);
        if (referentCoach) {
          fillField(form, field.getName(), `${referentCoach.nom} ${referentCoach.prenom}`);
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
    page.drawText(data.nom_manifestation, {
      x: 85,
      y: 750,
      size: 12,
      font,
      color: rgb(0, 0, 0)
    });
  }
  
  if (data.date_manifestation) {
    page.drawText(data.date_manifestation, {
      x: 85,
      y: 730,
      size: 10,
      font,
      color: rgb(0, 0, 0)
    });
  }
  
  // Liste des joueurs
  data.joueurs.forEach((joueur, i) => {
    const y = 650 - (i * 20); // Espacement de 20 points entre les joueurs
    
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
      page.drawText('A', {
        x: 350,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0)
      });
    }
    
    if (joueur.est_arbitre) {
      page.drawText('AR', {
        x: 370,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0)
      });
    }
  });
  
  // Liste des éducateurs
  const educateurStartY = 650 - (data.joueurs.length * 20) - 40; // Espace après les joueurs
  
  page.drawText('Éducateurs:', {
    x: 50,
    y: educateurStartY + 20,
    size: 12,
    font,
    color: rgb(0, 0, 0)
  });
  
  data.educateurs.forEach((educateur, i) => {
    const y = educateurStartY - (i * 20);
    
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
    
    // Indication pour l'éducateur référent
    if (educateur.est_referent) {
      page.drawText('Référent', {
        x: 350,
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
  // Exemple de mise en œuvre simple pour les cas de base
  if (mapping === 'tournoi.lieu') return data.lieu_manifestation;
  if (mapping === 'tournoi.date') return data.date_manifestation;
  if (mapping === 'tournoi.club_organisateur' || mapping === 'tournoi.nom') return data.nom_manifestation;
  
  // Pour les mappings plus complexes, un traitement plus sophistiqué serait nécessaire
  return null;
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