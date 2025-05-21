/**
 * Service de gestion des fichiers PDF
 * Ce service gère le stockage et la récupération des fichiers PDF
 */

import { PDFDocument, PDFField, PDFForm } from 'pdf-lib';
import { supabase, TEMPLATES_BUCKET, GENERATED_BUCKET } from './SupabaseClient';
import { createHash } from 'crypto';

// Préfixe utilisé pour stocker les fichiers dans le localStorage
const PDF_STORAGE_PREFIX = 'pdf_';

// Cache pour les hashes de fichiers
const fileHashCache = new Map<string, string>();

/**
 * Calcule le hash SHA-256 d'un contenu PDF
 */
const calculatePdfHash = async (content: string): Promise<string> => {
  const base64Data = content.includes('base64,') ? content.split(',')[1] : content;
  return createHash('sha256').update(base64Data).digest('hex');
};

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
  
  // Éviter les duplications de dossiers dans le chemin
  // Par exemple, éviter modeles/modeles/file.pdf
  const segments = normalized.split('/');
  if (segments.length > 1 && segments[0] === segments[1]) {
    segments.shift(); // Supprimer le premier segment dupliqué
    normalized = segments.join('/');
  }
  
  // Éviter l'inclusion d'un bucket dans le chemin d'un autre bucket
  // Par exemple, éviter generated_pdfs/modeles/file.pdf
  if (normalized.includes(TEMPLATES_BUCKET) && normalized.includes(GENERATED_BUCKET)) {
    // Garder seulement la partie après le dernier nom de bucket trouvé
    if (normalized.lastIndexOf(TEMPLATES_BUCKET) > normalized.lastIndexOf(GENERATED_BUCKET)) {
      normalized = normalized.substring(normalized.lastIndexOf(TEMPLATES_BUCKET) + TEMPLATES_BUCKET.length).replace(/^\/+/, '');
    } else {
      normalized = normalized.substring(normalized.lastIndexOf(GENERATED_BUCKET) + GENERATED_BUCKET.length).replace(/^\/+/, '');
    }
  } else if (normalized.includes(TEMPLATES_BUCKET) && !normalized.startsWith(TEMPLATES_BUCKET)) {
    normalized = normalized.substring(normalized.lastIndexOf(TEMPLATES_BUCKET) + TEMPLATES_BUCKET.length).replace(/^\/+/, '');
  } else if (normalized.includes(GENERATED_BUCKET) && !normalized.startsWith(GENERATED_BUCKET)) {
    normalized = normalized.substring(normalized.lastIndexOf(GENERATED_BUCKET) + GENERATED_BUCKET.length).replace(/^\/+/, '');
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
  
  console.log(`Tentative de récupération du PDF: ${normalizedPath}`);
  
  // D'abord, essayer de récupérer depuis le localStorage
  const localPdf = localStorage.getItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`);
  if (localPdf) {
    console.log(`PDF récupéré depuis le localStorage: ${normalizedPath}`);
    return localPdf;
  }
  
  // Si pas dans le localStorage, essayer de récupérer depuis Supabase
  try {
    console.log(`Tentative de récupération du fichier depuis Supabase: ${normalizedPath}`);
    
    // Définir tous les chemins possibles
    // Inclut le chemin original, et des variations avec des préfixes courants
    const possiblePaths = [
      normalizedPath,                                       // Chemin tel quel
      `${normalizedPath.split('/').pop()}`,                 // Juste le nom du fichier
    ];
    
    // Éviter les doublons dans les chemins
    const uniquePaths = [...new Set(possiblePaths)];
    
    // Déterminer le bucket à utiliser en fonction du préfixe ou du path
    const isGenerated = normalizedPath.startsWith('feuille_match_') || 
                       filename.includes('generated_pdfs');
    const primaryBucket = isGenerated ? GENERATED_BUCKET : TEMPLATES_BUCKET;
    const secondaryBucket = isGenerated ? TEMPLATES_BUCKET : GENERATED_BUCKET;
    
    console.log(`Recherche du PDF dans le bucket ${primaryBucket} avec les chemins:`, uniquePaths);
    
    // Try in primary bucket first
    let pdfFound = await tryFindPdfInBucket(primaryBucket, uniquePaths, normalizedPath);
    if (pdfFound) return pdfFound;
    
    // If not found, try secondary bucket
    console.log(`PDF non trouvé dans ${primaryBucket}, tentative dans ${secondaryBucket}`);
    pdfFound = await tryFindPdfInBucket(secondaryBucket, uniquePaths, normalizedPath);
    if (pdfFound) return pdfFound;
    
    // If the PDF isn't found in any bucket, generate a base64 placeholder PDF
    console.log(`PDF non trouvé dans Supabase, génération d'un PDF vide`);
    const emptyPdf = await generateEmptyPdf();
    localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, emptyPdf);
    return emptyPdf;
  } catch (error) {
    console.error('Erreur lors de la récupération du PDF:', error);
    
    // Return an empty PDF in case of error
    try {
      const emptyPdf = await generateEmptyPdf();
      localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, emptyPdf);
      return emptyPdf;
    } catch (pdfError) {
      console.error('Impossible de générer un PDF vide:', pdfError);
      throw new Error(`Fichier PDF non trouvé: ${normalizedPath}`);
    }
  }
};

/**
 * Tries to find a PDF in a specific bucket with multiple possible paths
 * @param bucketName The bucket to search in
 * @param paths Array of possible paths to try
 * @param normalizedPath The normalized path for localStorage caching
 * @returns The PDF content as base64 if found, null otherwise
 */
