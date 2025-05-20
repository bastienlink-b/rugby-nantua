import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Award, UserCheck, ShieldCheck, Castle as Whistle, GraduationCap, Loader } from 'lucide-react';

const MatchSheetCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tournaments, templates, players, coaches, ageCategories, addMatchSheet } = useAppContext();
  const [selectedTournament, setSelectedTournament] = useState<string>(searchParams.get('tournamentId') || '');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [referentCoach, setReferentCoach] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter templates by selected category
  const availableTemplates = templates.filter(template => 
    !selectedCategory || template.ageCategoryIds.includes(selectedCategory)
  );

  // Filter players by selected category
  const availablePlayers = players.filter(player => 
    !selectedCategory || player.ageCategoryId === selectedCategory
  );

  // Filter coaches by selected category
  const availableCoaches = coaches.filter(coach => 
    !selectedCategory || coach.ageCategoryIds.includes(selectedCategory)
  );

  // Set initial category based on tournament if available
  useEffect(() => {
    if (selectedTournament) {
      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (tournament && tournament.ageCategoryIds.length > 0) {
        setSelectedCategory(tournament.ageCategoryIds[0]);
      }
    }
  }, [selectedTournament, tournaments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all required fields
    const requiredFields = [
      { value: selectedTournament, name: 'Tournoi' },
      { value: selectedCategory, name: 'Catégorie' },
      { value: selectedTemplate, name: 'Modèle de feuille' },
      { value: selectedPlayers.length > 0, name: 'Joueurs' },
      { value: selectedCoaches.length > 0, name: 'Entraîneurs' },
      { value: referentCoach, name: 'Entraîneur référent' }
    ];
    
    const missingFields = requiredFields
      .filter(field => !field.value)
      .map(field => field.name);
    
    if (missingFields.length > 0) {
      const missingFieldsText = missingFields.join(', ');
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      // Create the match sheet
      await addMatchSheet({
        tournamentId: selectedTournament,
        templateId: selectedTemplate,
        ageCategoryId: selectedCategory,
        referentCoachId: referentCoach,
        playerIds: selectedPlayers,
        coachIds: selectedCoaches,
      });
      
      // Navigate back to match sheets list
      navigate('/match-sheets');
    } catch (error) {
      console.error('Error creating match sheet:', error);
      alert('Une erreur est survenue lors de la création de la feuille de match');
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
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle Feuille de Match</h1>
          <p className="text-gray-600 mt-1">
            Créez une nouvelle feuille de match en sélectionnant un tournoi et un modèle
          </p>
        </div>
      </div>

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
                {ageCategories.map((category) => (
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
            <div className="border border-gray-200 rounded-lg p-4">
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
                      {player.firstName} {player.lastName}
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
            <div className="border border-gray-200 rounded-lg p-4">
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
                      {coach.firstName} {coach.lastName}
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
              {selectedCoaches.map((coachId) => {
                const coach = coaches.find(c => c.id === coachId);
                return coach ? (
                  <option key={coach.id} value={coach.id}>
                    {coach.firstName} {coach.lastName}
                  </option>
                ) : null;
              })}
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
                  Création en cours...
                </>
              ) : (
                'Créer la feuille'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchSheetCreate;