import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Layout() {
  const { user, signIn, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="navbar">
        <Link to="/" className="nav-brand">Storytime</Link>
        <nav className="nav-links">
          {user ? (
            <>
              <button className="btn btn-ghost" onClick={() => navigate('/write')}>
                My Stories
              </button>
              <div className="nav-user">
                {user.photoURL && (
                  <img src={user.photoURL} alt={user.displayName ?? ''} className="avatar" />
                )}
                <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
              </div>
            </>
          ) : (
            <button className="btn btn-primary" onClick={signIn}>
              Sign in with Google
            </button>
          )}
        </nav>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
