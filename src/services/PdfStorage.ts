/**
 * Service de gestion des fichiers PDF
 * Ce service gère le stockage et la récupération des fichiers PDF
 */

import { PDFDocument, PDFField, PDFForm } from 'pdf-lib';
import { supabase, TEMPLATES_BUCKET } from './SupabaseClient';

// Préfixe utilisé pour stocker les fichiers dans le localStorage
const PDF_STORAGE_PREFIX = 'pdf_';

/**
 * Nettoie et normalise le chemin du fichier
 * @param filename Chemin du fichier
 * @returns Chemin normalisé
 */
const normalizeFilePath = (filename: string): string => {
  // Supprimer les slashes au début et à la fin
  let normalized = filename.replace(/^\/+|\/+$/g, '');
  
  // Si l'URL est complète, extraire le nom du fichier
  if (normalized.includes('://')) {
    normalized = normalized.split('/').pop() || normalized;
  }
  
  return normalized;
};

/**
 * Vérifie si un PDF existe dans le stockage local
 * @param filename Nom du fichier (sans chemin)
 */
export const pdfExists = (filename: string): boolean => {
  const normalizedPath = normalizeFilePath(filename);
  return localStorage.getItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`) !== null;
};

/**
 * Récupère un PDF du stockage local ou de Supabase
 * @param filename Nom du fichier ou URL complète
 * @returns Le contenu du fichier en base64 ou null si le fichier n'existe pas
 */
export const getPdf = async (filename: string): Promise<string | null> => {
  const normalizedPath = normalizeFilePath(filename);
  
  // D'abord, essayer de récupérer depuis le localStorage
  const localPdf = localStorage.getItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`);
  if (localPdf) {
    console.log(`PDF récupéré depuis le localStorage: ${normalizedPath}`);
    return localPdf;
  }
  
  // Si pas dans le localStorage, essayer de récupérer depuis Supabase
  try {
    console.log(`Tentative de récupération du fichier depuis Supabase: ${normalizedPath}`);
    
    // Essayer d'abord avec le chemin direct
    const { data, error } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .download(normalizedPath);
    
    if (error) {
      // Si le fichier n'est pas trouvé, vérifier s'il existe dans un sous-dossier
      const possiblePaths = [
        normalizedPath,
        `templates/${normalizedPath}`,
        `modeles/${normalizedPath}`,
      ];
      
      // Essayer chaque chemin possible
      for (const path of possiblePaths) {
        const { data: pathData, error: pathError } = await supabase.storage
          .from(TEMPLATES_BUCKET)
          .download(path);
          
        if (!pathError && pathData) {
          // Convertir le blob en base64
          const reader = new FileReader();
          return new Promise((resolve) => {
            reader.onloadend = () => {
              const base64data = reader.result as string;
              // Stocker dans le localStorage pour un accès plus rapide
              localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, base64data);
              console.log(`PDF récupéré depuis Supabase (${path}) et stocké dans localStorage`);
              resolve(base64data);
            };
            reader.readAsDataURL(pathData);
          });
        }
      }
      
      // Si aucun chemin n'a fonctionné, logger l'erreur et retourner null
      console.error('PDF non trouvé dans Supabase:', normalizedPath);
      throw new Error('Fichier PDF non trouvé');
    }
    
    if (!data) {
      console.warn(`Aucune donnée reçue pour le fichier ${normalizedPath}`);
      return null;
    }
    
    // Convertir le blob en base64
    const reader = new FileReader();
    return new Promise((resolve) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        // Stocker dans le localStorage pour un accès plus rapide
        localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, base64data);
        console.log(`PDF récupéré depuis Supabase et stocké dans localStorage: ${normalizedPath}`);
        resolve(base64data);
      };
      reader.readAsDataURL(data);
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du PDF:', error);
    throw error;
  }
};

/**
 * Stocke un PDF dans le stockage local et Supabase
 * @param filename Nom du fichier (sans chemin)
 * @param content Contenu du fichier en base64
 */
