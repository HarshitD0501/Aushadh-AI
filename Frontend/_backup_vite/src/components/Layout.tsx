import React from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { Disclaimer } from './Disclaimer';
import { Footer } from './Footer';

export const Layout: React.FC = () => {
  return (
    <div className="app-container">
      <Header />
      <Navigation />
      <main className="main-content" id="main-content">
        <Disclaimer />
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
