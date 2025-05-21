import React, { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit, Trash2, FileText, Upload, Check, X, Info, HelpCircle, Eye, AlertCircle, BarChart, PlusCircle, MinusCircle, Save, Loader } from 'lucide-react';
import PdfViewer from '../components/PdfViewer';
import { getPublicUrl, storePdf } from '../services/PdfStorage';
import { extractTextFromPdf, analyzePdfStructure, PdfFieldMapping, hasAnalysis, getSavedPdfAnalysis, savePdfAnalysis } from '../services/MistralApiService';

interface TemplateFormData {
  id?: string;
  name: string;
  description: string;
  fileUrl: string;
  ageCategoryIds: string[];
  file?: File | null;
  fieldMappings?: PdfFieldMapping[];
}

const initialFormData: TemplateFormData = {
  name: '',
  description: '',
  fileUrl: '',
  ageCategoryIds: [],
  file: null,
  fieldMappings: [],
};

enum ModalType {
  None = 'none',
  AddEdit = 'addEdit',
  Preview = 'preview',
  FieldMapping = 'fieldMapping',
  Analysis = 'analysis',
  Help = 'help'
}

const MappingFieldTypes = [
  { value: 'global', label: 'Global', description: 'Informations générales (date, lieu, etc.)' },
  { value: 'joueur', label: 'Joueur', description: 'Informations sur un joueur' },
  { value: 'educateur', label: 'Éducateur', description: 'Informations sur un entraîneur/éducateur' },
  { value: 'autre', label: 'Autre', description: 'Autres types d\'informations' },
];

