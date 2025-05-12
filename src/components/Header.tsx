import React from 'react';
import { Menu, User } from 'lucide-react';

interface HeaderProps {
  openSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ openSidebar }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center">
          <button
            type="button"
            className="md:hidden text-gray-600 hover:text-gray-900 focus:outline-none"
            onClick={openSidebar}
          >
            <Menu size={24} />
          </button>
          <h1 className="ml-2 md:ml-0 text-lg sm:text-xl font-semibold text-blue-900">
            
          </h1>
        </div>
        
        <div className="flex items-center">
          <div className="flex items-center ml-4">
            <button 
              className="inline-flex items-center justify-center p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 focus:outline-none"
            >
              <User size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;