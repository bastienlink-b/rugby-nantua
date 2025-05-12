import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, ChevronDown, X, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const DAYS_OF_WEEK = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Couleurs pour les catégories - couleurs ajustées pour plus de contraste
const CATEGORY_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  '1': { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },      // M6
  '2': { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' }, // M8
  '3': { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' }, // M10 (changé de indigo à yellow)
  '4': { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' }, // M12 (changé de blue à orange)
  '5': { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },      // M14 (changé de cyan à blue)
  '6': { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' },         // M16 (changé de teal à red)
  '7': { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-200' },      // M19 (changé de green à lime)
};

// Couleur par défaut si la catégorie n'est pas trouvée
const DEFAULT_COLOR = { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };

// Type pour les événements dans le calendrier
interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  categoryIds: string[];
}

const Calendar: React.FC = () => {
  const { tournaments, ageCategories } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState<Date[]>([]);
  const [events, setEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  // Initialiser avec toutes les catégories sélectionnées
  useEffect(() => {
    setCategoryFilter(ageCategories.map(cat => cat.id));
  }, [ageCategories]);

  // Générer les jours du calendrier pour le mois actuel
  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Premier jour du mois
    const firstDay = new Date(year, month, 1);
    // Dernier jour du mois
    const lastDay = new Date(year, month + 1, 0);
    
    // Jour de la semaine du premier jour (0 = dimanche, 1 = lundi, etc.)
    const firstDayOfWeek = firstDay.getDay();
    
    // Nombre de jours à afficher du mois précédent
    const daysFromPrevMonth = firstDayOfWeek;
    
    // Premier jour à afficher (peut être du mois précédent)
    const startDate = new Date(year, month, 1 - daysFromPrevMonth);
    
    // Nombre total de jours à afficher (42 = 6 semaines)
    const totalDays = 42;
    
    // Générer tous les jours
    const days: Date[] = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    
    setCalendarDays(days);
  }, [currentDate]);

  // Convertir les tournois en événements de calendrier
  useEffect(() => {
    const eventsByDate: Record<string, CalendarEvent[]> = {};
    
    tournaments.forEach(tournament => {
      // Correction pour s'assurer que la date est correctement parsée
      // Utilisation d'une date explicite pour éviter les problèmes de fuseaux horaires
      const dateParts = tournament.date.split('-');
      const year = parseInt(dateParts[0], 10);
      const month = parseInt(dateParts[1], 10) - 1; // Les mois commencent à 0 en JS
      const day = parseInt(dateParts[2], 10);
      
      // Créer la date en utilisant les composants explicites pour éviter les problèmes de fuseau horaire
      const date = new Date(year, month, day);
      
      // Utiliser directement l'année, le mois et le jour pour créer la clé
      // Format: "YYYY-MM-DD" (avec padding des zéros)
      const formattedMonth = (month + 1).toString().padStart(2, '0');
      const formattedDay = day.toString().padStart(2, '0');
      const dateKey = `${year}-${formattedMonth}-${formattedDay}`;
      
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      
      eventsByDate[dateKey].push({
        id: tournament.id,
        date,
        title: tournament.location,
        categoryIds: tournament.ageCategoryIds,
      });
    });
    
    setEvents(eventsByDate);
  }, [tournaments]);

  // Naviguer au mois précédent
  const prevMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  // Naviguer au mois suivant
  const nextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  // Naviguer au mois courant
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Formater la date pour l'utiliser comme clé
  const formatDateKey = (date: Date) => {
    // Utiliser directement les composants de date pour éviter les problèmes de fuseau horaire
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Vérifier si un événement doit être affiché selon les filtres de catégorie
  const shouldShowEvent = (event: CalendarEvent) => {
    // Si aucun filtre, montrer tous les événements
    if (categoryFilter.length === 0) return true;
    
    // Sinon, vérifier si au moins une catégorie de l'événement est dans le filtre
    return event.categoryIds.some(catId => categoryFilter.includes(catId));
  };

  // Basculer la sélection d'une catégorie dans le filtre
  const toggleCategoryFilter = (categoryId: string) => {
    setCategoryFilter(prev => {
      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      } else {
        return [...prev, categoryId];
      }
    });
  };

  // Sélectionner/désélectionner toutes les catégories
  const toggleAllCategories = () => {
    if (categoryFilter.length === ageCategories.length) {
      setCategoryFilter([]);
    } else {
      setCategoryFilter(ageCategories.map(cat => cat.id));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendrier des Tournois</h1>
        <p className="text-gray-600 mt-1">
          Visualisez tous les tournois par mois et par catégorie
        </p>
      </div>

      {/* Navigation et filtres */}
      <div className="mb-6 bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <div className="flex items-center mb-4 sm:mb-0">
            <button
              onClick={prevMonth}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="mx-4 text-lg font-medium">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={goToToday}
              className="ml-4 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Aujourd'hui
            </button>
          </div>
          
          <div className="w-full sm:w-auto">
            <details className="relative w-full sm:w-auto">
              <summary className="flex items-center justify-between px-4 py-2 text-sm font-medium border border-gray-300 rounded-md cursor-pointer bg-white hover:bg-gray-50">
                <div className="flex items-center">
                  <CalendarIcon size={16} className="mr-2 text-gray-500" />
                  <span>Filtrer par catégorie</span>
                </div>
                <ChevronDown size={16} className="ml-2 text-gray-500" />
              </summary>
              <div className="absolute z-10 mt-1 w-56 origin-top-right right-0 bg-white rounded-md shadow-lg border border-gray-100">
                <div className="p-2">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <button 
                      onClick={toggleAllCategories}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {categoryFilter.length === ageCategories.length ? 'Désélectionner tout' : 'Sélectionner tout'}
                    </button>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {ageCategories.map(category => {
                      const colors = CATEGORY_COLORS[category.id] || DEFAULT_COLOR;
                      return (
                        <label 
                          key={category.id} 
                          className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                          <input 
                            type="checkbox"
                            checked={categoryFilter.includes(category.id)}
                            onChange={() => toggleCategoryFilter(category.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <div className="ml-2 flex items-center">
                            <div className={`w-3 h-3 rounded-full ${colors.bg} ${colors.border} mr-2`}></div>
                            <span className="text-sm text-gray-700">{category.name}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Légende des catégories */}
        <div className="flex flex-wrap gap-2 mt-2">
          {ageCategories.map(category => {
            const colors = CATEGORY_COLORS[category.id] || DEFAULT_COLOR;
            const isActive = categoryFilter.includes(category.id);
            
            return (
              <button
                key={category.id}
                onClick={() => toggleCategoryFilter(category.id)}
                className={`px-2 py-1 text-xs rounded-md border transition-all ${
                  isActive 
                    ? `${colors.bg} ${colors.text} ${colors.border}` 
                    : 'bg-gray-100 text-gray-500 border-gray-200 opacity-60'
                }`}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendrier */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 border-b">
          {DAYS_OF_WEEK.map((day, index) => (
            <div 
              key={day} 
              className={`py-2 text-center text-sm font-medium text-gray-500 ${
                index === 0 || index === 6 ? 'bg-gray-50' : ''
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Jours du mois */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();
            const dateKey = formatDateKey(day);
            const dayEvents = events[dateKey] || [];
            
            // Filtrer les événements selon les catégories sélectionnées
            const filteredEvents = dayEvents.filter(shouldShowEvent);
            
            return (
              <div 
                key={index}
                className={`min-h-28 border-b border-r p-1 ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isToday ? 'border-blue-300 border-2' : ''}`}
              >
                <div className={`text-right text-sm ${
                  isCurrentMonth 
                    ? isToday
                      ? 'font-bold text-blue-600'
                      : 'text-gray-700'
                    : 'text-gray-400'
                }`}>
                  {day.getDate()}
                </div>
                
                {/* Événements du jour */}
                <div className="mt-1 space-y-1 max-h-24 overflow-y-auto">
                  {filteredEvents.map(event => {
                    // Pour chaque événement, choisir la couleur de la première catégorie
                    const firstCategoryId = event.categoryIds[0];
                    const color = firstCategoryId ? CATEGORY_COLORS[firstCategoryId] || DEFAULT_COLOR : DEFAULT_COLOR;
                    
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={`block w-full text-left px-2 py-1 text-xs rounded-md truncate ${color.bg} ${color.text} ${color.border} hover:opacity-80`}
                      >
                        {event.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal pour afficher les détails d'un événement */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Détails du tournoi
              </h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div>
                <h4 className="font-medium text-lg">{selectedEvent.title}</h4>
                <p className="text-gray-600">
                  {selectedEvent.date.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Catégories</h5>
                <div className="flex flex-wrap gap-1">
                  {selectedEvent.categoryIds.map(catId => {
                    const category = ageCategories.find(c => c.id === catId);
                    const color = CATEGORY_COLORS[catId] || DEFAULT_COLOR;
                    
                    return category ? (
                      <span 
                        key={catId}
                        className={`px-2 py-1 text-xs rounded-md ${color.bg} ${color.text} ${color.border}`}
                      >
                        {category.name}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Fermer
                </button>
                
                <Link
                  to={`/match-sheets?tournamentId=${selectedEvent.id}`}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                  onClick={() => setSelectedEvent(null)}
                >
                  Créer une feuille de match
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Message si aucun tournoi */}
      {tournaments.length === 0 && (
        <div className="mt-6 bg-white rounded-lg shadow-sm p-8 text-center">
          <Info size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun tournoi programmé</h3>
          <p className="text-gray-500 mb-6">
            Ajoutez des tournois pour qu'ils apparaissent dans le calendrier.
          </p>
          <Link
            to="/tournaments"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus size={18} className="mr-2" />
            Ajouter un tournoi
          </Link>
        </div>
      )}
    </div>
  );
};

export default Calendar;