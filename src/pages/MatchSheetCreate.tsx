import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Award, UserCheck, ShieldCheck, Castle as Whistle, GraduationCap, Loader } from 'lucide-react';
import { generateAndStorePdf } from '../services/PdfExportService';
import { validateMatchSheet } from '../services/MatchSheetService';

const MatchSheetCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { tournaments, templates, players, coaches, ageCategories, addMatchSheet, updateMatchSheet, getMatchSheetById } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>(searchParams.get('tournamentId') || '');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [referentCoach, setReferentCoach] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<string>('');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  // Tri des catégories d'âge dans l'ordre spécifique (M6, M8, M10, etc.)
  const sortedCategories = [...ageCategories].sort((a, b) => {
    // Extraire le numéro de la catégorie (ex: M6 -> 6)
    const getAgeNumber = (name: string) => {
      const match = name.match(/M(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    };
    
    const ageA = getAgeNumber(a.name);
    const ageB = getAgeNumber(b.name);
    
    return ageA - ageB;
  });

  // Check if in edit mode
  useEffect(() => {
    // Extract matchSheetId from search parameters or location state
    const matchSheetId = searchParams.get('id') || 
                        (location.state as { id?: string })?.id ||
                        location.pathname.split('/').pop();
    
    if (matchSheetId && matchSheetId !== 'create') {
      console.log("Mode édition détecté pour la feuille:", matchSheetId);
      setEditMode(true);
      setEditId(matchSheetId);
      loadMatchSheetData(matchSheetId);
    }
  }, [searchParams, location]);

  // Load match sheet data when in edit mode
  const loadMatchSheetData = async (id: string) => {
    console.log("Chargement des données de la feuille:", id);
    const matchSheet = await getMatchSheetById(id);
    if (matchSheet) {
      console.log("Données de la feuille chargées:", matchSheet);
      setSelectedTournament(matchSheet.tournamentId || '');
      setSelectedTemplate(matchSheet.templateId || '');
      setSelectedCategory(matchSheet.ageCategoryId || '');
      setSelectedPlayers(matchSheet.playerIds || []);
      setSelectedCoaches(matchSheet.coachIds || []);
      setReferentCoach(matchSheet.referentCoachId || '');
      setExistingPdfUrl(matchSheet.pdfUrl || null);
    } else {
      console.error("Feuille de match non trouvée:", id);
      alert("Feuille de match introuvable");
      navigate('/match-sheets');
    }
  };

  // Filter templates by selected category
  const availableTemplates = templates.filter(template => 
    !selectedCategory || template.ageCategoryIds.includes(selectedCategory)
  ).sort((a, b) => a.name.localeCompare(b.name, 'fr-FR'));

  // Filter players by selected category and sort alphabetically
  const availablePlayers = players
    .filter(player => 
      !selectedCategory || player.ageCategoryId === selectedCategory
    )
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr-FR'));

  // Filter coaches by selected category and sort alphabetically
  const availableCoaches = coaches
    .filter(coach => 
      !selectedCategory || coach.ageCategoryIds.includes(selectedCategory)
    )
    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'fr-FR'));

  // Set initial category based on tournament if available
  useEffect(() => {
    if (selectedTournament) {
      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (tournament && tournament.ageCategoryIds.length > 0 && !selectedCategory) {
        setSelectedCategory(tournament.ageCategoryIds[0]);
      }
    }
  }, [selectedTournament, tournaments, selectedCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormErrors([]);
    
    // Get selected tournament object
    const tournament = tournaments.find(t => t.id === selectedTournament);
    
    // Validate form data
    const validation = validateMatchSheet(
      tournament,
      selectedTemplate,
      selectedCategory,
      availablePlayers.filter(p => selectedPlayers.includes(p.id)),
      availableCoaches.filter(c => selectedCoaches.includes(c.id)),
      referentCoach
    );
    
    if (!validation.isValid) {
      setFormErrors(validation.errors);
      return;
    }
    
    try {
      setIsSubmitting(true);
      setGenerationStatus('Création de la feuille de match...');
      
      // Récupérer les objets complets
      const tournament = tournaments.find(t => t.id === selectedTournament);
      const template = templates.find(t => t.id === selectedTemplate);
      const selectedPlayerObjects = players.filter(p => selectedPlayers.includes(p.id));
      const selectedCoachObjects = coaches.filter(c => selectedCoaches.includes(c.id));
      
      if (!tournament || !template) {
        throw new Error('Tournoi ou modèle non trouvé');
      }

      let pdfUrl = existingPdfUrl;
      
      console.log("Début du processus de génération/mise à jour de la feuille de match");
      console.log("Mode édition:", editMode);
      console.log("PDF existant:", existingPdfUrl);
      console.log("Nombre de joueurs sélectionnés:", selectedPlayers.length);
      console.log("Nombre d'entraîneurs sélectionnés:", selectedCoaches.length);
      
      // Générer un nouveau PDF si on est en mode création ou si un paramètre important a changé en mode édition
      if (!editMode || !existingPdfUrl || 
          (editMode && (selectedPlayers.length > 0 || selectedCoaches.length > 0))) {
        // Générer et stocker le PDF
        setGenerationStatus('Génération du PDF...');
        console.log("Génération d'un nouveau PDF...");
        
        const pdfFilename = await generateAndStorePdf(
          selectedTemplate,
          selectedTournament,
          selectedPlayerObjects,
          selectedCoachObjects,
          referentCoach,
          template,
          tournament
        );
        
        pdfUrl = `/generated_pdfs/${pdfFilename}`;
        console.log("Nouveau PDF généré:", pdfUrl);
      } else {
        console.log("Conservation du PDF existant:", pdfUrl);
      }
      
      setGenerationStatus('Enregistrement des données...');
      
      const matchSheetData = {
        tournamentId: selectedTournament,
        templateId: selectedTemplate,
        ageCategoryId: selectedCategory,
        referentCoachId: referentCoach,
        playerIds: selectedPlayers,
        coachIds: selectedCoaches,
        pdfUrl: pdfUrl || undefined
      };
      
      console.log("Données de la feuille de match à sauvegarder:", matchSheetData);
      
      if (editMode && editId) {
        await updateMatchSheet(editId, matchSheetData);
        setGenerationStatus('Feuille de match mise à jour avec succès!');
      } else {
        await addMatchSheet(matchSheetData);
        setGenerationStatus('Feuille de match créée avec succès!');
      }
      
      // Navigate back to match sheets list
      navigate('/match-sheets');
    } catch (error) {
      console.error('Error creating match sheet:', error);
      alert('Une erreur est survenue lors de la création de la feuille de match.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {editMode ? 'Modifier la Feuille de Match' : 'Nouvelle Feuille de Match'}
          </h1>
          <p className="text-gray-600 mt-1">
            {editMode 
              ? 'Modifiez les informations de la feuille de match existante'
              : 'Créez une nouvelle feuille de match en sélectionnant un tournoi et un modèle'}
          </p>
        </div>
      </div>

      {formErrors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium mb-2">Veuillez corriger les erreurs suivantes :</h3>
          <ul className="list-disc pl-5 text-red-700 text-sm">
            {formErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tournoi et Catégorie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tournoi *
              </label>
              <select
                value={selectedTournament}
                onChange={(e) => setSelectedTournament(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={editMode}
              >
                <option value="">Sélectionner un tournoi</option>
                {tournaments.map((tournament) => (
                  <option key={tournament.id} value={tournament.id}>
                    {tournament.location} - {new Date(tournament.date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catégorie *
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionner une catégorie</option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name} - {category.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Modèle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modèle de feuille *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableTemplates.map((template) => (
                <label
                  key={template.id}
                  className={`relative flex flex-col p-4 border rounded-lg cursor-pointer hover:border-blue-500 transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={template.id}
                    checked={selectedTemplate === template.id}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="sr-only"
                  />
                  <div className="flex items-center mb-2">
                    <FileText
                      size={20}
                      className={`mr-2 ${
                        selectedTemplate === template.id
                          ? 'text-blue-500'
                          : 'text-gray-400'
                      }`}
                    />
                    <span className="font-medium text-gray-900">
                      {template.name}
                    </span>
                  </div>
                  {template.description && (
                    <p className="text-sm text-gray-500">{template.description}</p>
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Joueurs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Joueurs *
            </label>
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center text-blue-700 mb-1">
                  <UserCheck size={16} className="mr-1" />
                  <span className="text-sm font-medium">Total</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{selectedPlayers.length}</p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center text-green-700 mb-1">
                  <ShieldCheck size={16} className="mr-1" />
                  <span className="text-sm font-medium">Avants</span>
                </div>
                <p className="text-2xl font-bold text-green-900">
                  {selectedPlayers.filter(id => 
                    players.find(p => p.id === id)?.canPlayForward
                  ).length}
                </p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="flex items-center text-yellow-700 mb-1">
                  <Whistle size={16} className="mr-1" />
                  <span className="text-sm font-medium">Arbitres</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900">
                  {selectedPlayers.filter(id => 
                    players.find(p => p.id === id)?.canReferee
                  ).length}
                </p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {availablePlayers.map((player) => (
                  <label
                    key={player.id}
                    className="flex items-center p-2 border rounded hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(player.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPlayers([...selectedPlayers, player.id]);
                        } else {
                          setSelectedPlayers(selectedPlayers.filter(id => id !== player.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <Users size={16} className="ml-2 mr-1 text-gray-400" />
                    <span className="ml-2 text-sm">
                      {player.lastName} {player.firstName}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Entraîneurs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entraîneurs *
            </label>
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center text-blue-700 mb-1">
                  <UserCheck size={16} className="mr-1" />
                  <span className="text-sm font-medium">Total</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">{selectedCoaches.length}</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg">
                <div className="flex items-center text-purple-700 mb-1">
                  <GraduationCap size={16} className="mr-1" />
                  <span className="text-sm font-medium">Diplômés</span>
                </div>
                <p className="text-2xl font-bold text-purple-900">
                  {selectedCoaches.filter(id => 
                    coaches.find(c => c.id === id)?.diploma
                  ).length}
                </p>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg p-4 max-h-72 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {availableCoaches.map((coach) => (
                  <label
                    key={coach.id}
                    className="flex items-center p-2 border rounded hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCoaches.includes(coach.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCoaches([...selectedCoaches, coach.id]);
                        } else {
                          setSelectedCoaches(selectedCoaches.filter(id => id !== coach.id));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <Award size={16} className="ml-2 mr-1 text-gray-400" />
                    <span className="ml-2 text-sm">
                      {coach.lastName} {coach.firstName}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Entraîneur référent */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Entraîneur référent *
            </label>
            <select
              value={referentCoach}
              onChange={(e) => setReferentCoach(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Sélectionner un entraîneur référent</option>
              {selectedCoaches
                .map(coachId => coaches.find(c => c.id === coachId))
                .filter(Boolean)
                .sort((a, b) => a!.lastName.localeCompare(b!.lastName, 'fr-FR'))
                .map(coach => coach && (
                  <option key={coach.id} value={coach.id}>
                    {coach.lastName} {coach.firstName}
                  </option>
                ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <p className="text-sm text-gray-500 mr-auto">* Champs obligatoires</p>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => navigate(-1)}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } inline-flex items-center`}
            >
              {isSubmitting ? (
                <>
                  <Loader size={16} className="animate-spin mr-2" />
                  {generationStatus}
                </>
              ) : (
                `${editMode ? 'Mettre à jour' : 'Créer'} la feuille`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchSheetCreate;