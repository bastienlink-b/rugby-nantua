import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
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
  
  // Intégration de la police
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();
  
  if (pages.length === 0) {
    throw new Error('Le PDF ne contient aucune page');
  }
  
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
      licence: coach.licenseNumber,
      diplome: coach.diploma,
      est_referent: coach.id === referentCoachId
    }))
  };
  
  // Si le template contient des mappings de champs, les utiliser pour positionner le texte
  if (template.fieldMappings && template.fieldMappings.length > 0) {
    applyFieldMappings(pages, helveticaFont, data, template.fieldMappings);
  } else {
    // Fallback: utilisation de positions par défaut si aucun mapping n'est défini
    applyDefaultPositions(pages[0], helveticaFont, data);
  }

  // Enregistrement du PDF modifié
  return pdfDoc.save();
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