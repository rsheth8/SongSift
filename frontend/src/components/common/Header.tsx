import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../../styling/common/header.css';

const Header: React.FC = () => {
    const location = useLocation();

    return (
        <header className="app-header">
            <div className="logo-container">
                <Link to="/">
                    <img src="/assets/images/logo.png" alt="TuneSift Logo" className="logo" />
                    <span className="app-name">TuneSift</span>
                </Link>
            </div>

            <nav className="main-nav">
                <ul>
                    <li className={location.pathname === '/' ? 'active' : ''}>
                        <Link to="/">Library</Link>
                    </li>
                    <li className={location.pathname.includes('/playlists') ? 'active' : ''}>
                        <Link to="/playlists/generate">Playlists</Link>
                    </li>
                    <li className={location.pathname === '/music-map' ? 'active' : ''}>
                        <Link to="/music-map">Music Map</Link>
                    </li>
                    <li className={location.pathname === '/mashup' ? 'active' : ''}>
                        <Link to="/mashup">Mashup</Link>
                    </li>
                </ul>
            </nav>
        </header>
    );
};

export default Header;
