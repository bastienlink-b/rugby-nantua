import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Plus, Search, Edit, Trash2, Award, X, Tag } from 'lucide-react';

interface CoachFormData {
  firstName: string;
  lastName: string;
  licenseNumber: string;
  diploma: string;
  ageCategoryIds: string[];
}

const initialFormData: CoachFormData = {
  firstName: '',
  lastName: '',
  licenseNumber: '',
  diploma: '',
  ageCategoryIds: [],
};

const Coaches: React.FC = () => {
  const { coaches, ageCategories, addCoach, updateCoach, deleteCoach } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<CoachFormData>(initialFormData);
  const [editingCoachId, setEditingCoachId] = useState<string | null>(null);
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
    setEditingCoachId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one category is selected
    if (formData.ageCategoryIds.length === 0) {
      alert("Veuillez sélectionner au moins une catégorie d'âge.");
      return;
    }
    
    if (editingCoachId) {
      updateCoach(editingCoachId, { ...formData, id: editingCoachId });
    } else {
      addCoach(formData);
    }
    setIsModalOpen(false);
    resetForm();
  };

  const handleEdit = (coach: CoachFormData & { id: string }) => {
    setFormData(coach);
    setEditingCoachId(coach.id);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cet entraîneur ?')) {
      deleteCoach(id);
    }
  };

  // Trier les entraîneurs par ordre alphabétique du nom de famille
  const sortedCoaches = [...coaches].sort((a, b) => 
    a.lastName.localeCompare(b.lastName, 'fr-FR')
  );

  // Trier les catégories d'âge dans l'ordre spécifique (M6, M8, M10, etc.)
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

  const filteredCoaches = sortedCoaches.filter((coach) =>
    coach.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coach.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    coach.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getCategoryNames = (categoryIds: string[]) => {
    return categoryIds
      .map(id => {
        const category = ageCategories.find(cat => cat.id === id);
        return category?.name || 'Inconnu';
      })
      .sort((a, b) => {
        // Extraire le numéro de la catégorie (ex: M6 -> 6)
        const getAgeNumber = (name: string) => {
          const match = name.match(/M(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        };
        
        const ageA = getAgeNumber(a);
        const ageB = getAgeNumber(b);
        
        return ageA - ageB;
      })
      .join(', ');
  };

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Entraîneurs</h1>
          <p className="text-gray-600 mt-1">
            Gérez la liste des entraîneurs et leur qualification
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
          <span>Nouvel entraîneur</span>
        </button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher un entraîneur..."
            className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filteredCoaches.length > 0 ? (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prénom
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nom
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                  Licence
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Diplôme
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                  Catégories
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredCoaches.map((coach) => (
                <tr key={coach.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {coach.firstName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {coach.lastName}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                    {coach.licenseNumber || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                    {coach.diploma || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                    {getCategoryNames(coach.ageCategoryIds)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(coach)}
                      className="text-indigo-600 hover:text-indigo-900 mr-3"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(coach.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Award size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun entraîneur trouvé</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm
              ? "Aucun entraîneur ne correspond aux critères de recherche."
              : "Commencez par ajouter votre premier entraîneur."}
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
              Ajouter un entraîneur
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
                {editingCoachId ? 'Modifier l\'entraîneur' : 'Ajouter un entraîneur'}
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
                    Prénom
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numéro de licence FFR
                  </label>
                  <input
                    type="text"
                    name="licenseNumber"
                    value={formData.licenseNumber}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diplôme
                  </label>
                  <select
                    name="diploma"
                    value={formData.diploma}
                    onChange={handleInputChange}
                    className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sélectionner un diplôme</option>
                    <option value="Brevet Fédéral 1">Brevet Fédéral 1</option>
                    <option value="Brevet Fédéral 2">Brevet Fédéral 2</option>
                    <option value="Brevet Fédéral 3">Brevet Fédéral 3</option>
                    <option value="Diplôme d'État">Diplôme d'État</option>
                    <option value="DU développement">DU développement</option>
                    <option value="Autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Catégories d'âge (au moins une)
                  </label>
                  <div className="mt-2 space-y-2 border border-gray-300 rounded-md p-3">
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
                  {editingCoachId ? 'Mettre à jour' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coaches;