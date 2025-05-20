/**
 * Service de gestion des fichiers PDF
 * Ce service gère le stockage et la récupération des fichiers PDF
 */

import { PDFDocument, PDFField, PDFForm } from 'pdf-lib';
import { supabase, TEMPLATES_BUCKET } from './SupabaseClient';

// Préfixe utilisé pour stocker les fichiers dans le localStorage
const PDF_STORAGE_PREFIX = 'pdf_';

// Chemin du sous-dossier dans le bucket où sont stockés les PDFs
// Modifié pour éviter la duplication de chemin avec le nom du bucket
const PDF_STORAGE_FOLDER = '';

/**
 * Vérifie si un PDF existe dans le stockage local
 * @param filename Nom du fichier (sans chemin)
 */
export const pdfExists = (filename: string): boolean => {
  return localStorage.getItem(`${PDF_STORAGE_PREFIX}${filename}`) !== null;
};

/**
 * Récupère un PDF du stockage local
 * @param filename Nom du fichier (sans chemin)
 * @returns Le contenu du fichier en base64 ou null si le fichier n'existe pas
 */
export const getPdf = async (filename: string): Promise<string | null> => {
  // D'abord, essayer de récupérer depuis le localStorage
  const localPdf = localStorage.getItem(`${PDF_STORAGE_PREFIX}${filename}`);
  if (localPdf) {
    console.log(`PDF récupéré depuis le localStorage: ${filename}`);
    return localPdf;
  }
  
  // Si pas dans le localStorage, essayer de récupérer depuis Supabase
  try {
    console.log(`Tentative de récupération du fichier depuis Supabase: ${PDF_STORAGE_FOLDER}${filename}`);
    
    const { data, error } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .download(`${PDF_STORAGE_FOLDER}${filename}`);
    
    if (error) {
      // Amélioration de la détection des erreurs RLS
      if (error.message?.includes('policy') || error.message?.includes('Unauthorized') || 
          error.status === 403 || error.status === 400) {
        console.warn(`Erreur RLS: Accès non autorisé au fichier ${filename}. Utilisation du stockage local uniquement.`);
        return null;
      }
      
      // Essayer une seconde fois sans le dossier (pour compatibilité)
      const { data: directData, error: directError } = await supabase.storage
        .from(TEMPLATES_BUCKET)
        .download(filename);
        
      if (directError) {
        // Amélioration de la détection des erreurs RLS pour la seconde tentative
        if (directError.message?.includes('policy') || directError.message?.includes('Unauthorized') || 
            directError.status === 403 || directError.status === 400 || directError.status === 404) {
          console.warn(`PDF non trouvé dans Supabase ou accès non autorisé: ${filename}. Utilisation du stockage local uniquement.`);
          return null;
        }
        
        console.error('Erreur lors de la récupération du PDF depuis Supabase:', directError);
        return null;
      }
      
      if (!directData) {
        console.warn(`Aucune donnée reçue pour le fichier ${filename}. Utilisation du stockage local uniquement.`);
        return null;
      }
      
      // Convertir le blob en base64
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onloadend = () => {
          const base64data = reader.result as string;
          // Stocker aussi dans le localStorage pour un accès plus rapide la prochaine fois
          localStorage.setItem(`${PDF_STORAGE_PREFIX}${filename}`, base64data);
          console.log(`PDF récupéré depuis Supabase et stocké dans localStorage: ${filename}`);
          resolve(base64data);
        };
        reader.readAsDataURL(directData);
      });
    }
    
    if (!data) {
      console.warn(`Aucune donnée reçue pour le fichier ${filename}. Utilisation du stockage local uniquement.`);
      return null;
    }
    
    // Convertir le blob en base64
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Stocker aussi dans le localStorage pour un accès plus rapide la prochaine fois
        localStorage.setItem(`${PDF_STORAGE_PREFIX}${filename}`, base64data);
        console.log(`PDF récupéré depuis Supabase et stocké dans localStorage: ${filename}`);
        resolve(base64data);
      };
      reader.readAsDataURL(data);
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du PDF:', error);
    return null;
  }
};

