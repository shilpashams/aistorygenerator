import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Menu, X } from 'lucide-react';

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          <a href="#" className="flex items-center gap-2">
            <BookOpen className="w-8 h-8 text-brand-500" />
            <span className="font-display text-xl font-bold text-gray-900">
              Adventures Of
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8">
            <Link to="/dashboard" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              Dashboard
            </Link>
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
              How It Works
            </a>
            <Link
              to="/create/photos"
              className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-brand-500 rounded-full hover:bg-brand-600 transition-colors"
            >
              Create a Story
            </Link>
          </nav>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-600"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 shadow-lg">
          <nav className="flex flex-col px-4 py-4 gap-3">
            <Link to="/dashboard" onClick={() => setMobileOpen(false)} className="py-2 text-gray-700 font-medium">Dashboard</Link>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="py-2 text-gray-700 font-medium">How It Works</a>
            <Link to="/create/photos" onClick={() => setMobileOpen(false)} className="btn-primary text-center mt-2">Create a Story</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
