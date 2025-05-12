import React from 'react';
import { useAppContext } from '../context/AppContext';
import { UserPlus, CalendarDays, FileText, Award, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  to: string;
}> = ({ title, value, icon, color, to }) => (
  <Link to={to}>
    <div className={`p-4 bg-white rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow`}>
      <div className="flex items-center">
        <div className={`flex-shrink-0 rounded-full p-2 ${color}`}>{icon}</div>
        <div className="ml-3">
          <h3 className="text-base font-medium text-gray-700">{title}</h3>
          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  </Link>
);

const Dashboard: React.FC = () => {
  const { players, coaches, tournaments, matchSheets } = useAppContext();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-gray-600 mt-1">
          Gérez vos équipes et générez des feuilles de matchs de rugby
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Joueurs"
          value={players.length}
          icon={<UserPlus size={20} className="text-white" />}
          color="bg-blue-600"
          to="/players"
        />
        <StatCard
          title="Entraîneurs"
          value={coaches.length}
          icon={<Award size={20} className="text-white" />}
          color="bg-indigo-600"
          to="/coaches"
        />
        <StatCard
          title="Tournois"
          value={tournaments.length}
          icon={<CalendarDays size={20} className="text-white" />}
          color="bg-purple-600"
          to="/tournaments"
        />
        <StatCard
          title="Feuilles de match"
          value={matchSheets.length}
          icon={<FileText size={20} className="text-white" />}
          color="bg-emerald-600"
          to="/match-sheets"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Prochains tournois</h2>
            <Link 
              to="/calendar" 
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
            >
              <Calendar size={16} className="mr-1" />
              Voir le calendrier
            </Link>
          </div>
          
          {tournaments.length > 0 ? (
            <div className="space-y-4">
              {tournaments.slice(0, 3).map((tournament) => (
                <div key={tournament.id} className="border-b pb-3 last:border-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{tournament.location}</p>
                      <p className="text-sm text-gray-600">
                        {new Date(tournament.date).toLocaleDateString("fr-FR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <Link 
                      to={`/match-sheets?tournamentId=${tournament.id}`}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Créer une feuille
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">Aucun tournoi programmé</p>
          )}
          <div className="mt-4">
            <Link
              to="/tournaments"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Voir tous les tournois →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Feuilles récentes</h2>
          {matchSheets.length > 0 ? (
            <div className="space-y-4">
              {matchSheets.slice(0, 3).map((sheet) => {
                const tournament = tournaments.find(t => t.id === sheet.tournamentId);
                const category = sheet.ageCategoryId ? 
                  tournament?.ageCategoryIds.includes(sheet.ageCategoryId) ? 
                    sheet.ageCategoryId : null : null;
                
                return (
                  <div key={sheet.id} className="border-b pb-3 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">
                        {tournament?.location || 'Tournoi inconnu'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Créée le {sheet.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center justify-center text-center">
              <FileText size={48} className="text-gray-300 mb-3" />
              <p className="text-gray-500 mb-1">Aucune feuille de match créée</p>
              <Link
                to="/match-sheets"
                className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Créer une feuille de match
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;