/**
 * Stocke un PDF dans le stockage local et tente de le stocker dans Supabase
 * @param filename Nom du fichier (sans chemin)
 * @param content Contenu du fichier en base64
 */
export const storePdf = async (filename: string, content: string): Promise<boolean> => {
  // Stocker dans le localStorage (toujours réussit)
  localStorage.setItem(`${PDF_STORAGE_PREFIX}${filename}`, content);
  console.log(`PDF stocké dans le localStorage: ${filename}`);
  
  // Vérifier la session avant d'essayer d'accéder à Supabase
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    console.warn('Utilisateur non authentifié. PDF stocké localement uniquement.');
    return true; // Considéré comme succès car stocké localement
  }
  
  // Tenter de stocker dans Supabase
  try {
    // Convertir base64 en Blob
    const base64Response = await fetch(content);
    const blob = await base64Response.blob();
    
    // Uploader vers Supabase avec le chemin complet
    const { error } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .upload(`${PDF_STORAGE_FOLDER}${filename}`, blob, {
        contentType: 'application/pdf',
        upsert: true // Remplacer si existe déjà
      });
    
    if (error) {
      // Amélioration de la détection des erreurs RLS
      if (error.message?.includes('policy') || error.message?.includes('Unauthorized') || 
          error.status === 403 || error.status === 400) {
        console.warn(`Erreur RLS: Accès non autorisé pour stocker ${filename}. PDF stocké localement uniquement.`);
        return true; // Considéré comme succès car stocké localement
      }
      
      // Si le bucket n'existe pas
      if (error.message?.includes('not found') || error.status === 404) {
        console.warn('Le bucket Supabase n\'existe pas. PDF stocké localement uniquement.');
        return true; // Considéré comme succès car stocké localement
      }
      
      console.error('Erreur lors de l\'upload du PDF vers Supabase:', error);
      return true; // Considéré comme succès car stocké localement
    }
    
    console.log(`PDF stocké avec succès dans Supabase: ${filename}`);
    return true;
  } catch (error) {
    console.warn('Erreur lors du stockage du PDF dans Supabase. PDF stocké localement uniquement:', error);
    return true; // Considéré comme succès car stocké localement
  }
};

/**
 * Supprime un PDF du stockage local et tente de le supprimer de Supabase
 * @param filename Nom du fichier (sans chemin)
 */
export const removePdf = async (filename: string): Promise<boolean> => {
  // Supprimer du localStorage
  localStorage.removeItem(`${PDF_STORAGE_PREFIX}${filename}`);
  console.log(`PDF supprimé du localStorage: ${filename}`);
  
  // Vérifier la session avant d'essayer d'accéder à Supabase
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    console.warn('Utilisateur non authentifié. PDF supprimé localement uniquement.');
    return true; // Considéré comme succès car stocké localement
  }
  
  // Tenter de supprimer de Supabase
  try {
    const { error } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .remove([`${PDF_STORAGE_FOLDER}${filename}`]);
    
    if (error) {
      // Amélioration de la détection des erreurs RLS
      if (error.message?.includes('policy') || error.message?.includes('Unauthorized') || 
          error.status === 403 || error.status === 400) {
        console.warn(`Erreur RLS: Accès non autorisé pour supprimer ${filename}. PDF supprimé localement uniquement.`);
        return true; // On considère que c'est un succès car le fichier a été supprimé localement
      }
      
      // Essayer une seconde fois sans le dossier (pour compatibilité)
      const { error: directError } = await supabase.storage
        .from(TEMPLATES_BUCKET)
        .remove([filename]);
        
      if (directError) {
        // Amélioration de la détection des erreurs RLS pour la seconde tentative
        if (directError.message?.includes('policy') || directError.message?.includes('Unauthorized') || 
            directError.status === 403 || directError.status === 400) {
          console.warn(`Erreur RLS: Accès non autorisé pour supprimer ${filename}. PDF supprimé localement uniquement.`);
          return true; // On considère que c'est un succès car le fichier a été supprimé localement
        }
        
        console.error('Erreur lors de la suppression du PDF de Supabase:', directError);
        return true; // On considère que c'est un succès car le fichier a été supprimé localement
      }
    }
    
    console.log(`PDF supprimé avec succès de Supabase: ${filename}`);
    return true;
  } catch (error) {
    console.warn('Erreur lors de la suppression du PDF de Supabase. PDF supprimé localement uniquement:', error);
    return true; // On considère que c'est un succès car le fichier a été supprimé localement
  }
};