export const storePdf = async (filename: string, content: string): Promise<boolean> => {
  const normalizedPath = normalizeFilePath(filename);
  
  // Stocker dans le localStorage
  localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, content);
  console.log(`PDF stocké dans le localStorage: ${normalizedPath}`);
  
  // Vérifier la session Supabase
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    console.warn('Utilisateur non authentifié. PDF stocké localement uniquement.');
    return true;
  }
  
  try {
    // Convertir base64 en Blob
    const base64Response = await fetch(content);
    const blob = await base64Response.blob();
    
    // Uploader vers Supabase
    const { error } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .upload(normalizedPath, blob, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (error) {
      console.error('Erreur lors du stockage dans Supabase:', error);
      return true; // Succès car stocké localement
    }
    
    console.log(`PDF stocké avec succès dans Supabase: ${normalizedPath}`);
    return true;
  } catch (error) {
    console.warn('Erreur lors du stockage du PDF:', error);
    return true; // Succès car stocké localement
  }
};

/**
 * Supprime un PDF du stockage local et de Supabase
 * @param filename Nom du fichier (sans chemin)
 */
export const removePdf = async (filename: string): Promise<boolean> => {
  const normalizedPath = normalizeFilePath(filename);
  
  // Supprimer du localStorage
  localStorage.removeItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`);
  console.log(`PDF supprimé du localStorage: ${normalizedPath}`);
  
  // Vérifier la session Supabase
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    return true;
  }
  
  try {
    const { error } = await supabase.storage
      .from(TEMPLATES_BUCKET)
      .remove([normalizedPath]);
    
    if (error) {
      console.warn('Erreur lors de la suppression du PDF de Supabase:', error);
      return true; // Succès car supprimé localement
    }
    
    console.log(`PDF supprimé avec succès de Supabase: ${normalizedPath}`);
    return true;
  } catch (error) {
    console.warn('Erreur lors de la suppression du PDF:', error);
    return true; // Succès car supprimé localement
  }
};

/**
 * Liste tous les fichiers PDF stockés dans Supabase
 * @returns Un tableau de noms de fichiers
 */
export const listPdfs = async (): Promise<string[]> => {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    return [];
  }
  
  try {
    // Lister les fichiers à la racine et dans les sous-dossiers possibles
    const paths = ['', 'templates/', 'modeles/'];
    const allFiles: string[] = [];
    
    for (const path of paths) {
      const { data, error } = await supabase.storage
        .from(TEMPLATES_BUCKET)
        .list(path);
      
      if (!error && data) {
        const pdfFiles = data
          .filter(file => file.name.toLowerCase().endsWith('.pdf'))
          .map(file => path + file.name);
        allFiles.push(...pdfFiles);
      }
    }
    
    return allFiles;
  } catch (error) {
    console.warn('Erreur lors de la liste des PDF:', error);
    return [];
  }
};

/**
 * Crée une URL blob pour afficher un PDF
 * @param content Contenu du fichier en base64
 * @returns URL blob pour afficher le PDF
 */
export const createPdfBlobUrl = (content: string): string => {
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
  const normalizedPath = normalizeFilePath(filename);
  
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    return '';
  }
  
  try {
    const { data } = supabase.storage
      .from(TEMPLATES_BUCKET)
      .getPublicUrl(normalizedPath);
    
    return data.publicUrl;
  } catch (error) {
    console.warn(`Erreur lors de la récupération de l'URL publique:`, error);
    return '';
  }
};

/**
 * Nettoie tous les champs éditables d'un PDF
 * @param pdfData Contenu du PDF en base64
 * @returns Une promesse qui résout vers le contenu PDF nettoyé en base64
 */
export const cleanPdfFormFields = async (pdfData: string): Promise<string> => {
  try {
    const base64Data = pdfData.includes('base64,') ? pdfData.split(',')[1] : pdfData;
    const pdfBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    form.getFields().forEach(field => {
      try {
        if (field instanceof PDFField) {
          switch (field.constructor.name) {
            case 'PDFTextField':
              form.getTextField(field.getName()).setText('');
              break;
            case 'PDFCheckBox':
              form.getCheckBox(field.getName()).check();
              break;
            case 'PDFDropdown':
              form.getDropdown(field.getName()).select(0);
              break;
            case 'PDFOptionList':
              form.getOptionList(field.getName()).clear();
              break;
          }
        }
      } catch (error) {
        console.error(`Erreur lors du nettoyage du champ ${field.getName()}:`, error);
      }
    });
    
    const modifiedPdfBytes = await pdfDoc.save();
    const modifiedBase64 = btoa(
      Array.from(new Uint8Array(modifiedPdfBytes))
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
    
    return `data:application/pdf;base64,${modifiedBase64}`;
  } catch (error) {
    console.error('Erreur lors du nettoyage du PDF:', error);
    return pdfData;
  }
};