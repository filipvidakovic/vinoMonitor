import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Layout.css';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="layout">
      <nav className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-brand">
            🍇 VinoMonitor
          </Link>

          <div className="navbar-menu">
            <Link to="/" className={`nav-link ${isActive('/') && location.pathname === '/' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link to="/vineyards" className={`nav-link ${isActive('/vineyards') ? 'active' : ''}`}>
              Vinogradi
            </Link>
            <Link to="/harvests" className={`nav-link ${isActive('/harvests') ? 'active' : ''}`}>
              Berbe
            </Link>
            <Link to="/fermentation" className={`nav-link ${isActive('/fermentation') ? 'active' : ''}`}>
              Fermentacija
            </Link>
          </div>

          <div className="navbar-user">
            <div className="user-info">
              <span className="user-name">
                {user?.first_name} {user?.last_name}
              </span>
              <span className={`user-role badge badge-${user?.role}`}>
                {user?.role}
              </span>
            </div>
            <button onClick={handleLogout} className="btn btn-logout">
              Odjavi se
            </button>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="footer">
        <div className="footer-content">
          <p>© 2026 VinoMonitor - Winery Management System</p>
          <p className="footer-links">
            <a href="https://github.com/filipvidakovic/vinomonitor" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            {' | '}
            <a href="/docs" target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;