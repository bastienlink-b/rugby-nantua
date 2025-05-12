import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, LayoutDashboard, Users, Award, CalendarDays, FileSpreadsheet, FileText, Calendar } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  closeSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, closeSidebar }) => {
  const navigation = [
    { name: 'Tableau de bord', href: '/', icon: LayoutDashboard },
    { name: 'Joueurs', href: '/players', icon: Users },
    { name: 'Entraîneurs', href: '/coaches', icon: Award },
    { name: 'Tournois', href: '/tournaments', icon: CalendarDays },
    { name: 'Calendrier', href: '/calendar', icon: Calendar },
    { name: 'Modèles', href: '/templates', icon: FileText },
    { 
      name: 'Feuilles de match', 
      href: '/match-sheets', 
      icon: FileSpreadsheet,
      isPrimary: true, // Marquer cet élément comme primaire
    },
  ];

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 md:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-blue-900 transition duration-300 ease-in-out transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 md:static md:inset-0`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-blue-800">
          <div className="flex items-center">
            <img 
              src="https://qsbdzoidcjywrrbuymlw.supabase.co/storage/v1/object/public/modeles/media/getimg_ai_img-OSJYijDHURruIIjiAn59J.png" 
              alt="US Nantua Haut Bugey Rugby" 
              className="h-10 object-contain mr-2"
            />
            <span className="text-xl font-semibold text-white">Nantua Rugby</span>
          </div>
          <button
            type="button"
            className="text-white hover:text-gray-200 md:hidden"
            onClick={closeSidebar}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="mt-5 px-2 space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `group flex items-center px-2 py-2 text-base font-medium rounded-md transition-colors ${
                  item.isPrimary 
                    ? 'text-white bg-green-600 hover:bg-green-700 shadow-md font-semibold' 
                    : isActive
                      ? 'bg-blue-800 text-white'
                      : 'text-blue-100 hover:bg-blue-800 hover:text-white'
                } ${item.isPrimary && isActive ? 'bg-green-700' : ''} ${item.isPrimary ? 'py-3 my-2' : ''}`
              }
              onClick={() => {
                if (window.innerWidth < 768) {
                  closeSidebar();
                }
              }}
            >
              <item.icon className={`mr-3 flex-shrink-0 h-6 w-6 ${item.isPrimary ? 'h-7 w-7' : ''}`} aria-hidden="true" />
              {item.name}
              {item.isPrimary && (
                <span className="flex h-2 w-2 ml-2 bg-white rounded-full animate-pulse"></span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;