/**
 * Liste tous les fichiers PDF stockés dans Supabase
 * @returns Un tableau de noms de fichiers
 */
export const listPdfs = async (): Promise<string[]> => {
  // Vérifier la session avant d'essayer d'accéder à Supabase
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    console.warn('Utilisateur non authentifié. Aucun fichier distant disponible.');
    return [];
  }
  
  try {
    console.log(`Tentative de liste des fichiers dans le dossier: ${PDF_STORAGE_FOLDER}`);
    
    // D'abord, essayer avec le chemin du dossier
    const { data: folderData, error: folderError } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .list(PDF_STORAGE_FOLDER);
    
    if (folderError) {
      // Amélioration de la détection des erreurs RLS
      if (folderError.message?.includes('policy') || folderError.message?.includes('Unauthorized') || 
          folderError.status === 403 || folderError.status === 400) {
        console.warn(`Erreur RLS: Accès non autorisé pour lister les fichiers. Aucun fichier trouvé.`);
        return [];
      }
      
      console.warn(`Erreur lors de la liste des fichiers dans ${PDF_STORAGE_FOLDER}:`, folderError);
      
      // Essayer ensuite sans le dossier (à la racine)
      const { data: rootData, error: rootError } = await supabase.storage
        .from(TEMPLATES_BUCKET)
        .list();
      
      if (rootError) {
        // Amélioration de la détection des erreurs RLS pour la seconde tentative
        if (rootError.message?.includes('policy') || rootError.message?.includes('Unauthorized') || 
            rootError.status === 403 || rootError.status === 400) {
          console.warn(`Erreur RLS: Accès non autorisé pour lister les fichiers. Aucun fichier trouvé.`);
          return [];
        }
        
        // Si le bucket n'existe pas
        if (rootError.message?.includes('not found') || rootError.status === 404) {
          console.warn('Le bucket Supabase n\'existe pas.');
          return [];
        }
        
        console.error('Erreur lors de la récupération de la liste des PDF:', rootError);
        return [];
      }
      
      // Filtrer pour n'obtenir que les PDFs à la racine
      return rootData 
        ? rootData
            .filter(file => file.name.toLowerCase().endsWith('.pdf'))
            .map(file => file.name)
        : [];
    }
    
    // Traiter les résultats du dossier
    if (folderData && folderData.length > 0) {
      console.log(`Fichiers trouvés dans ${PDF_STORAGE_FOLDER}:`, folderData.map(f => f.name));
      
      // Retourner uniquement les fichiers PDF
      return folderData
        .filter(file => file.name.toLowerCase().endsWith('.pdf'))
        .map(file => file.name);
    }
    
    // Essayer à la racine si le dossier est vide
    const { data: rootData, error: rootError } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .list();
    
    if (rootError) {
      // Amélioration de la détection des erreurs RLS pour la seconde tentative
      if (rootError.message?.includes('policy') || rootError.message?.includes('Unauthorized') || 
          rootError.status === 403 || rootError.status === 400) {
        console.warn(`Erreur RLS: Accès non autorisé pour lister les fichiers. Aucun fichier trouvé.`);
        return [];
      }
      
      console.warn('Erreur lors de la liste des fichiers à la racine:', rootError);
      return [];
    }
    
    // Filtrer pour n'obtenir que les PDFs à la racine
    return rootData 
      ? rootData
          .filter(file => file.name.toLowerCase().endsWith('.pdf'))
          .map(file => file.name)
      : [];
  } catch (error) {
    console.warn('Erreur lors de la récupération de la liste des PDF:', error);
    return [];
  }
};

