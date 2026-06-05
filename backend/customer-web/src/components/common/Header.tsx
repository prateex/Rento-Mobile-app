import { Link, useNavigate } from 'react-router-dom';
import { User, LogOut, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from './Button';

export function Header() {
  const { isAuthenticated, platformUser, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="text-xl font-bold text-secondary">R</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Rento</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Link
                  to="/my-bookings"
                  className="flex items-center space-x-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Calendar className="h-4 w-4" />
                  <span>My Bookings</span>
                </Link>

                <div className="flex items-center space-x-3 border-l border-gray-300 pl-4">
                  <div className="flex items-center space-x-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                      <User className="h-4 w-4 text-secondary" />
                    </div>
                    <div className="hidden flex-col sm:flex">
                      <span className="text-sm font-medium text-gray-900">
                        {platformUser?.email || 'User'}
                      </span>
                      <span className="text-xs text-gray-500">{platformUser?.role}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center space-x-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="h-4 w-4" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              </>
            ) : (
              <Button size="sm" onClick={() => navigate('/login')}>
                Sign In
              </Button>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
