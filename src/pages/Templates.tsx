import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit, Trash2, FileText, UploadCloud, X, Download, Tag, ArrowLeft, ListChecks, Loader } from 'lucide-react';
import { analyzePdfStructure, extractTextFromPdf, PdfFieldMapping, savePdfAnalysis } from '../services/MistralApiService';
import PdfViewer from '../components/PdfViewer';
import { getPdf, storePdf, cleanPdfFormFields } from '../services/PdfStorage';

interface TemplateFormData {
  name: string;
  description: string;
  fileUrl: string;
  ageCategoryIds: string[];
  fieldMappings: PdfFieldMapping[];
}

const initialFormData: TemplateFormData = {
  name: '',
  description: '',
  fileUrl: '',
  ageCategoryIds: [],
  fieldMappings: []
};

const Templates: React.FC = () => {
  const { templates, ageCategories, addTemplate, updateTemplate, deleteTemplate, refreshData } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isFieldMappingOpen, setIsFieldMappingOpen] = useState(false);
  const [formData, setFormData] = useState<TemplateFormData>(initialFormData);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState<string>('upload'); // upload, analyze, mapping
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedTemplateData, setSelectedTemplateData] = useState<any>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
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
    setEditingTemplateId(null);
    setUploadedFile(null);
    setUploadedFileName('');
    setUploadProgress(0);
    setIsAnalyzing(false);
    setAnalyzeError(null);
    setExtractedText('');
    setPdfPreviewUrl(null);
    setCurrentStep('upload');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one category is selected
    if (formData.ageCategoryIds.length === 0) {
      alert("Veuillez sélectionner au moins une catégorie d'âge.");
      return;
    }
    
    try {
      if (editingTemplateId) {
        await updateTemplate(editingTemplateId, { ...formData, id: editingTemplateId });
      } else {
        await addTemplate(formData);
      }

      // Successful save - close modal and reset form
      setIsModalOpen(false);
      resetForm();
      
      // Refresh the templates data
      refreshData();
    } catch (error) {
      console.error('Error saving template:', error);
      alert(`Erreur lors de l'enregistrement du modèle: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };

  const handleEdit = (template: TemplateFormData & { id: string }) => {
    setFormData(template);
    setEditingTemplateId(template.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le modèle "${name}" ?`)) {
      try {
        await deleteTemplate(id);
        
        // Reset preview if the deleted template was being previewed
        if (selectedTemplate === id) {
          setSelectedTemplate(null);
          setSelectedTemplateData(null);
          setPdfPreviewUrl(null);
        }
      } catch (error) {
        console.error('Error deleting template:', error);
        alert(`Erreur lors de la suppression du modèle: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Check if it's a PDF
      if (file.type !== 'application/pdf') {
        alert('Veuillez sélectionner un fichier PDF.');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Le fichier est trop volumineux. Taille maximale: 5MB');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        return;
      }

      // Set the file
      setUploadedFile(file);
      setUploadedFileName(file.name);
    }
  };

  const handleFileUpload = async () => {
    if (!uploadedFile) {
      alert('Veuillez sélectionner un fichier à téléverser.');
      return;
    }
    
    try {
      setUploadProgress(10);

      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target && e.target.result) {
          const fileContent = e.target.result as string;
          setUploadProgress(50);
          
          // Store the PDF in local storage or Supabase
          const fileName = `${Date.now()}_${uploadedFileName}`;
          const storedSuccessfully = await storePdf(fileName, fileContent);
          
          if (storedSuccessfully) {
            setUploadProgress(100);
            
            // Update form data with the file URL
            setFormData({
              ...formData,
              fileUrl: `/templates/${fileName}`
            });
            
            // Set PDF preview
            setPdfPreviewUrl(fileContent);

            // Move to analysis step
            setCurrentStep('analyze');
          } else {
            console.error('Error storing PDF');
            alert('Erreur lors du stockage du PDF.');
          }
        }
      };
      reader.readAsDataURL(uploadedFile);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert(`Erreur lors du téléversement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      setUploadProgress(0);
    }
  };

  const handleAnalyzePdf = async () => {
    try {
      setIsAnalyzing(true);
      setAnalyzeError(null);

      // Check if Mistral API key is defined
      if (!import.meta.env.VITE_MISTRAL_API_KEY) {
        throw new Error("Clé API Mistral non définie. Veuillez définir VITE_MISTRAL_API_KEY dans votre fichier .env");
      }

      // If we have a PDF preview URL, we can use that
      if (pdfPreviewUrl) {
        console.log('Analyzing PDF...');
        
        // Extract text from PDF
        const text = await extractTextFromPdf(pdfPreviewUrl);
        setExtractedText(text);
        console.log('Text extracted, analyzing structure...');
        
        // Use Mistral API to analyze PDF structure
        const fieldMappings = await analyzePdfStructure(text);
        console.log('Field mappings:', fieldMappings);
        
        // Save field mappings to form data
        setFormData(prev => ({
          ...prev,
          fieldMappings
        }));
        
        // If we have a file name, save the analysis
        if (uploadedFileName) {
          savePdfAnalysis(uploadedFileName, fieldMappings);
        }
        
        // Move to field mapping step
        setIsFieldMappingOpen(true);
      } else {
        setAnalyzeError('Aucun PDF à analyser. Veuillez d\'abord téléverser un fichier.');
      }
    } catch (error) {
      console.error('Error analyzing PDF:', error);
      setAnalyzeError(`Erreur lors de l'analyse du PDF: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Sort categories alphabetically
  const sortedCategories = [...ageCategories].sort((a, b) => {
    // Extract the number from the category name (e.g., M6 -> 6)
    const getAgeNumber = (name: string) => {
      const match = name.match(/M(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const ageA = getAgeNumber(a.name);
    const ageB = getAgeNumber(b.name);
    
    return ageA - ageB;
  });
  
  // Filter templates by search term
  const filteredTemplates = templates
    .filter(template => 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'));

  // Handle template selection
  const handleTemplateSelect = async (templateId: string) => {
    try {
      setSelectedTemplate(templateId);
      
      const template = templates.find(t => t.id === templateId);
      setSelectedTemplateData(template);
      
      if (template && template.fileUrl) {
        // Get filename
        const fileName = template.fileUrl.split('/').pop();
        if (!fileName) {
          console.error('Invalid template URL:', template.fileUrl);
          return;
        }
        
        // Get PDF
        const pdfContent = await getPdf(fileName);
        if (pdfContent) {
          setPdfPreviewUrl(pdfContent);
        } else {
          console.error('PDF content not found');
        }
      }
    } catch (error) {
      console.error('Error selecting template:', error);
    }
  };

  // Reset current template selection
  const handleClosePreview = () => {
    setSelectedTemplate(null);
    setSelectedTemplateData(null);
    setPdfPreviewUrl(null);
  };

  // Get category names for display
  const getCategoryNames = (categoryIds: string[]) => {
    return categoryIds
      .map(id => ageCategories.find(cat => cat.id === id))
      .filter(Boolean)
      .sort((a, b) => {
        if (!a || !b) return 0;
        
        // Extract the number from the category name (e.g., M6 -> 6)
        const getAgeNumber = (name: string) => {
          const match = name.match(/M(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        };
        
        const ageA = getAgeNumber(a.name);
        const ageB = getAgeNumber(b.name);
        
        return ageA - ageB;
      })
      .map(cat => cat?.name || 'Inconnu')
      .join(', ');
  };

  const updateFieldMapping = (index: number, key: string, value: any) => {
    setFormData(prev => {
      const mappings = [...prev.fieldMappings];
      mappings[index] = {
        ...mappings[index],
        [key]: value,
      };
      return {
        ...prev,
        fieldMappings: mappings,
      };
    });
  };

  const removeFieldMapping = (index: number) => {
    setFormData(prev => {
      const mappings = [...prev.fieldMappings];
      mappings.splice(index, 1);
      return {
        ...prev,
        fieldMappings: mappings,
      };
    });
  };

  const addFieldMapping = () => {
    setFormData(prev => {
      return {
        ...prev,
        fieldMappings: [
          ...prev.fieldMappings,
          {
            champ_pdf: '',
            type: 'global',
            mapping: '',
          }
        ],
      };
    });
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modèles</h1>
          <p className="text-gray-600 mt-1">
            Gérez les modèles de feuilles de match et leur configuration
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => {
              resetForm();
              setIsUploadModalOpen(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
          >
            <UploadCloud size={18} className="mr-1" />
            <span>Téléverser</span>
          </button>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b">
              <h2 className="text-lg font-medium text-gray-900">Modèles disponibles</h2>
            </div>
            
            {filteredTemplates.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredTemplates.map((template) => (
                  <div 
                    key={template.id}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedTemplate === template.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">
                          {template.name}
                        </p>
                        <div className="mt-1 flex items-start text-sm text-gray-500">
                          <Tag size={14} className="mr-1 mt-0.5 flex-shrink-0" />
                          <span>{getCategoryNames(template.ageCategoryIds)}</span>
                        </div>
                        {template.description && (
                          <p className="mt-1 text-sm text-gray-500">
                            {template.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            template.fieldMappings && template.fieldMappings.length > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {template.fieldMappings && template.fieldMappings.length > 0
                              ? `${template.fieldMappings.length} champs configurés`
                              : 'Pas de champs configurés'}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex-shrink-0 flex">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(template);
                          }}
                          className="text-gray-400 hover:text-indigo-600 mr-2"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(template.id, template.name);
                          }}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun modèle trouvé</h3>
                <p className="text-gray-500 mb-6">
                  {searchTerm
                    ? "Aucun modèle ne correspond aux critères de recherche."
                    : "Commencez par téléverser votre premier modèle de feuille de match."}
                </p>
                {!searchTerm && (
                  <button
                    onClick={() => {
                      resetForm();
                      setIsUploadModalOpen(true);
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <UploadCloud size={18} className="mr-2" />
                    Téléverser un modèle
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          {pdfPreviewUrl ? (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b flex justify-between items-center">
                <div className="flex items-center">
                  <button 
                    onClick={handleClosePreview}
                    className="mr-3 text-gray-500 hover:text-gray-700"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <h2 className="font-medium">
                    {selectedTemplateData?.name || 'Aperçu du modèle'}
                  </h2>
                </div>
                {selectedTemplateData && (
                  <div className="flex">
                    <button
                      onClick={() => handleEdit(selectedTemplateData)}
                      className="mr-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 flex items-center hover:bg-gray-50"
                    >
                      <Edit size={16} className="mr-1" />
                      Éditer
                    </button>
                    <button
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = pdfPreviewUrl;
                        a.download = selectedTemplateData.name.replace(/\s+/g, '_') + '.pdf';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }}
                      className="px-3 py-1.5 border border-gray-300 rounded-md text-sm text-gray-700 flex items-center hover:bg-gray-50"
                    >
                      <Download size={16} className="mr-1" />
                      Télécharger
                    </button>
                  </div>
                )}
              </div>
              <div className="p-4 flex-grow overflow-auto">
                <PdfViewer url={pdfPreviewUrl} height="600px" />
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-8 flex flex-col items-center justify-center h-full min-h-[600px]">
              <FileText size={64} className="text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Aperçu du modèle</h3>
              <p className="text-gray-500 text-center max-w-md mb-6">
                Sélectionnez un modèle dans la liste pour afficher son aperçu ici.
                Vous pourrez ensuite l'éditer ou télécharger le PDF.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setIsUploadModalOpen(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <UploadCloud size={18} className="mr-2" />
                Téléverser un nouveau modèle
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">
                {currentStep === 'upload' && 'Téléverser un modèle'}
                {currentStep === 'analyze' && 'Analyser le modèle'}
              </h3>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetForm();
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-grow">
              {currentStep === 'upload' && (
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
                      placeholder="Ex: Feuille M14 Tournoi"
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
                      placeholder="Description du modèle et de son usage"
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Catégories d'âge (au moins une)
                    </label>
                    <div className="mt-2 space-y-2 border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
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
                        <p className="text-sm text-red-500 mt-1">
                          Veuillez sélectionner au moins une catégorie
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fichier PDF
                    </label>
                    <div className="mt-1 flex justify-center px-4 pt-3 pb-3 border-2 border-gray-300 border-dashed rounded-md">
                      <div className="space-y-1 text-center">
                        <div className="flex flex-col items-center">
                          <UploadCloud size={28} className="text-gray-400" />
                          <p className="text-sm text-gray-600 mt-1">
                            {uploadedFileName ? (
                              <span className="text-blue-600 font-medium">{uploadedFileName}</span>
                            ) : (
                              <span>Cliquez pour sélectionner un fichier PDF</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">PDF jusqu'à 5MB</p>
                        </div>
                        <input
                          id="file-upload"
                          name="file-upload"
                          type="file"
                          className="sr-only"
                          accept="application/pdf"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                        />
                        <div className="flex justify-center mt-2">
                          <label
                            htmlFor="file-upload"
                            className="cursor-pointer px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                          >
                            {uploadedFileName ? 'Changer de fichier' : 'Choisir un fichier'}
                          </label>
                          {uploadedFileName && (
                            <button
                              type="button"
                              onClick={() => {
                                setUploadedFile(null);
                                setUploadedFileName('');
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = '';
                                }
                              }}
                              className="ml-2 px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-red-600 bg-white hover:bg-gray-50"
                            >
                              Supprimer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {uploadProgress > 0 && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-blue-600 rounded-full"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {currentStep === 'analyze' && (
                <div className="space-y-4">
                  <div className="mb-4">
                    <div className="border rounded-md overflow-hidden">
                      <div className="p-3 bg-gray-50 border-b">
                        <h4 className="font-medium text-sm text-gray-700">Aperçu du modèle</h4>
                      </div>
                      <div className="p-3 max-h-40 overflow-auto">
                        <PdfViewer url={pdfPreviewUrl || ''} height="150px" />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm text-gray-700">Extraction du texte et analyse</h4>
                      <button 
                        type="button" 
                        onClick={handleAnalyzePdf}
                        disabled={isAnalyzing}
                        className={`text-xs px-2 py-1 rounded-md ${
                          isAnalyzing 
                            ? 'bg-blue-100 text-blue-600 cursor-not-allowed' 
                            : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        }`}
                      >
                        {isAnalyzing ? (
                          <span className="flex items-center">
                            <Loader size={12} className="animate-spin mr-1" />
                            Analyse en cours...
                          </span>
                        ) : (
                          'Lancer l\'analyse'
                        )}
                      </button>
                    </div>
                    <div className="mt-1 bg-gray-50 rounded-md p-3 text-sm text-gray-700">
                      {isAnalyzing ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader size={24} className="animate-spin mr-2 text-blue-500" />
                          <p>Analyse du PDF en cours...</p>
                        </div>
                      ) : analyzeError ? (
                        <div className="text-red-500">
                          {analyzeError}
                          {analyzeError?.includes("Clé API Mistral non définie") && (
                            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                              <p className="font-medium">Configuration requise :</p>
                              <p className="mt-1">Ajoutez votre clé API Mistral au fichier .env à la racine du projet :</p>
                              <pre className="mt-2 p-2 bg-gray-800 text-white rounded text-xs overflow-x-auto">
                                VITE_MISTRAL_API_KEY=votre_clé_api_ici
                              </pre>
                              <p className="mt-2 text-xs">
                                Vous pouvez obtenir une clé API sur <a href="https://console.mistral.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">console.mistral.ai</a>
                              </p>
                            </div>
                          )}
                        </div>
                      ) : formData.fieldMappings && formData.fieldMappings.length > 0 ? (
                        <div>
                          <p className="mb-2 text-green-600 font-medium">
                            Analyse terminée! {formData.fieldMappings.length} champs identifiés.
                          </p>
                          <button 
                            type="button" 
                            onClick={() => setIsFieldMappingOpen(true)}
                            className="text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50"
                          >
                            <ListChecks size={14} className="mr-1 inline" />
                            Voir et modifier les champs
                          </button>
                        </div>
                      ) : (
                        <p>
                          Cliquez sur "Lancer l'analyse" pour commencer l'extraction des champs du PDF. 
                          Cette opération utilise l'API Mistral pour analyser le modèle.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Annuler
              </button>
              
              {currentStep === 'upload' && (
                <button
                  type="button"
                  onClick={handleFileUpload}
                  disabled={!uploadedFile || !formData.name || formData.ageCategoryIds.length === 0}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    !uploadedFile || !formData.name || formData.ageCategoryIds.length === 0
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Continuer
                </button>
              )}
              
              {currentStep === 'analyze' && (
                <button
                  type="button"
                  onClick={() => {
                    if (isFieldMappingOpen) {
                      setIsUploadModalOpen(false);
                      setIsFieldMappingOpen(false);
                      setIsModalOpen(true);
                    } else {
                      setIsFieldMappingOpen(true);
                    }
                  }}
                  disabled={formData.fieldMappings.length === 0}
                  className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    formData.fieldMappings.length === 0
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Continuer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Field Mapping Modal */}
      {isFieldMappingOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-auto overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">
                Champs détectés dans le PDF
              </h3>
              <button
                onClick={() => {
                  setIsFieldMappingOpen(false);
                  setIsUploadModalOpen(false);
                  setIsModalOpen(true);
                }}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-grow">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-4">
                  Vérifiez et modifiez les correspondances entre les champs du PDF et les données de l'application.
                  Ces correspondances seront utilisées pour remplir automatiquement les feuilles de match.
                </p>
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={addFieldMapping}
                    className="text-sm px-3 py-1.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 flex items-center"
                  >
                    <Plus size={14} className="mr-1" />
                    Ajouter un champ
                  </button>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Champ PDF
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Correspondance
                        </th>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {formData.fieldMappings.map((mapping, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm">
                            <input
                              type="text"
                              value={mapping.champ_pdf}
                              onChange={(e) => updateFieldMapping(index, 'champ_pdf', e.target.value)}
                              className="w-full border border-gray-300 rounded-md py-1 px-2 text-sm"
                              placeholder="Nom du champ"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <select
                              value={mapping.type}
                              onChange={(e) => updateFieldMapping(index, 'type', e.target.value)}
                              className="w-full border border-gray-300 rounded-md py-1 px-2 text-sm"
                            >
                              <option value="global">Global</option>
                              <option value="joueur">Joueur</option>
                              <option value="educateur">Éducateur</option>
                              <option value="autre">Autre</option>
                            </select>
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <input
                              type="text"
                              value={mapping.mapping}
                              onChange={(e) => updateFieldMapping(index, 'mapping', e.target.value)}
                              className="w-full border border-gray-300 rounded-md py-1 px-2 text-sm"
                              placeholder="Correspondance (ex: joueur.nom)"
                            />
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <button
                              type="button"
                              onClick={() => removeFieldMapping(index)}
                              className="text-red-600 hover:text-red-800"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {formData.fieldMappings.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-sm text-center text-gray-500">
                            Aucun champ détecté. Cliquez sur "Ajouter un champ" pour en créer un manuellement.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsFieldMappingOpen(false);
                  setIsUploadModalOpen(true);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsFieldMappingOpen(false);
                  setIsUploadModalOpen(false);
                  setIsModalOpen(true);
                }}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Create Template Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center p-4 border-b flex-shrink-0">
              <h3 className="text-lg font-medium text-gray-900">
                {editingTemplateId ? 'Modifier le modèle' : 'Finaliser le modèle'}
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

            <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
              <div className="p-4 space-y-4 overflow-y-auto">
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
                  ></textarea>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégories d'âge (au moins une)
                  </label>
                  <div className="mt-2 space-y-2 border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
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
                      <p className="text-sm text-red-500 mt-1">
                        Veuillez sélectionner au moins une catégorie
                      </p>
                    )}
                  </div>
                </div>

                {pdfPreviewUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Aperçu du modèle PDF
                    </label>
                    <div className="border rounded-md overflow-hidden" style={{ height: "150px" }}>
                      <PdfViewer url={pdfPreviewUrl} height="150px" />
                    </div>
                  </div>
                )}

                {formData.fieldMappings && formData.fieldMappings.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Correspondance des champs
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsFieldMappingOpen(true)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Modifier
                      </button>
                    </div>
                    
                    <div className="text-xs text-gray-500 border border-gray-200 rounded-md p-2 bg-gray-50">
                      <p>{formData.fieldMappings.length} champs configurés</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-gray-50 border-t flex justify-end space-x-3 flex-shrink-0">
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
                    !formData.name || formData.ageCategoryIds.length === 0 || !formData.fileUrl
                      ? 'bg-blue-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={!formData.name || formData.ageCategoryIds.length === 0 || !formData.fileUrl}
                >
                  {editingTemplateId ? 'Mettre à jour' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;