const Templates: React.FC = () => {
  const { templates, ageCategories, addTemplate, updateTemplate, deleteTemplate } = useAppContext();
  const [modalType, setModalType] = useState<ModalType>(ModalType.None);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResults, setAnalysisResults] = useState<{extractedText: string, mappings: PdfFieldMapping[]}>({
    extractedText: '',
    mappings: []
  });
  const [editingMappingIndex, setEditingMappingIndex] = useState<number | null>(null);
  const [newMapping, setNewMapping] = useState<PdfFieldMapping>({
    champ_pdf: '',
    type: 'global',
    mapping: ''
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      setFormData({
        ...formData,
        file: files[0],
        // Use a temporary URL for preview, but don't set fileUrl yet
        // fileUrl will be set after upload during form submission
      });
    }
  };

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
    setSelectedTemplate(null);
    setPdfUrl(null);
    setErrorMessage(null);
    setIsAnalyzing(false);
    setAnalysisResults({
      extractedText: '',
      mappings: []
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one category is selected
    if (formData.ageCategoryIds.length === 0) {
      alert("Veuillez sélectionner au moins une catégorie d'âge.");
      return;
    }
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      let fileUrl = formData.fileUrl;
      
      // If a new file was selected, upload it
      if (formData.file) {
        const fileName = formData.file.name;
        const reader = new FileReader();
        
        // Read file as data URL and upload
        const fileDataPromise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const dataUrl = reader.result as string;
            resolve(dataUrl);
          };
          reader.onerror = reject;
          reader.readAsDataURL(formData.file as File);
        });
        
        const dataUrl = await fileDataPromise;
        
        // Store the PDF in Supabase or locally
        const uploaded = await storePdf(fileName, dataUrl);
        if (uploaded) {
          fileUrl = `/templates/${fileName}`;
          console.log(`File uploaded successfully: ${fileUrl}`);
        } else {
          throw new Error("Failed to upload PDF file");
        }
      }
      
      // Create or update template
      const templateData = {
        name: formData.name,
        description: formData.description,
        fileUrl: fileUrl,
        ageCategoryIds: formData.ageCategoryIds,
        fieldMappings: formData.fieldMappings || [],
      };
      
      if (formData.id) {
        await updateTemplate(formData.id, templateData);
        console.log("Template updated successfully");
      } else {
        await addTemplate(templateData);
        console.log("Template added successfully");
        
        // Automatically analyze the new template's PDF
        if (fileUrl) {
          setTimeout(() => {
            analyzePdf(fileUrl, templateData.name);
          }, 500);
        }
      }
      
      // Close modal and reset form
      setModalType(ModalType.None);
      resetForm();
    } catch (error) {
      console.error("Error submitting template:", error);
      setErrorMessage(`Erreur: ${error instanceof Error ? error.message : 'Une erreur est survenue'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (template: any) => {
    setFormData({
      id: template.id,
      name: template.name,
      description: template.description || '',
      fileUrl: template.fileUrl,
      ageCategoryIds: template.ageCategoryIds,
      fieldMappings: template.fieldMappings || [],
    });
    setSelectedTemplate(template.id);
    setModalType(ModalType.AddEdit);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce modèle ?')) {
      deleteTemplate(id);
    }
  };

  const handlePreview = (template: any) => {
    setFormData({
      id: template.id,
      name: template.name,
      description: template.description || '',
      fileUrl: template.fileUrl,
      ageCategoryIds: template.ageCategoryIds,
      fieldMappings: template.fieldMappings || [],
    });
    setSelectedTemplate(template.id);
    setPdfUrl(template.fileUrl);
    setModalType(ModalType.Preview);
  };

  const handleEditMapping = (index: number) => {
    setEditingMappingIndex(index);
    const mapping = formData.fieldMappings?.[index] || {
      champ_pdf: '',
      type: 'global',
      mapping: ''
    };
    setNewMapping({ ...mapping });
  };

  const handleDeleteMapping = (index: number) => {
    const updatedMappings = formData.fieldMappings?.filter((_, i) => i !== index) || [];
    setFormData({
      ...formData,
      fieldMappings: updatedMappings
    });
  };

  const handleAddMapping = () => {
    setEditingMappingIndex(null);
    setNewMapping({
      champ_pdf: '',
      type: 'global',
      mapping: ''
    });
    setModalType(ModalType.FieldMapping);
  };

  const handleSaveMapping = () => {
    // Validation
    if (!newMapping.champ_pdf || !newMapping.mapping) {
      alert("Veuillez remplir les champs obligatoires");
      return;
    }

    const updatedMappings = [...(formData.fieldMappings || [])];

    if (editingMappingIndex !== null) {
      // Update existing
      updatedMappings[editingMappingIndex] = newMapping;
    } else {
      // Add new
      updatedMappings.push(newMapping);
    }

    setFormData({
      ...formData,
      fieldMappings: updatedMappings
    });
    
    setEditingMappingIndex(null);
    setNewMapping({
      champ_pdf: '',
      type: 'global',
      mapping: ''
    });
    setModalType(ModalType.AddEdit);
  };

  const analyzePdf = async (pdfUrl: string, templateName: string) => {
    console.log(`Analyzing template: ${templateName}, URL: ${pdfUrl}`);
    setIsAnalyzing(true);
    setErrorMessage(null);
    setModalType(ModalType.Analysis);
    
    try {
      // Extract filename from URL
      const fileName = pdfUrl.split('/').pop();
      
      if (!fileName) {
        throw new Error('Nom de fichier invalide');
      }
      
      // Check if we have saved analysis
      if (hasAnalysis(fileName)) {
        console.log('Using saved analysis');
        const savedMappings = getSavedPdfAnalysis(fileName);
        
        if (savedMappings) {
          setAnalysisResults({
            extractedText: 'Texte chargé depuis l\'analyse précédente',
            mappings: savedMappings
          });
          
          // Update form data with mappings
          setFormData(prev => ({
            ...prev,
            fieldMappings: savedMappings
          }));
          
          setIsAnalyzing(false);
          return;
        }
      }
      
      // Get PDF data
      const pdfContent = await getPdfForAnalysis(pdfUrl);
      
      if (!pdfContent) {
        throw new Error('Impossible de récupérer le contenu du PDF');
      }
      
      // Step 1: Extract text from PDF using Mistral
      console.log('Extraction du texte du PDF...');
      const extractedText = await extractTextFromPdf(pdfContent);
      
      // Step 2: Analyze PDF structure based on extracted text
      console.log('Analyse de la structure du PDF...');
      const mappings = await analyzePdfStructure(extractedText);
      
      // Save analysis
      savePdfAnalysis(fileName, mappings);
      
      // Update UI
      setAnalysisResults({
        extractedText,
        mappings
      });
      
      // Update form data with mappings
      setFormData(prev => ({
        ...prev,
        fieldMappings: mappings
      }));
      
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      setErrorMessage(`Erreur d'analyse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to get PDF content for analysis
  const getPdfForAnalysis = async (url: string): Promise<string> => {
    // For remote URLs
    if (url.startsWith('http')) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (error) {
        console.error('Error fetching remote PDF:', error);
        throw new Error('Impossible de télécharger le PDF distant');
      }
    }
    
    // For local files (/templates/file.pdf)
    try {
      const fullUrl = getPublicUrl(url.split('/').pop() || '');
      if (fullUrl) {
        const response = await fetch(fullUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      throw new Error('URL non valide pour le PDF');
    } catch (error) {
      console.error('Error fetching local PDF:', error);
      throw new Error('Impossible de charger le PDF local');
    }
  };

  // Sort templates by name
  const sortedTemplates = [...templates].sort((a, b) => 
    a.name.localeCompare(b.name, 'fr-FR')
  );

  // Sort age categories by name with specific order (M6, M8, M10, etc.)
  const sortedCategories = [...ageCategories].sort((a, b) => {
    // Extract age numbers from category names
    const getAgeNumber = (name: string) => {
      const match = name.match(/M(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    return getAgeNumber(a.name) - getAgeNumber(b.name);
  });

  // Filter templates by search term
  const filteredTemplates = sortedTemplates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (template.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modèles</h1>
          <p className="text-gray-600 mt-1">
            Gérez les modèles de feuilles de match
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setModalType(ModalType.AddEdit);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        >
          <Plus size={18} className="mr-1" />
          <span>Nouveau modèle</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
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
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            // Get category names
            const categoryNames = template.ageCategoryIds
              .map(id => ageCategories.find(cat => cat.id === id)?.name || '')
              .filter(Boolean)
              .sort()
              .join(', ');

            // Check if template has field mappings
            const hasFieldMappings = template.fieldMappings && template.fieldMappings.length > 0;
              
            return (
              <div key={template.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {template.name}
                    </h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handlePreview(template)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Aperçu"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={() => handleEdit(template)}
                        className="text-indigo-600 hover:text-indigo-900"
                        title="Modifier"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Template filename */}
                  <div className="mt-2 flex items-center">
                    <FileText size={15} className="text-gray-400 mr-1.5 flex-shrink-0" />
                    <span className="text-sm text-gray-500 truncate">
                      {template.fileUrl.split('/').pop()}
                    </span>
                    
                    {/* Analysis status badge - moved below filename */}
                  </div>
                  
                  {/* Analysis badge */}
                  <div className="mt-1.5">
                    {hasFieldMappings ? (
                      <div className="flex">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Check size={12} className="mr-1" />
                          Analyse ({template.fieldMappings!.length} champs)
                        </span>
                        <button
                          onClick={() => analyzePdf(template.fileUrl, template.name)}
                          className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                          title="Relancer l'analyse"
                        >
                          Relancer
                        </button>
                      </div>
                    ) : (
                      <div className="flex">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <AlertCircle size={12} className="mr-1" />
                          Non analysé
                        </span>
                        <button
                          onClick={() => analyzePdf(template.fileUrl, template.name)}
                          className="ml-2 text-xs text-blue-600 hover:text-blue-800"
                          title="Analyser"
                        >
                          Analyser
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {template.description && (
                    <p className="mt-2 text-sm text-gray-600">{template.description}</p>
                  )}
                  
                  {categoryNames && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">Catégories: {categoryNames}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <FileText size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun modèle trouvé</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm
              ? "Aucun modèle ne correspond aux critères de recherche."
              : "Commencez par ajouter votre premier modèle de feuille de match."}
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                resetForm();
                setModalType(ModalType.AddEdit);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={18} className="mr-2" />
              Ajouter un modèle
            </button>
          )}
        </div>
      )}

      {/* Modal for Add/Edit */}
      {modalType === ModalType.AddEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto mt-10 overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {formData.id ? 'Modifier le modèle' : 'Ajouter un modèle'}
              </h3>
              <button
                onClick={() => {
                  setModalType(ModalType.None);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
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
                    placeholder="Ex: Tournoi M14 Standard"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (optionnelle)
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Description du modèle et de son utilisation"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fichier PDF
                    </label>
                    {formData.id ? (
                      <div className="flex items-center">
                        <FileText size={18} className="text-gray-500 mr-2" />
                        <span className="text-gray-600 text-sm truncate">
                          {formData.fileUrl.split('/').pop()}
                        </span>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="ml-3 px-3 py-1 text-xs border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Remplacer
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-gray-400 transition-colors">
                          <div className="space-y-1 text-center">
                            <Upload size={36} className="mx-auto text-gray-400" />
                            <div className="flex text-sm text-gray-600">
                              <label
                                htmlFor="file-upload"
                                className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500"
                              >
                                <span>Choisir un fichier</span>
                                <input
                                  id="file-upload"
                                  name="file"
                                  type="file"
                                  accept=".pdf"
                                  className="sr-only"
                                  ref={fileInputRef}
                                  onChange={handleFileChange}
                                  required={!formData.id}
                                />
                              </label>
                              <p className="pl-1">ou glissez-déposez</p>
                            </div>
                            <p className="text-xs text-gray-500">
                              PDF uniquement, 5 MB maximum
                            </p>
                          </div>
                        </div>
                        {formData.file && (
                          <div className="mt-2 flex items-center text-sm text-gray-600">
                            <FileText size={16} className="mr-1" />
                            {formData.file.name} ({Math.round(formData.file.size / 1024)} KB)
                          </div>
                        )}
                      </div>
                    )}
                    {/* Hidden file input for replacement */}
                    <input
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catégories d'âge
                    </label>
                    <div className="mt-1 space-y-2 border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                      {sortedCategories.map((category) => (
                        <label key={category.id} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.ageCategoryIds.includes(category.id)}
                            onChange={() => handleCategoryToggle(category.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">
                            {category.name} - {category.description}
                          </span>
                        </label>
                      ))}
                      {formData.ageCategoryIds.length === 0 && (
                        <p className="text-sm text-red-500">
                          Veuillez sélectionner au moins une catégorie
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Field Mappings Section */}
                <div className="mt-4 border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-md font-medium text-gray-900">Champs du modèle</h3>
                      <p className="text-sm text-gray-500">
                        Correspondances entre les champs du PDF et les données de l'application
                      </p>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => setModalType(ModalType.Help)}
                        className="text-gray-600 hover:text-gray-800"
                        title="Aide"
                      >
                        <HelpCircle size={18} />
                      </button>
                      
                      {formData.fileUrl && (
                        <button
                          type="button"
                          onClick={() => analyzePdf(formData.fileUrl, formData.name)}
                          className={`text-blue-600 hover:text-blue-800 flex items-center ${isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          disabled={isAnalyzing}
                          title="Analyser le PDF avec Mistral AI"
                        >
                          {isAnalyzing ? (
                            <>
                              <Loader size={18} className="mr-1 animate-spin" />
                              <span>Analyse...</span>
                            </>
                          ) : (
                            <>
                              <BarChart size={18} className="mr-1" />
                              <span>Analyser</span>
                            </>
                          )}
                        </button>
                      )}
                      
                      <button
                        type="button"
                        onClick={handleAddMapping}
                        className="text-green-600 hover:text-green-800 flex items-center"
                        title="Ajouter un champ manuellement"
                      >
                        <PlusCircle size={18} className="mr-1" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  </div>

                  {/* Mappings Table */}
                  {formData.fieldMappings && formData.fieldMappings.length > 0 ? (
                    <div className="bg-white rounded-md border overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Champ PDF
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Correspondance
                            </th>
                            <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {formData.fieldMappings.map((mapping, index) => (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {mapping.champ_pdf}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                  mapping.type === 'joueur' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : mapping.type === 'educateur'
                                      ? 'bg-purple-100 text-purple-800'
                                      : mapping.type === 'global'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {mapping.type.charAt(0).toUpperCase() + mapping.type.slice(1)}
                                </span>
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                {mapping.mapping}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                  type="button"
                                  onClick={() => handleEditMapping(index)}
                                  className="text-indigo-600 hover:text-indigo-900 mr-3"
                                  title="Modifier"
                                >
                                  <Edit size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMapping(index)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Supprimer"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <BarChart size={48} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-gray-500 mb-4">
                        Aucun champ défini. Cliquez sur "Analyser" pour détecter les champs automatiquement
                        ou ajoutez-les manuellement.
                      </p>
                    </div>
                  )}
                </div>

                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-3">
                    <div className="flex items-center">
                      <AlertCircle size={18} className="text-red-600 mr-2" />
                      <span>{errorMessage}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setModalType(ModalType.None);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  disabled={isLoading}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    formData.ageCategoryIds.length === 0 || isLoading 
                      ? 'bg-blue-400 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  } flex items-center`}
                  disabled={formData.ageCategoryIds.length === 0 || isLoading}
                >
                  {isLoading && (
                    <Loader size={18} className="mr-2 animate-spin" />
                  )}
                  {formData.id ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for PDF Preview */}
      {modalType === ModalType.Preview && pdfUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto mt-10 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Aperçu du modèle: {formData.name}
              </h3>
              <button
                onClick={() => {
                  setModalType(ModalType.None);
                  setPdfUrl(null);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              <PdfViewer url={pdfUrl} height="600px" />
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => {
                  setModalType(ModalType.None);
                  setPdfUrl(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Field Mapping Editing */}
      {modalType === ModalType.FieldMapping && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingMappingIndex !== null ? 'Modifier champ' : 'Ajouter champ'}
              </h3>
              <button
                onClick={() => setModalType(ModalType.AddEdit)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Champ dans le PDF *
                </label>
                <input
                  type="text"
                  value={newMapping.champ_pdf}
                  onChange={(e) => setNewMapping({...newMapping, champ_pdf: e.target.value})}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Nom du joueur, Date du tournoi"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type de données *
                </label>
                <select 
                  value={newMapping.type}
                  onChange={(e) => setNewMapping({...newMapping, type: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  {MappingFieldTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correspondance *
                </label>
                <input
                  type="text"
                  value={newMapping.mapping}
                  onChange={(e) => setNewMapping({...newMapping, mapping: e.target.value})}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: joueur.nom, tournoi.date"
                  required
                />
                <div className="mt-2 text-xs text-gray-500">
                  <p className="font-medium">Formats recommandés :</p>
                  <ul className="list-disc list-inside mt-1">
                    <li>Global: <code>tournoi.date</code>, <code>tournoi.lieu</code></li>
                    <li>Joueur: <code>joueur.nom</code>, <code>joueur.prenom</code>, <code>joueur.licence</code></li>
                    <li>Éducateur: <code>educateur.nom</code>, <code>educateur.prenom</code></li>
                  </ul>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Valeurs possibles (optionnel)
                </label>
                <input
                  type="text"
                  value={newMapping.valeur_possible?.join(', ') || ''}
                  onChange={(e) => setNewMapping({
                    ...newMapping, 
                    valeur_possible: e.target.value ? e.target.value.split(',').map(v => v.trim()) : undefined
                  })}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: Oui, Non"
                />
                <p className="mt-1 text-xs text-gray-500">Séparez les valeurs par des virgules</p>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="obligatoire"
                  checked={newMapping.obligatoire || false}
                  onChange={(e) => setNewMapping({...newMapping, obligatoire: e.target.checked})}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="obligatoire" className="ml-2 text-sm text-gray-700">
                  Champ obligatoire
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Format (optionnel)
                </label>
                <input
                  type="text"
                  value={newMapping.format || ''}
                  onChange={(e) => setNewMapping({...newMapping, format: e.target.value || undefined})}
                  className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Ex: DD/MM/YYYY"
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setModalType(ModalType.AddEdit)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSaveMapping}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Save size={16} className="inline-block mr-1" />
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for PDF Analysis */}
      {modalType === ModalType.Analysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl mx-auto mt-10 mb-10 overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Analyse du modèle: {formData.name}
              </h3>
              <button
                onClick={() => {
                  setModalType(ModalType.AddEdit);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader size={48} className="text-blue-500 animate-spin mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Analyse en cours...</h3>
                  <p className="text-gray-500 text-center max-w-md">
                    L'API Mistral est en train d'analyser votre PDF et d'identifier les champs.
                    Ce processus peut prendre quelques instants.
                  </p>
                </div>
              ) : errorMessage ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <AlertCircle size={48} className="text-red-500 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Erreur lors de l'analyse</h3>
                  <p className="text-red-600 text-center mb-4">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setModalType(ModalType.AddEdit);
                    }}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Retour à l'édition
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Résultats de l'analyse */}
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-2">
                      Champs détectés {analysisResults.mappings.length > 0 ? `(${analysisResults.mappings.length})` : ''}
                    </h4>
                    
                    {analysisResults.mappings.length > 0 ? (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="border rounded-md overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Champ PDF
                                </th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Type
                                </th>
                                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Correspondance
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {analysisResults.mappings.filter(m => m.type === 'global' || m.type === 'autre').map((mapping, index) => (
                                <tr key={`global-${index}`} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {mapping.champ_pdf}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm">
                                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      mapping.type === 'global' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-gray-100 text-gray-800'
                                    }`}>
                                      {mapping.type.charAt(0).toUpperCase() + mapping.type.slice(1)}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                    {mapping.mapping}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        <div>
                          <div className="border rounded-md overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Champ PDF
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Type
                                  </th>
                                  <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Correspondance
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {analysisResults.mappings.filter(m => m.type === 'joueur' || m.type === 'educateur').map((mapping, index) => (
                                  <tr key={`persona-${index}`} className="hover:bg-gray-50">
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                      {mapping.champ_pdf}
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm">
                                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                        mapping.type === 'joueur' 
                                          ? 'bg-blue-100 text-blue-800' 
                                          : 'bg-purple-100 text-purple-800'
                                      }`}>
                                        {mapping.type.charAt(0).toUpperCase() + mapping.type.slice(1)}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                                      {mapping.mapping}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Exemples de valeurs si disponibles */}
                          {analysisResults.mappings.some(m => m.valeur_possible && m.valeur_possible.length > 0) && (
                            <div className="mt-4 border rounded-md overflow-hidden">
                              <div className="bg-gray-50 px-4 py-2 border-b">
                                <h5 className="text-sm font-medium text-gray-700">Exemples de valeurs détectées</h5>
                              </div>
                              <div className="p-4 space-y-2">
                                {analysisResults.mappings.filter(m => m.valeur_possible && m.valeur_possible.length > 0).map((mapping, index) => (
                                  <div key={`example-${index}`} className="text-sm">
                                    <span className="font-medium">{mapping.champ_pdf}:</span>{' '}
                                    <span className="text-gray-600">{mapping.valeur_possible!.join(', ')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 p-4 rounded-md flex items-start">
                        <AlertCircle size={20} className="text-yellow-600 mt-0.5 mr-3 flex-shrink-0" />
                        <div>
                          <h5 className="text-sm font-medium text-yellow-800">Aucun champ détecté</h5>
                          <p className="mt-1 text-sm text-yellow-700">
                            L'analyse n'a pas permis de détecter des champs dans ce PDF. Il peut s'agir d'un PDF scanné 
                            ou d'un format peu structuré. Vous pouvez ajouter manuellement les champs ou réessayer l'analyse.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setModalType(ModalType.AddEdit)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                disabled={isAnalyzing}
              >
                Utiliser ces résultats
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for Help */}
      {modalType === ModalType.Help && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-auto overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Aide - Mapping des champs PDF
              </h3>
              <button
                onClick={() => setModalType(ModalType.AddEdit)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-2">Qu'est-ce que le mapping des champs?</h4>
                <p className="text-gray-600">
                  Le mapping des champs permet de faire correspondre les champs présents dans votre PDF avec les données de l'application.
                  Cela permet de remplir automatiquement les champs du PDF avec les informations des joueurs, entraîneurs et tournois.
                </p>
              </div>

              <div>
                <h4 className="text-md font-medium text-gray-900 mb-2">Types de champs</h4>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center px-2 py-1 mr-3 text-xs font-bold leading-none rounded-full bg-green-100 text-green-800">
                      Global
                    </span>
                    <div>
                      <p className="text-gray-600">
                        Informations générales sur le tournoi comme le nom, la date, le lieu, etc.
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        <strong>Exemples de mapping:</strong> tournoi.nom, tournoi.date, tournoi.lieu
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center px-2 py-1 mr-3 text-xs font-bold leading-none rounded-full bg-blue-100 text-blue-800">
                      Joueur
                    </span>
                    <div>
                      <p className="text-gray-600">
                        Informations sur un joueur comme son nom, prénom, numéro de licence, etc.
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        <strong>Exemples de mapping:</strong> joueur.nom, joueur.prenom, joueur.licence, joueur.est_avant, joueur.est_arbitre
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-flex items-center justify-center px-2 py-1 mr-3 text-xs font-bold leading-none rounded-full bg-purple-100 text-purple-800">
                      Éducateur
                    </span>
                    <div>
                      <p className="text-gray-600">
                        Informations sur un entraîneur comme son nom, prénom, numéro de licence, diplôme, etc.
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        <strong>Exemples de mapping:</strong> educateur.nom, educateur.prenom, educateur.licence, educateur.diplome, educateur.est_referent
                      </p>
                    </div>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-md font-medium text-gray-900 mb-2">Comment ça marche?</h4>
                <ol className="list-decimal list-inside space-y-2 text-gray-600">
                  <li>Importer un nouveau modèle PDF ou sélectionner un modèle existant</li>
                  <li>Cliquer sur le bouton "Analyser" pour que l'IA détecte les champs</li>
                  <li>Vérifier et ajuster les correspondances proposées par l'IA</li>
                  <li>Ajouter manuellement des champs si nécessaire</li>
                  <li>Enregistrer le modèle avec ses correspondances</li>
                </ol>
                <p className="mt-3 text-gray-600">
                  Lors de la génération d'une feuille de match, les données seront automatiquement placées 
                  aux bons endroits dans le PDF selon les correspondances que vous avez définies.
                </p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end">
              <button
                type="button"
                onClick={() => setModalType(ModalType.AddEdit)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;