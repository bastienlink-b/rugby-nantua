import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit, Trash2, FileText, X, Tag, Upload, Shield, ShieldCheck, Loader, Scan, AlertTriangle, Check, Eye, RefreshCw, CloudOff } from 'lucide-react';
import { cleanPdfFormFields, storePdf, removePdf, listPdfs, getPublicUrl, getPdf } from '../services/PdfStorage';
import { extractTextFromPdf, analyzePdfStructure, PdfFieldMapping, savePdfAnalysis, getSavedPdfAnalysis, hasAnalysis } from '../services/MistralApiService';
import { initializeStorage } from '../services/SupabaseClient';

interface TemplateFormData {
  name: string;
  description: string;
  fileUrl: string;
  ageCategoryIds: string[]; // Changé de ageCategoryId à ageCategoryIds (array)
  fieldMappings?: PdfFieldMapping[];
}

const initialFormData: TemplateFormData = {
  name: '',
  description: '',
  fileUrl: '',
  ageCategoryIds: [], // Changé de ageCategoryId à ageCategoryIds (array vide)
  fieldMappings: [],
};

const Templates: React.FC = () => {
  const { templates, ageCategories, addTemplate, updateTemplate, deleteTemplate } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [fileUploadStatus, setFileUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [cleanFields, setCleanFields] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // État pour l'analyse OCR
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'extracting' | 'analyzing' | 'success' | 'error'>('idle');
  const [extractedText, setExtractedText] = useState<string>('');
  const [analyzedFields, setAnalyzedFields] = useState<PdfFieldMapping[]>([]);
  const [showMappingEditor, setShowMappingEditor] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // État pour Supabase Storage
  const [isSyncingWithCloud, setSyncingWithCloud] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);

  // Sort age categories from youngest to oldest (M6, M8, M10, etc.)
  const sortedAgeCategories = [...ageCategories].sort((a, b) => {
    // Extract the numeric part from the category name (e.g., "M6" -> 6)
    const getAgeNumber = (name: string) => {
      const match = name.match(/M(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const ageA = getAgeNumber(a.name);
    const ageB = getAgeNumber(b.name);
    
    return ageA - ageB; // Sort from youngest to oldest
  });

  // Initialiser Supabase Storage au chargement du composant
  useEffect(() => {
    initializeStorage().catch(error => {
      console.warn('Erreur d\'initialisation de Supabase Storage:', error);
      setCloudSyncError('Impossible de se connecter au stockage cloud. Utilisation du stockage local uniquement.');
    });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  // Nouvelle fonction pour gérer la sélection multiple des catégories
  const handleCategoryToggle = (categoryId: string) => {
    setFormData(prev => {
      const categoryIds = [...prev.ageCategoryIds];
      const index = categoryIds.indexOf(categoryId);
      
      if (index === -1) {
        categoryIds.push(categoryId);
      } else {
        categoryIds.splice(index, 1);
      }
      
      return {
        ...prev,
        ageCategoryIds: categoryIds,
      };
    });
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingTemplateId(null);
    setFileUploadStatus('idle');
    setUploadedFileName('');
    setCleanFields(true);
    setOcrStatus('idle');
    setExtractedText('');
    setAnalyzedFields([]);
    setShowMappingEditor(false);
    setAnalysisError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's a PDF
    if (file.type !== 'application/pdf') {
      alert('Seuls les fichiers PDF sont acceptés.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La taille du fichier ne doit pas dépasser 5MB.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setFileUploadStatus('uploading');
    
    // Create a unique file name
    const fileName = `template_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    setUploadedFileName(fileName);
    
    // Read the file
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (event.target?.result) {
          let fileContent = event.target.result as string;
          
          // Clean PDF fields if option is selected
          if (cleanFields) {
            setFileUploadStatus('processing');
            try {
              fileContent = await cleanPdfFormFields(fileContent);
            } catch (error) {
              console.error('Erreur lors du nettoyage des champs du PDF:', error);
              // Nous continuons avec le fichier original en cas d'erreur
            }
          }
          
          // Stocker dans le localStorage et dans Supabase
          const uploadSuccess = await storePdf(fileName, fileContent);
          
          if (!uploadSuccess) {
            console.warn('Le fichier a été stocké localement, mais pas dans Supabase. Il sera synchronisé plus tard.');
          }
          
          // Set the file URL
          const fileUrl = `/templates/${fileName}`;
          setFormData({
            ...formData,
            fileUrl,
          });
          
          setFileUploadStatus('success');
        }
      } catch (error) {
        console.error('Error storing file:', error);
        setFileUploadStatus('error');
      }
    };
    
    reader.onerror = () => {
      setFileUploadStatus('error');
    };
    
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.ageCategoryIds.length === 0) {
      alert("Veuillez sélectionner au moins une catégorie d'âge.");
      return;
    }
    
    if (editingTemplateId) {
      updateTemplate(editingTemplateId, { ...formData, id: editingTemplateId });
    } else {
      addTemplate(formData);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (template: Omit<TemplateFormData, 'ageCategoryIds'> & { id: string, ageCategoryId?: string, ageCategoryIds?: string[], fieldMappings?: PdfFieldMapping[] }) => {
    // Gestion de la compatibilité avec les anciens modèles qui utilisent ageCategoryId
    const categoryIds = template.ageCategoryIds || (template.ageCategoryId ? [template.ageCategoryId] : []);
    
    setFormData({
      name: template.name,
      description: template.description || '',
      fileUrl: template.fileUrl,
      ageCategoryIds: categoryIds,
      fieldMappings: template.fieldMappings || [],
    });
    setEditingTemplateId(template.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce modèle ?')) {
      return;
    }
    
    const template = templates.find(t => t.id === id);
    if (template) {
      // Extraire le nom du fichier depuis l'URL
      const filename = template.fileUrl.split('/').pop();
      
      if (filename) {
        try {
          // Supprimer le fichier du localStorage et de Supabase
          await removePdf(filename);
        } catch (error) {
          console.error('Erreur lors de la suppression du fichier:', error);
        }
      }
    }
    
    deleteTemplate(id);
  };

  // Tri des templates par nom alphabétique
  const sortedTemplates = [...templates].sort((a, b) => 
    a.name.localeCompare(b.name, 'fr-FR')
  );

  const filteredTemplates = sortedTemplates.filter(template => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Gestion de la compatibilité avec les anciens templates
    const templateCategories = template.ageCategoryIds || [template.ageCategoryId].filter(Boolean);
    
    const matchesCategory = selectedCategory 
      ? templateCategories.includes(selectedCategory)
      : true;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryNames = (categoryIds: string[] | string) => {
    // Si c'est un string, on le convertit en array pour la compatibilité
    const ids = Array.isArray(categoryIds) ? categoryIds : [categoryIds].filter(Boolean);
    
    return ids
      .map(id => ageCategories.find(cat => cat.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0;
        
        // Extraire le numéro de la catégorie (ex: M6 -> 6)
        const getAgeNumber = (name: string) => {
          const match = name.match(/M(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        };
        
        const ageA = getAgeNumber(a.name);
        const ageB = getAgeNumber(b.name);
        
        return ageA - ageB;
      })
      .map(cat => cat?.name || 'Non définie')
      .join(', ');
  };

  // Fonction modifiée pour analyser le PDF avec Mistral OCR et utiliser les analyses sauvegardées
  const analyzePdf = async () => {
    if (!formData.fileUrl) {
      setAnalysisError("Aucun fichier PDF n'a été sélectionné");
      return;
    }

    try {
      setOcrStatus('extracting');
      setAnalysisError(null);

      // Récupérer le nom du fichier depuis l'URL
      const fileName = formData.fileUrl.split('/').pop();
      if (!fileName) {
        throw new Error("Nom de fichier invalide");
      }
      
      // Vérifier si une analyse existante est disponible
      const existingAnalysis = getSavedPdfAnalysis(fileName);
      
      if (existingAnalysis) {
        console.log(`Utilisation de l'analyse existante pour ${fileName}`);
        setAnalyzedFields(existingAnalysis);
        setFormData({
          ...formData,
          fieldMappings: existingAnalysis,
        });
        setOcrStatus('success');
        setShowMappingEditor(true);
        return;
      }
      
      console.log(`Aucune analyse existante trouvée pour ${fileName}. Analyse en cours...`);
      
      const pdfData = await getPdf(fileName);
      if (!pdfData) {
        throw new Error("Fichier PDF non trouvé dans le stockage");
      }
      
      try {
        // Utiliser directement les données PDF au lieu d'une URL
        const extractedText = await extractTextFromPdf(pdfData);
        setExtractedText(extractedText);
        
        // Analyse des champs du PDF
        setOcrStatus('analyzing');
        const mappings = await analyzePdfStructure(extractedText);
        
        // Sauvegarder l'analyse pour utilisation future
        savePdfAnalysis(fileName, mappings);
        
        setAnalyzedFields(mappings);
        setFormData({
          ...formData,
          fieldMappings: mappings,
        });
        
        setOcrStatus('success');
        setShowMappingEditor(true);
      } catch (error: any) {
        console.error('Erreur lors de l\'analyse du PDF', error);
        setOcrStatus('error');
        setAnalysisError(error.message || "Erreur lors de l'analyse du PDF");
      }
    } catch (error: any) {
      setOcrStatus('error');
      setAnalysisError(error.message || "Erreur lors de l'analyse du PDF");
    }
  };

  // Mise à jour du mapping des champs
  const updateFieldMapping = (index: number, field: Partial<PdfFieldMapping>) => {
    if (!formData.fieldMappings) return;
    
    const newMappings = [...formData.fieldMappings];
    newMappings[index] = { ...newMappings[index], ...field };
    
    setFormData({
      ...formData,
      fieldMappings: newMappings,
    });
    setAnalyzedFields(newMappings);
  };

  // Supprime un champ du mapping
  const removeFieldMapping = (index: number) => {
    if (!formData.fieldMappings) return;
    
    const newMappings = formData.fieldMappings.filter((_, i) => i !== index);
    
    setFormData({
      ...formData,
      fieldMappings: newMappings,
    });
    setAnalyzedFields(newMappings);
  };

  // Ajoute un nouveau champ au mapping
  const addFieldMapping = () => {
    const newField: PdfFieldMapping = {
      champ_pdf: '',
      type: 'autre',
      mapping: '',
    };
    
    const newMappings = formData.fieldMappings ? [...formData.fieldMappings, newField] : [newField];
    
    setFormData({
      ...formData,
      fieldMappings: newMappings,
    });
    setAnalyzedFields(newMappings);
  };
  
  // Synchronise les modèles depuis Supabase Storage
  const syncWithCloudStorage = async () => {
    setSyncingWithCloud(true);
    setCloudSyncError(null);
    
    try {
      // Récupérer la liste des fichiers de Supabase
      const pdfs = await listPdfs();
      
      if (pdfs.length === 0) {
        setCloudSyncError("Aucun fichier trouvé dans le stockage cloud ou accès non autorisé.");
        setSyncingWithCloud(false);
        return;
      }
      
      // Pour chaque fichier, mettre à jour son URL et l'ajouter à la liste des templates
      // s'il n'existe pas déjà
      let newTemplatesCount = 0;
      for (const pdfName of pdfs) {
        // Vérifier si un template avec ce fichier existe déjà
        const exists = templates.some(template => 
          template.fileUrl === `/templates/${pdfName}` || 
          template.fileUrl === getPublicUrl(pdfName)
        );
        
        if (!exists) {
          // Créer un nouveau template avec des valeurs par défaut
          const newTemplate = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
            name: `Template importé - ${pdfName.replace(/^template_\d+_/, '').replace(/_/g, ' ').replace(/\.pdf$/i, '')}`,
            description: "Importé depuis le stockage cloud",
            fileUrl: `/templates/${pdfName}`,
            ageCategoryIds: [], // L'utilisateur devra spécifier les catégories
            fieldMappings: []
          };
          
          addTemplate(newTemplate);
          newTemplatesCount++;
        }
      }
      
      // Afficher un message de succès
      if (newTemplatesCount > 0) {
        alert(`${newTemplatesCount} nouveaux modèles ont été importés depuis le stockage cloud.`);
      } else {
        alert("Tous les modèles sont déjà à jour.");
      }
    } catch (error: any) {
      console.error('Erreur lors de la synchronisation avec le cloud:', error);
      setCloudSyncError(error.message || "Erreur lors de la synchronisation avec le stockage cloud.");
    } finally {
      setSyncingWithCloud(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modèles de Feuilles de Match</h1>
          <p className="text-gray-600 mt-1">
            Gérez les modèles de feuilles de match par catégorie
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={syncWithCloudStorage}
            disabled={isSyncingWithCloud}
            className={`bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md flex items-center ${
              isSyncingWithCloud ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isSyncingWithCloud ? (
              <Loader size={18} className="mr-1 animate-spin" />
            ) : (
              <RefreshCw size={18} className="mr-1" />
            )}
            <span>Synchroniser</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <Plus size={18} className="mr-1" />
            <span>Nouveau modèle</span>
          </button>
        </div>
      </div>
      
      {cloudSyncError && (
        <div className="mb-4 bg-yellow-50 border border-yellow-100 p-3 rounded-md flex items-center">
          <CloudOff size={18} className="text-yellow-500 mr-2 flex-shrink-0" />
          <p className="text-sm text-yellow-600">{cloudSyncError}</p>
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un modèle..."
            className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-1/4">
          <select
            className="w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="">Toutes catégories</option>
            {sortedAgeCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {template.name}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(template)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="mb-3 flex flex-wrap gap-1">
                  {/* Gestion des anciennes et nouvelles structures pour les catégories */}
                  {(template.ageCategoryIds || [template.ageCategoryId].filter(Boolean)).map((categoryId, index) => (
                    <span 
                      key={`${template.id}-cat-${categoryId || index}`} 
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {ageCategories.find(cat => cat.id === categoryId)?.name || 'Non définie'}
                    </span>
                  ))}
                </div>
                
                <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                  {template.description || "Pas de description"}
                </p>
                
                <div className="mt-3 flex justify-between items-center">
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText size={16} className="mr-1" />
                    <span className="truncate max-w-[150px]">{template.fileUrl.split('/').pop()}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {template.fieldMappings && template.fieldMappings.length > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Check size={12} className="mr-1" />
                        Analysé
                      </span>
                    )}
                    <a 
                      href={template.fileUrl} 
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Aperçu
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <FileText size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun modèle trouvé</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm || selectedCategory
              ? "Aucun modèle ne correspond aux critères de recherche."
              : "Commencez par ajouter votre premier modèle de feuille de match."}
          </p>
          {!searchTerm && !selectedCategory && (
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={18} className="mr-2" />
              Ajouter un modèle
            </button>
          )}
        </div>
      )}

      {/* Modal avec modifications pour être responsive et avoir des cases à cocher pour les catégories */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-auto overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingTemplateId ? 'Modifier le modèle' : 'Ajouter un modèle'}
              </h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="max-h-[calc(100vh-160px)] overflow-y-auto">
              {/* Éditeur de mapping */}
              {showMappingEditor ? (
                <div className="p-4">
                  <div className="mb-4 flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Champs détectés</h3>
                    <button
                      onClick={() => setShowMappingEditor(false)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Retour
                    </button>
                  </div>

                  {analyzedFields.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600">
                        Validez le mapping des champs et corrigez-le si nécessaire.
                      </p>
                      
                      <div className="overflow-y-auto max-h-96 border border-gray-200 rounded-md p-3">
                        {analyzedFields.map((field, index) => (
                          <div key={index} className="p-3 border-b border-gray-100 last:border-0">
                            <div className="flex justify-between items-center mb-2">
                              <div className="font-medium text-sm">{field.champ_pdf}</div>
                              <button
                                onClick={() => removeFieldMapping(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Type</label>
                                <select
                                  value={field.type}
                                  onChange={(e) => updateFieldMapping(index, { type: e.target.value as any })}
                                  className="w-full text-sm border border-gray-300 rounded-md py-1 px-2"
                                >
                                  <option value="joueur">Joueur</option>
                                  <option value="educateur">Éducateur</option>
                                  <option value="global">Global</option>
                                  <option value="autre">Autre</option>
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Mapping</label>
                                <input
                                  type="text"
                                  value={field.mapping}
                                  onChange={(e) => updateFieldMapping(index, { mapping: e.target.value })}
                                  className="w-full text-sm border border-gray-300 rounded-md py-1 px-2"
                                  placeholder="ex: joueur.nom"
                                />
                              </div>
                            </div>
                            {field.valeur_possible && field.valeur_possible.length > 0 && (
                              <div className="mt-1">
                                <label className="block text-xs text-gray-500 mb-1">Valeurs possibles</label>
                                <div className="flex flex-wrap gap-1">
                                  {field.valeur_possible.map((val, i) => (
                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-800">
                                      {val}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div className="flex justify-between">
                        <button
                          type="button"
                          onClick={addFieldMapping}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 flex items-center"
                        >
                          <Plus size={14} className="mr-1" />
                          Ajouter un champ
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowMappingEditor(false);
                          }}
                          className="px-3 py-1 text-sm border border-transparent rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                        >
                          Confirmer le mapping
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle size={32} className="mx-auto text-amber-500 mb-2" />
                      <p className="text-gray-600">Aucun champ n'a été détecté ou l'analyse a échoué.</p>
                      <button
                        onClick={() => setShowMappingEditor(false)}
                        className="mt-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Retour
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-4">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nom du modèle
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Feuille de match M14 standard"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={2}
                        className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Brève description du modèle"
                      />
                    </div>

                    <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cleanFields}
                          onChange={(e) => setCleanFields(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="ml-3">
                          <span className="text-sm font-medium text-gray-700 flex items-center">
                            <ShieldCheck size={16} className="mr-1 text-green-600" />
                            Nettoyer les données des modèles
                          </span>
                          <p className="text-xs text-gray-500 mt-1">
                            Efface automatiquement les données pré-remplies (joueurs, entraîneurs, tournois, lieux, dates) du PDF
                          </p>
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fichier PDF
                      </label>
                      <div className="mt-1 space-y-2">
                        <div className="flex items-center justify-center w-full">
                          <label className="flex flex-col w-full h-28 border-2 border-dashed border-gray-300 rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors cursor-pointer">
                            <div className="flex flex-col items-center justify-center pt-3">
                              <Upload className="w-8 h-8 text-gray-400" />
                              <p className="pt-1 text-sm text-gray-600">
                                {fileUploadStatus === 'idle' && "Cliquez pour sélectionner un fichier PDF"}
                                {fileUploadStatus === 'uploading' && "Chargement du fichier..."}
                                {fileUploadStatus === 'processing' && "Nettoyage des données du PDF..."}
                                {fileUploadStatus === 'success' && `Fichier chargé: ${uploadedFileName}`}
                                {fileUploadStatus === 'error' && "Erreur lors du chargement du fichier"}
                              </p>
                              <p className="text-xs text-gray-500">PDF (MAX. 5MB)</p>
                            </div>
                            <input 
                              type="file" 
                              accept=".pdf" 
                              className="hidden" 
                              onChange={handleFileChange}
                              ref={fileInputRef}
                            />
                          </label>
                        </div>
                        
                        {fileUploadStatus === 'success' && (
                          <div className="flex flex-col space-y-2">
                            <div className="flex items-center justify-between bg-green-50 p-2 rounded-md">
                              <div className="flex items-center">
                                <FileText size={16} className="text-green-500 mr-2" />
                                <span className="text-sm text-green-700 truncate max-w-[200px]">{uploadedFileName}</span>
                              </div>
                              <button
                                type="button"
                                className="text-sm text-red-600 hover:text-red-800"
                                onClick={() => {
                                  setFileUploadStatus('idle');
                                  setUploadedFileName('');
                                  setFormData({
                                    ...formData,
                                    fileUrl: '',
                                  });
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                  }
                                }}
                              >
                                Supprimer
                              </button>
                            </div>
                            
                            {/* Bouton pour analyser le PDF */}
                            <button
                              type="button"
                              onClick={analyzePdf}
                              disabled={ocrStatus === 'extracting' || ocrStatus === 'analyzing'}
                              className={`flex items-center justify-center py-2 px-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                                ocrStatus === 'extracting' || ocrStatus === 'analyzing'
                                  ? 'bg-indigo-400 cursor-wait'
                                  : 'bg-indigo-600 hover:bg-indigo-700'
                              }`}
                            >
                              {(ocrStatus === 'extracting' || ocrStatus === 'analyzing') ? (
                                <>
                                  <Loader size={18} className="mr-2 animate-spin" />
                                  {ocrStatus === 'extracting' ? 'Extraction du texte...' : 'Analyse des champs...'}
                                </>
                              ) : (
                                <>
                                  <Scan size={18} className="mr-2" />
                                  Analyser le PDF avec Mistral OCR
                                </>
                              )}
                            </button>
                            
                            {ocrStatus === 'success' && (
                              <div className="bg-green-50 p-2 rounded-md flex items-center justify-between">
                                <div className="flex items-center">
                                  <Check size={16} className="text-green-500 mr-2" />
                                  <span className="text-sm text-green-700">
                                    {formData.fieldMappings?.length} champs détectés
                                    {hasAnalysis(uploadedFileName) ? 
                                      " (analyse sauvegardée)" : 
                                      " (nouvelle analyse)"}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setShowMappingEditor(true)}
                                  className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                                >
                                  <Eye size={14} className="mr-1" />
                                  Voir le mapping
                                </button>
                              </div>
                            )}
                            
                            {ocrStatus === 'error' && analysisError && (
                              <div className="bg-red-50 p-2 rounded-md flex items-center">
                                <AlertTriangle size={16} className="text-red-500 mr-2" />
                                <span className="text-sm text-red-700">{analysisError}</span>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {fileUploadStatus === 'error' && (
                          <div className="text-sm text-red-600 mt-1">
                            Une erreur s'est produite lors du chargement du fichier. Veuillez réessayer.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center">
                        <label className="block text-sm font-medium text-gray-700">
                          URL du fichier
                        </label>
                        <span className="text-xs text-gray-500">ou saisir l'URL manuellement</span>
                      </div>
                      <input
                        type="text"
                        name="fileUrl"
                        value={formData.fileUrl}
                        onChange={handleInputChange}
                        required
                        className="mt-1 w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: /templates/feuille-match-m14.pdf"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Catégories d'âge (au moins une)
                      </label>
                      <div className="mt-2 border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2">
                          {sortedAgeCategories.map((category) => (
                            <label key={category.id} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={formData.ageCategoryIds.includes(category.id)}
                                onChange={() => handleCategoryToggle(category.id)}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <span className="ml-2 text-sm text-gray-700 truncate">
                                {category.name} - {category.description}
                              </span>
                            </label>
                          ))}
                        </div>
                        {formData.ageCategoryIds.length === 0 && (
                          <p className="text-sm text-red-500 mt-1">
                            Veuillez sélectionner au moins une catégorie
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                        !formData.ageCategoryIds.length || !formData.fileUrl || ['uploading', 'processing'].includes(fileUploadStatus)
                        ? 'bg-blue-400 cursor-not-allowed' 
                        : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                      disabled={!formData.ageCategoryIds.length || !formData.fileUrl || ['uploading', 'processing'].includes(fileUploadStatus)}
                    >
                      {editingTemplateId ? 'Mettre à jour' : 'Ajouter'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;