/**
 * Crée une URL blob pour afficher un PDF
 * @param content Contenu du fichier en base64
 * @returns URL blob pour afficher le PDF
 */
export const createPdfBlobUrl = (content: string): string => {
  // Extraire uniquement la partie base64 (après la virgule)
  const base64Data = content.includes('base64,') ? content.split(',')[1] : content;
  
  const byteCharacters = atob(base64Data);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  const blob = new Blob(byteArrays, { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

/**
 * Obtient l'URL publique d'un fichier PDF stocké dans Supabase
 * @param filename Nom du fichier
 * @returns URL publique du fichier
 */
export const getPublicUrl = async (filename: string): Promise<string> => {
  // Vérifier la session avant d'essayer d'accéder à Supabase
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    console.warn('Utilisateur non authentifié. Impossible d\'obtenir l\'URL publique.');
    return '';
  }
  
  try {
    // D'abord essayer avec le chemin du dossier
    const { data: folderData } = supabase.storage
      .from(TEMPLATES_BUCKET)
      .getPublicUrl(`${PDF_STORAGE_FOLDER}${filename}`);
    
    // Si pas d'URL valide, essayer sans le dossier
    if (!folderData.publicUrl.includes(filename)) {
      const { data } = supabase.storage
        .from(TEMPLATES_BUCKET)
        .getPublicUrl(filename);
      
      return data.publicUrl;
    }
    
    return folderData.publicUrl;
  } catch (error) {
    console.warn(`Erreur lors de la récupération de l'URL publique pour ${filename}:`, error);
    return ''; // Retourner une chaîne vide en cas d'erreur
  }
};

/**
 * Nettoie tous les champs éditables d'un PDF
 * @param pdfData Contenu du PDF en base64
 * @returns Une promesse qui résout vers le contenu PDF nettoyé en base64
 */
export const cleanPdfFormFields = async (pdfData: string): Promise<string> => {
  try {
    // Extraire uniquement la partie base64 (après la virgule)
    const base64Data = pdfData.includes('base64,') ? pdfData.split(',')[1] : pdfData;
    const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Charger le PDF
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    // Récupérer le formulaire
    const form = pdfDoc.getForm();
    
    // Vider tous les champs du formulaire
    const fields = form.getFields();
    fields.forEach(field => {
      try {
        if (field.constructor.name === 'PDFTextField') {
          form.getTextField(field.getName()).setText('');
        } else if (field.constructor.name === 'PDFCheckBox') {
          form.getCheckBox(field.getName()).check();
        } else if (field.constructor.name === 'PDFRadioGroup') {
          // Pour les groupes radio, on les laisse inchangés ou on sélectionne la première option
          // selon votre préférence
        } else if (field.constructor.name === 'PDFDropdown') {
          form.getDropdown(field.getName()).select(0);
        } else if (field.constructor.name === 'PDFOptionList') {
          form.getOptionList(field.getName()).clear();
        }
      } catch (error) {
        console.error(`Erreur lors du nettoyage du champ ${field.getName()}:`, error);
      }
    });
    
    // Sauvegarder le PDF
    const modifiedPdfBytes = await pdfDoc.save();
    
    // Convertir en base64
    const modifiedBase64 = btoa(
      Array.from(new Uint8Array(modifiedPdfBytes))
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
    
    // Retourner avec le préfixe data:application/pdf;base64,
    return `data:application/pdf;base64,${modifiedBase64}`;
  } catch (error) {
    console.error('Erreur lors du nettoyage du PDF:', error);
    return pdfData; // En cas d'erreur, renvoyer le PDF original
  }
};