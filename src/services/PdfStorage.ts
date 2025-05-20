/**
 * Service de gestion des fichiers PDF
 * Ce service gère le stockage et la récupération des fichiers PDF
 */

import { PDFDocument, PDFField, PDFForm } from 'pdf-lib';
import { supabase, TEMPLATES_BUCKET, GENERATED_BUCKET } from './SupabaseClient';

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
  
  // Éviter les duplications de dossiers dans le chemin
  // Par exemple, éviter modeles/modeles/file.pdf
  const segments = normalized.split('/');
  if (segments.length > 1 && segments[0] === segments[1]) {
    segments.shift(); // Supprimer le premier segment dupliqué
    normalized = segments.join('/');
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
    
    // Vérifier si les buckets existent avant de continuer
    try {
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.warn(`Erreur lors de la vérification des buckets: ${bucketError.message}`);
      } else {
        const templateBucketExists = buckets?.some(b => b.name === TEMPLATES_BUCKET);
        const generatedBucketExists = buckets?.some(b => b.name === GENERATED_BUCKET);
        
        console.log(`Bucket "${TEMPLATES_BUCKET}" existe: ${templateBucketExists ? 'Oui' : 'Non'}`);
        console.log(`Bucket "${GENERATED_BUCKET}" existe: ${generatedBucketExists ? 'Oui' : 'Non'}`);
        
        if (!templateBucketExists || !generatedBucketExists) {
          console.warn(`Un ou plusieurs buckets nécessaires n'existent pas, création en cours...`);
          
          // Créer les buckets manquants
          if (!templateBucketExists) {
            const { error } = await supabase.storage.createBucket(TEMPLATES_BUCKET, { public: true });
            if (error) console.warn(`Erreur lors de la création du bucket ${TEMPLATES_BUCKET}:`, error);
            else console.log(`Bucket ${TEMPLATES_BUCKET} créé avec succès`);
          }
          
          if (!generatedBucketExists) {
            const { error } = await supabase.storage.createBucket(GENERATED_BUCKET, { public: true });
            if (error) console.warn(`Erreur lors de la création du bucket ${GENERATED_BUCKET}:`, error);
            else console.log(`Bucket ${GENERATED_BUCKET} créé avec succès`);
          }
        }
      }
    } catch (bucketError) {
      console.warn('Erreur lors de la vérification/création des buckets:', bucketError);
    }
    
    // Déterminer le bucket à utiliser en fonction du préfixe ou du path
    const isGenerated = normalizedPath.startsWith('feuille_match_') || 
                       filename.includes('generated_pdfs');
    const bucketName = isGenerated ? GENERATED_BUCKET : TEMPLATES_BUCKET;
    
    // Définir tous les chemins possibles
    // Inclut le chemin original, et des variations avec des préfixes courants
    const possiblePaths = [
      normalizedPath,                                       // Chemin tel quel
      `templates/${normalizedPath.split('/').pop()}`,       // Dans dossier templates
      `modeles/${normalizedPath.split('/').pop()}`,         // Dans dossier modeles
      `${normalizedPath.split('/').pop()}`,                 // Juste le nom du fichier
    ];
    
    // Éviter les doublons dans les chemins (ex: modeles/modeles/...)
    const uniquePaths = [...new Set(possiblePaths)];
    
    console.log(`Recherche du PDF dans le bucket ${bucketName} avec les chemins:`, uniquePaths);
    
    // Essayer chaque chemin possible jusqu'à ce qu'un fonctionne
    for (const path of uniquePaths) {
      console.log(`Essai du chemin: ${path}`);
      
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .download(path);
          
        if (error) {
          console.warn(`Erreur lors de la récupération du PDF (${bucketName}/${path}):`, error);
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
    
    // Si aucun chemin n'a fonctionné, essayer dans l'autre bucket
    const alternateBucket = isGenerated ? TEMPLATES_BUCKET : GENERATED_BUCKET;
    console.log(`PDF non trouvé dans ${bucketName}, tentative dans ${alternateBucket}`);
    
    for (const path of uniquePaths) {
      try {
        const { data, error } = await supabase.storage
          .from(alternateBucket)
          .download(path);
          
        if (error) {
          console.warn(`Erreur lors de la récupération du PDF (${alternateBucket}/${path}):`, error);
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
              console.log(`PDF récupéré depuis Supabase (${alternateBucket}/${path}) et stocké dans localStorage`);
              resolve(base64data);
            };
            reader.readAsDataURL(data);
          });
        }
      } catch (innerError) {
        console.warn(`Chemin ${alternateBucket}/${path} non trouvé:`, innerError);
        // Continuer avec le prochain chemin
      }
    }
    
    // Si aucun chemin n'a fonctionné dans aucun des buckets
    const errorMsg = `PDF non trouvé dans Supabase, chemins essayés dans les buckets ${TEMPLATES_BUCKET} et ${GENERATED_BUCKET}`;
    console.error(errorMsg);
    throw new Error(`Fichier PDF non trouvé: ${normalizedPath}`);
  } catch (error) {
    console.error('Erreur lors de la récupération du PDF:', error);
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
  
  // Stocker dans le localStorage
  localStorage.setItem(`${PDF_STORAGE_PREFIX}${normalizedPath}`, content);
  console.log(`PDF stocké dans le localStorage: ${normalizedPath}`);
  
  // Déterminer le bucket approprié
  const bucketName = isGenerated || filename.startsWith('feuille_match_') ? GENERATED_BUCKET : TEMPLATES_BUCKET;
  
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
    
    // S'assurer que le bucket existe
    try {
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      
      if (bucketError) {
        console.warn(`Erreur lors de la vérification des buckets: ${bucketError.message}`);
      }
      
      const bucketExists = buckets?.some(b => b.name === bucketName);
      
      if (!bucketExists) {
        console.log(`Le bucket ${bucketName} n'existe pas, tentative de création...`);
        const { error } = await supabase.storage.createBucket(bucketName, {
          public: true
        });
        
        if (error) {
          console.warn(`Erreur lors de la création du bucket ${bucketName}:`, error);
        } else {
          console.log(`Bucket ${bucketName} créé avec succès`);
        }
      }
    } catch (error) {
      console.warn(`Erreur lors de la vérification/création du bucket ${bucketName}:`, error);
      // Continuer quand même, en cas d'erreur de permissions
    }
    
    // Uploader vers Supabase
    const { error } = await supabase.storage
      .from(bucketName)
      .upload(normalizedPath, blob, {
        contentType: 'application/pdf',
        upsert: true
      });
    
    if (error) {
      console.error(`Erreur lors du stockage dans ${bucketName}:`, error);
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
          console.warn(`Erreur lors de la suppression du PDF de ${bucket}:`, error);
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
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) {
    return [];
  }
  
  try {
    // Vérifier l'existence des buckets
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.warn('Erreur lors de la liste des buckets:', bucketError);
      return [];
    }
    
    const templateBucketExists = buckets?.some(b => b.name === TEMPLATES_BUCKET);
    
    if (!templateBucketExists) {
      console.warn(`Le bucket ${TEMPLATES_BUCKET} n'existe pas pour la liste des PDFs`);
      return [];
    }
    
    // Lister les fichiers à la racine et dans les sous-dossiers possibles
    const paths = ['', 'templates/', 'modeles/'];
    const allFiles: string[] = [];
    
    for (const path of paths) {
      try {
        const { data, error } = await supabase.storage
          .from(TEMPLATES_BUCKET)
          .list(path);
        
        if (error) {
          console.warn(`Erreur lors de la liste des fichiers dans ${TEMPLATES_BUCKET}/${path}:`, error);
          continue;
        }
        
        if (data) {
          const pdfFiles = data
            .filter(file => file.name.toLowerCase().endsWith('.pdf'))
            .map(file => path + file.name);
          allFiles.push(...pdfFiles);
        }
      } catch (error) {
        console.warn(`Erreur lors de la liste des fichiers dans ${TEMPLATES_BUCKET}/${path}:`, error);
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