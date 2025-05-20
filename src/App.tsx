import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Coaches from './pages/Coaches';
import Tournaments from './pages/Tournaments';
import Calendar from './pages/Calendar';
import MatchSheets from './pages/MatchSheets';
import MatchSheetCreate from './pages/MatchSheetCreate';
import Templates from './pages/Templates';
import { AppProvider } from './context/AppContext';

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="players" element={<Players />} />
            <Route path="coaches" element={<Coaches />} />
            <Route path="tournaments" element={<Tournaments />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="templates" element={<Templates />} />
            <Route path="match-sheets">
              <Route index element={<MatchSheets />} />
              <Route path="create" element={<MatchSheetCreate />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;