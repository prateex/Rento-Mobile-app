import { useNavigate } from 'react-router-dom';
import { SearchBar } from '@/components/search/SearchBar';
import type { SearchParams } from '@/types';
import { Search, Shield, Clock, Star } from 'lucide-react';

export function Home() {
  const navigate = useNavigate();

  const handleSearch = (params: SearchParams) => {
    const searchParams = new URLSearchParams();
    searchParams.set('state', params.state);
    searchParams.set('city', params.city);
    searchParams.set('startDate', params.startDate);
    searchParams.set('endDate', params.endDate);
    navigate(`/search?${searchParams.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-primary px-4 py-16 text-secondary sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center rounded-full bg-secondary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-secondary">
              Zero deposit on select rentals
            </div>
            <h1 className="mt-4 text-4xl font-bold sm:text-5xl lg:text-6xl">
              Ride anywhere with confidence
            </h1>
            <p className="mt-4 text-lg text-secondary/80">
              Pick your state, city, and time. Discover verified bikes with transparent pricing.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-secondary/80">
              <span className="rounded-full bg-secondary/10 px-3 py-1">Instant booking</span>
              <span className="rounded-full bg-secondary/10 px-3 py-1">Verified vendors</span>
              <span className="rounded-full bg-secondary/10 px-3 py-1">24x7 support</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mx-auto w-full max-w-2xl lg:mx-0">
            <SearchBar onSearch={handleSearch} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-secondary">Trusted marketplace</p>
            <h2 className="mt-2 text-3xl font-bold text-gray-900">
              Why Choose Rento?
            </h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="rounded-lg bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/30">
                <Search className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Wide Selection</h3>
              <p className="text-gray-600">
                Choose from thousands of bikes and scooters across multiple cities
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-lg bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/30">
                <Shield className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Verified Vendors</h3>
              <p className="text-gray-600">
                All rental providers are verified for your safety and security
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-lg bg-white p-8 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/30">
                <Clock className="h-8 w-8 text-secondary" />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900">Instant Booking</h3>
              <p className="text-gray-600">
                Book in seconds with real-time availability and instant confirmation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white px-4 py-16">
        <div className="mx-auto max-w-7xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-gray-900">
            How It Works
          </h2>

          <div className="grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-xl font-bold text-white">
                1
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Search</h3>
              <p className="text-sm text-gray-600">Enter your city and dates to find available vehicles</p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-xl font-bold text-white">
                2
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Choose</h3>
              <p className="text-sm text-gray-600">Browse and select the perfect bike for your trip</p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-xl font-bold text-white">
                3
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Book</h3>
              <p className="text-sm text-gray-600">Complete your booking with secure online payment</p>
            </div>

            <div className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-xl font-bold text-white">
                4
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">Ride</h3>
              <p className="text-sm text-gray-600">Pick up your vehicle and enjoy your journey!</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-secondary px-4 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="text-center">
              <p className="mb-2 text-4xl font-bold">10,000+</p>
              <p className="text-white/80">Vehicles</p>
            </div>
            <div className="text-center">
              <p className="mb-2 text-4xl font-bold">50+</p>
              <p className="text-white/80">Cities</p>
            </div>
            <div className="text-center">
              <p className="mb-2 text-4xl font-bold">500+</p>
              <p className="text-white/80">Vendors</p>
            </div>
            <div className="text-center">
              <p className="mb-2 text-4xl font-bold">4.8</p>
              <div className="flex items-center justify-center">
                <Star className="mr-1 h-5 w-5 fill-yellow-400 text-yellow-400" />
                <p className="text-white/80">Rating</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
