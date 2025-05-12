import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit, Trash2, Calendar, X, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TournamentFormData {
  date: string;
  location: string;
  ageCategoryIds: string[];
}

const initialFormData: TournamentFormData = {
  date: '',
  location: '',
  ageCategoryIds: [],
};

const Tournaments: React.FC = () => {
  const { tournaments, ageCategories, addTournament, updateTournament, deleteTournament } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<TournamentFormData>(initialFormData);
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
    setEditingTournamentId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one category is selected
    if (formData.ageCategoryIds.length === 0) {
      alert("Veuillez sélectionner au moins une catégorie d'âge.");
      return;
    }
    
    if (editingTournamentId) {
      updateTournament(editingTournamentId, { ...formData, id: editingTournamentId });
    } else {
      addTournament(formData);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (tournament: Omit<TournamentFormData, 'ageCategoryIds'> & { id: string, ageCategoryIds: string[] }) => {
    setFormData({
      date: tournament.date,
      location: tournament.location,
      ageCategoryIds: tournament.ageCategoryIds,
    });
    setEditingTournamentId(tournament.id);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce tournoi ?')) {
      deleteTournament(id);
    }
  };

  const filteredTournaments = tournaments.filter(tournament =>
    tournament.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    new Date(tournament.date).toLocaleDateString().includes(searchTerm)
  );

  const getCategoryNames = (categoryIds: string[]) => {
    return categoryIds.map(id => 
      ageCategories.find(cat => cat.id === id)?.name || 'Inconnu'
    ).join(', ');
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tournois</h1>
          <p className="text-gray-600 mt-1">
            Gérez la liste des tournois et leurs informations
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center"
        >
          <Plus size={18} className="mr-1" />
          <span>Nouveau tournoi</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un tournoi..."
            className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredTournaments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTournaments.map((tournament) => (
            <div key={tournament.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {tournament.location}
                  </h3>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEdit(tournament)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(tournament.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center text-gray-600">
                    <Calendar size={16} className="mr-2" />
                    <p>
                      {new Date(tournament.date).toLocaleDateString("fr-FR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="flex items-start">
                    <Tag size={16} className="mr-2 text-gray-600 mt-0.5" />
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Catégories:</span> {getCategoryNames(tournament.ageCategoryIds)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <Link
                    to={`/match-sheets?tournamentId=${tournament.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Créer une feuille de match →
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Calendar size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun tournoi trouvé</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm
              ? "Aucun tournoi ne correspond aux critères de recherche."
              : "Commencez par ajouter votre premier tournoi."}
          </p>
          {!searchTerm && (
            <button
              onClick={() => {
                resetForm();
                setIsModalOpen(true);
              }}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus size={18} className="mr-2" />
              Ajouter un tournoi
            </button>
          )}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                {editingTournamentId ? 'Modifier le tournoi' : 'Ajouter un tournoi'}
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

            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Lieu
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégories d'âge (au moins une)
                  </label>
                  <div className="mt-2 space-y-2 border border-gray-300 rounded-md p-3">
                    {ageCategories.map((category) => (
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
              </div>

              <div className="mt-6 flex justify-end space-x-3">
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
                    formData.ageCategoryIds.length === 0 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                  disabled={formData.ageCategoryIds.length === 0}
                >
                  {editingTournamentId ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tournaments;