const tryFindPdfInBucket = async (
  bucketName: string, 
  paths: string[], 
  normalizedPath: string
): Promise<string | null> => {
  for (const path of paths) {
    console.log(`Essai du chemin: ${bucketName}/${path}`);
    
    try {
      const { data, error } = await supabase.storage
        .from(bucketName)
        .download(path);
        
      if (error) {
        console.warn(`Erreur lors de la récupération du PDF (${bucketName}/${path}):`, error.message);
        continue; // Try next path
      }
        
      if (data) {
        // Convertir le blob en base64
        const reader = new FileReader();
        return new Promise((resolve) => {
          reader.onloadend = () => {
            const base64data = reader.result as string;
            // Stocker dans le localStorage pour un accès plus rapide
            localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, base64data);
            console.log(`PDF récupéré depuis Supabase (${bucketName}/${path}) et stocké dans localStorage`);
            resolve(base64data);
          };
          reader.readAsDataURL(data);
        });
      }
    } catch (innerError) {
      console.warn(`Chemin ${bucketName}/${path} non trouvé:`, innerError);
      // Continuer avec le prochain chemin
    }
  }
  
  return null;
};

/**
 * Generate an empty PDF as a base64 string
 * @returns A base64 string of an empty PDF
 */
const generateEmptyPdf = async (): Promise<string> => {
  try {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([595, 842]); // A4 size
    
    const pdfBytes = await pdfDoc.save();
    const base64 = btoa(
      Array.from(new Uint8Array(pdfBytes))
        .map(byte => String.fromCharCode(byte))
        .join('')
    );
    
    return `data:application/pdf;base64,${base64}`;
  } catch (error) {
    console.error('Erreur lors de la génération du PDF vide:', error);
    throw error;
  }
};

/**
 * Stocke un PDF dans le stockage local et Supabase
 * @param filename Nom du fichier (sans chemin)
 * @param content Contenu du fichier en base64
 * @param isGenerated Indique s'il s'agit d'un PDF généré ou d'un modèle
 */
export const storePdf = async (filename: string, content: string, isGenerated = false): Promise<boolean> => {
  const normalizedPath = normalizeFilePath(filename);
  const fileHash = await calculatePdfHash(content);
  const fileSize = Math.ceil((content.length * 3) / 4); // Estimation de la taille en bytes
  
  // Stocker dans le localStorage
  localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, content);
  fileHashCache.set(normalizedPath, fileHash);
  console.log(`PDF stocké dans le localStorage: ${normalizedPath}`);
  
  // Déterminer le bucket approprié
  const bucketName = isGenerated || filename.startsWith('feuille_match_') ? GENERATED_BUCKET : TEMPLATES_BUCKET;
  
  // Si c'est un template, mettre à jour les métadonnées dans la base
  if (!isGenerated) {
    try {
      const { error: updateError } = await supabase
        .from('templates')
        .update({
          file_hash: fileHash,
          file_size: fileSize,
          mime_type: 'application/pdf'
        })
        .eq('file_url', `/templates/${normalizedPath}`);
      
      if (updateError) {
        console.warn('Erreur lors de la mise à jour des métadonnées du template:', updateError);
      }
    } catch (error) {
      console.warn('Exception lors de la mise à jour des métadonnées du template:', error);
    }
  }
  
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
      .from(bucketName)
      .upload(normalizedPath, blob, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (error) {
      console.warn(`Erreur lors du stockage dans ${bucketName}:`, error.message);
      
      if (error.message.includes('violates row-level security policy') || 
          error.message.includes('Bucket not found')) {
        console.warn(`Problème d'accès au bucket ${bucketName}. PDF stocké localement uniquement.`);
      }
      
      return true; // Succès car stocké localement
    }
    
    console.log(`PDF stocké avec succès dans Supabase (${bucketName}/${normalizedPath})`);
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
    // Essayer de supprimer de chaque bucket
    for (const bucket of [TEMPLATES_BUCKET, GENERATED_BUCKET]) {
      try {
        const { error } = await supabase.storage
          .from(bucket)
          .remove([normalizedPath]);
          
        if (!error) {
          console.log(`PDF supprimé avec succès de Supabase (${bucket}/${normalizedPath})`);
        } else {
          console.warn(`Erreur lors de la suppression du PDF de ${bucket}:`, error.message);
        }
      } catch (error) {
        console.warn(`Erreur lors de la suppression du PDF de ${bucket}:`, error);
      }
    }
    
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
  // Try to find PDFs in localStorage first
  const localPdfs = Object.keys(localStorage)
    .filter(key => key.startsWith(PDF_STORAGE_PREFIX))
    .map(key => key.replace(PDF_STORAGE_PREFIX, ''));
  
  if (localPdfs.length > 0) {
    console.log(`${localPdfs.length} PDFs trouvés dans le localStorage`);
    return localPdfs;
  }
  
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    return [];
  }
  
  try {
    // Try to list files in each bucket
    let allFiles: string[] = [];
    
    for (const bucketName of [TEMPLATES_BUCKET, GENERATED_BUCKET]) {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .list('');
        
        if (error) {
          console.warn(`Erreur lors de la liste des fichiers dans ${bucketName}:`, error.message);
          continue;
        }
        
        if (data) {
          const pdfFiles = data
            .filter(file => file.name.toLowerCase().endsWith('.pdf'))
            .map(file => file.name);
          allFiles.push(...pdfFiles);
        }
      } catch (error) {
        console.warn(`Erreur lors de la liste des fichiers dans ${bucketName}:`, error);
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
export const getPublicUrl = (filename: string): string => {
  const normalizedPath = normalizeFilePath(filename);
  
  // Déterminer le bucket à utiliser en fonction du préfixe
  const isGenerated = normalizedPath.startsWith('feuille_match_');
  const bucketName = isGenerated ? GENERATED_BUCKET : TEMPLATES_BUCKET;
  
  try {
    const { data } = supabase.storage
      .from(bucketName)
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