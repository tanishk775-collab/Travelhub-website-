import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './components/Logo';
import { 
  Compass, 
  MapPin, 
  Calendar, 
  Users, 
  Star, 
  ChevronRight, 
  User, 
  History, 
  Search,
  CheckCircle2,
  X,
  Navigation,
  Heart,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { SAMPLE_PACKAGES } from './constants';
import { Package, UserProfile, Booking, Category, Review } from './types';
import { getPersonalizedRecommendations } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [packages, setPackages] = useState<Package[]>(SAMPLE_PACKAGES);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'discover' | 'my-bookings' | 'exclusive'>('discover');
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (selectedPackage) {
      fetchReviews(selectedPackage.id);
    } else {
      setReviews([]);
    }
  }, [selectedPackage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        fetchProfile(u.uid);
        fetchMyBookings(u.uid);
      } else {
        setProfile(null);
        setMyBookings([]);
        setRecommendedIds([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile && profile.preferences.length > 0) {
      getPersonalizedRecommendations(profile.preferences, packages).then(setRecommendedIds);
    }
  }, [profile, packages]);

  const fetchProfile = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        setProfile(userDoc.data() as UserProfile);
      } else {
        // Create default profile
        const newProfile: UserProfile = {
          id: uid,
          name: auth.currentUser?.displayName || 'Traveler',
          email: auth.currentUser?.email || '',
          preferences: ['Luxury', 'Beach'],
          savedPackages: []
        };
        await setDoc(doc(db, 'users', uid), newProfile);
        setProfile(newProfile);
      }
    } catch (e) {
      console.error("Profile fetch error", e);
    }
  };

  const fetchMyBookings = async (uid: string) => {
    try {
      const q = query(collection(db, 'bookings'), where('userId', '==', uid));
      const snapshot = await getDocs(q);
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
      setMyBookings(bookings.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'bookings');
    }
  };

  const fetchReviews = async (packageId: string) => {
    try {
      const q = query(collection(db, 'reviews'), where('packageId', '==', packageId));
      const snapshot = await getDocs(q);
      const fetchedReviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
      setReviews(fetchedReviews.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
    } catch (e) {
      console.error("Reviews fetch error", e);
    }
  };

  const handleSubmitReview = async (reviewData: { rating: number; comment: string }) => {
    if (!user || !selectedPackage) return;

    try {
      const newReview: Omit<Review, 'id'> = {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        packageId: selectedPackage.id,
        rating: reviewData.rating,
        comment: reviewData.comment,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'reviews'), newReview);
      setReviews(prev => [{ id: docRef.id, ...newReview, createdAt: { toMillis: () => Date.now() } } as Review, ...prev]);
      
      // Update package rating local state (simplified)
      const newTotalReviews = selectedPackage.totalReviews + 1;
      const newRating = ((selectedPackage.rating * selectedPackage.totalReviews) + reviewData.rating) / newTotalReviews;
      
      setPackages(prev => prev.map(p => p.id === selectedPackage.id ? { ...p, rating: parseFloat(newRating.toFixed(1)), totalReviews: newTotalReviews } : p));
      setSelectedPackage(prev => prev ? { ...prev, rating: parseFloat(newRating.toFixed(1)), totalReviews: newTotalReviews } : null);

    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'reviews');
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSignOut = () => auth.signOut();

  const handleBooking = async (details: { startDate: string; endDate: string; guests: number; hasInsurance: boolean, insuranceCost: number }) => {
    if (!user || !selectedPackage) return;

    try {
      const bookingData: Omit<Booking, 'id'> = {
        userId: user.uid,
        packageId: selectedPackage.id,
        packageName: selectedPackage.name,
        startDate: details.startDate,
        endDate: details.endDate,
        guests: details.guests,
        totalAmount: (selectedPackage.price * details.guests) + (details.hasInsurance ? details.insuranceCost : 0),
        status: 'pending',
        createdAt: serverTimestamp(),
        hasInsurance: details.hasInsurance,
        insuranceCost: details.hasInsurance ? details.insuranceCost : 0
      };

      await addDoc(collection(db, 'bookings'), bookingData);
      setShowBookingModal(false);
      fetchMyBookings(user.uid);
      setSelectedPackage(null);
      // Optional: show success toast or view bookings
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'bookings');
    }
  };

  const recommendedPackages = packages.filter(p => recommendedIds.includes(p.id));
  const otherPackages = packages.filter(p => !recommendedIds.includes(p.id));

  return (
    <div className="min-h-screen bg-[#FFF9F2] text-[#1A1A1A] font-sans selection:bg-[#FF6321]/20">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FFF9F2]/80 backdrop-blur-md border-b border-[#1A1A1A]/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div onClick={() => setActiveTab('discover')}>
            <Logo className="cursor-pointer transition-transform hover:scale-105" />
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-bold uppercase tracking-widest text-[#555]">
            <button 
              onClick={() => setActiveTab('discover')}
              className={cn("hover:text-[#FF6321] transition-colors cursor-pointer", activeTab === 'discover' && "text-[#FF6321]")}
            >
              Discover
            </button>
            {user && (
              <button 
                onClick={() => setActiveTab('my-bookings')}
                className={cn("hover:text-[#FF6321] transition-colors cursor-pointer", activeTab === 'my-bookings' && "text-[#FF6321]")}
              >
                My Journeys
              </button>
            )}
            <button 
              onClick={() => setActiveTab('exclusive')}
              className={cn("hover:text-[#FF6321] transition-colors cursor-pointer text-sm font-bold uppercase tracking-widest", activeTab === 'exclusive' && "text-[#FF6321]")}
            >
              Exclusive
            </button>
          </div>

          <div>
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase font-bold text-[#FF6321]">Traveler</span>
                  <span className="text-sm font-bold">{user.displayName}</span>
                </div>
                <button 
                  onClick={handleSignOut}
                  className="w-10 h-10 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center hover:bg-[#FF6321] transition-colors shadow-lg"
                >
                  <User className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                disabled={isLoggingIn}
                className="px-8 py-2.5 bg-[#1A1A1A] text-white rounded-full font-bold text-sm shadow-xl shadow-gray-200 hover:scale-105 transition-all"
              >
                {isLoggingIn ? '...' : 'Book Now'}
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-20">
        {activeTab === 'discover' ? (
          <>
            {/* Hero Section */}
            <section className="relative h-[85vh] flex items-center overflow-hidden">
              <div className="max-w-7xl mx-auto px-6 grid grid-cols-12 gap-8 items-center w-full">
                <div className="col-span-12 lg:col-span-6 relative z-10">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                  >
                    <span className="inline-block px-4 py-1.5 rounded-full bg-[#FF6321]/10 text-[#FF6321] text-[10px] font-black uppercase tracking-[0.3em] mb-6">
                      Exclusive Curations • World Awaits
                    </span>
                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-[0.9] text-[#1A1A1A]">
                      Find your next <br />
                      <span className="text-[#FF6321]">Adventure.</span>
                    </h1>
                    <p className="text-lg text-[#666] font-medium max-w-xl mb-10 leading-relaxed">
                      Personalized travel experiences curated just for you. 
                      Explore hidden gems and world-famous landmarks with TripHub.
                    </p>
                    
                    {/* Search Widget */}
                    <div className="bg-white p-6 rounded-[32px] shadow-2xl shadow-orange-100 border border-orange-50 max-w-md">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-[#FDF7F0] p-4 rounded-2xl">
                          <p className="text-[10px] uppercase font-black text-[#FF6321] mb-1">Destination</p>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3 h-3 text-[#FF6321]" />
                            <p className="text-sm font-bold">Anywhere</p>
                          </div>
                        </div>
                        <div className="bg-[#FDF7F0] p-4 rounded-2xl">
                          <p className="text-[10px] uppercase font-black text-[#FF6321] mb-1">Dates</p>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-[#FF6321]" />
                            <p className="text-sm font-bold">Flexible</p>
                          </div>
                        </div>
                      </div>
                      <button className="w-full py-4 bg-[#FF6321] text-white rounded-2xl font-black text-lg shadow-lg shadow-orange-300 hover:scale-[1.02] transition-transform">
                        Explore Now
                      </button>
                    </div>

                    <div className="mt-8 flex items-center gap-4">
                      <div className="flex -space-x-3">
                         {[1,2,3].map(i => (
                           <div key={i} className="w-10 h-10 rounded-full border-4 border-[#FFF9F2] bg-gray-200 overflow-hidden">
                             <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="user" />
                           </div>
                         ))}
                      </div>
                      <p className="text-sm font-bold text-[#1A1A1A]">4.9/5 <span className="font-normal text-[#666]">from 2k+ explorers</span></p>
                    </div>
                  </motion.div>
                </div>

                <div className="hidden lg:block col-span-6 relative h-[70vh]">
                   <div className="absolute top-0 right-0 w-[120%] h-full">
                      <div className="relative w-full h-full p-12">
                         <div className="absolute top-0 right-0 w-3/4 h-3/4 rounded-[40px] overflow-hidden shadow-2xl transform rotate-3">
                            <img src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover" alt="Travel" />
                         </div>
                         <div className="absolute bottom-12 left-0 w-2/3 h-2/3 rounded-[40px] overflow-hidden shadow-2xl border-[12px] border-white transform -rotate-6">
                            <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover" alt="Travel" />
                         </div>
                      </div>
                   </div>
                </div>
              </div>

              {/* Bottom Decoration Bar */}
              <div className="absolute bottom-0 left-0 right-0 h-2 bg-[#FF6321]" />
            </section>

            {/* Personalized Recommendations */}
            {recommendedPackages.length > 0 && (
              <section className="py-24 px-6 max-w-7xl mx-auto">
                <div className="bg-[#1A1A1A] p-10 md:p-12 rounded-[48px] text-white flex flex-col md:flex-row items-center justify-between gap-12 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6321]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                  <div className="relative z-10 flex-1">
                    <span className="text-[#FF6321] text-[10px] font-black uppercase tracking-[0.4em] mb-4 block">Recommended for you</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Your Next Masterpiece</h2>
                    <p className="text-gray-400 text-lg font-medium leading-relaxed max-w-lg">
                      Based on your preferences, we've identified {recommendedPackages.length} exclusive voyages that match your spirit.
                    </p>
                  </div>
                  <div className="relative z-10 flex flex-wrap gap-4 justify-center md:justify-end">
                    {recommendedPackages.slice(0, 2).map((pkg) => (
                      <button 
                        key={pkg.id}
                        onClick={() => { setSelectedPackage(pkg); setShowBookingModal(true); }}
                        className="p-6 bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl hover:bg-white hover:text-black transition-all text-left max-w-[240px]"
                      >
                        <p className="text-[10px] font-black text-[#FF6321] uppercase mb-1">{pkg.category}</p>
                        <p className="font-bold mb-4 line-clamp-1">{pkg.name}</p>
                        <div className="flex items-center justify-between">
                           <span className="font-black">${pkg.price}</span>
                           <ChevronRight className="w-4 h-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Featured Packages */}
            <section className="py-12 pb-24 px-6 max-w-7xl mx-auto">
              <div className="flex items-end justify-between mb-12 px-2">
                <div>
                  <h2 className="text-3xl font-black text-[#1A1A1A] tracking-tight">Trending Now</h2>
                  <p className="text-[#666] font-medium mt-1">Explore our most coveted global escapes.</p>
                </div>
                <button className="text-sm font-bold text-[#FF6321] underline underline-offset-8">View all destinations</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {packages.map((pkg, idx) => (
                  <PackageCard 
                    key={pkg.id} 
                    pkg={pkg} 
                    delay={idx * 0.05} 
                    onClick={() => {
                      setSelectedPackage(pkg);
                      setShowBookingModal(true);
                    }}
                  />
                ))}
              </div>
            </section>

            {/* Testimonials Section */}
            <section className="py-24 bg-[#1A1A1A] text-white">
              <div className="max-w-7xl mx-auto px-6">
                <div className="text-center mb-16">
                  <span className="text-[#FF6321] text-[10px] font-black uppercase tracking-[0.4em] mb-4 block">Stories from the Road</span>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter">Traveler Testimonials</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[
                    { name: "Sarah J.", city: "New York", text: "TripHub turned our honeymoon into a dream. The Santorini boat tour was private, romantic, and absolutely flawless.", img: "https://i.pravatar.cc/100?img=32" },
                    { name: "Michael T.", city: "London", text: "I've trekked Patagonia before, but never with this level of organization. Every guide was an expert. Truly high-end.", img: "https://i.pravatar.cc/100?img=12" },
                    { name: "Yuki K.", city: "Tokyo", text: "The cultural immersion in the Swiss Alps package was unexpected and beautiful. TripHub understands what luxury means.", img: "https://i.pravatar.cc/100?img=44" }
                  ].map((t, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white/5 border border-white/10 p-8 rounded-[32px] relative"
                    >
                      <Star className="w-8 h-8 text-[#FF6321] mb-6 opacity-20" />
                      <p className="text-lg font-medium text-gray-300 italic mb-8 leading-relaxed">"{t.text}"</p>
                      <div className="flex items-center gap-4">
                        <img src={t.img} alt={t.name} className="w-12 h-12 rounded-full border-2 border-[#FF6321]" />
                        <div>
                          <p className="font-bold">{t.name}</p>
                          <p className="text-[10px] uppercase font-black text-[#FF6321] tracking-widest">{t.city}</p>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* Why Choose Us / Value Add */}
            <section className="py-24 px-6 max-w-7xl mx-auto overflow-hidden">
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                  <div className="relative">
                     <div className="aspect-square rounded-[48px] overflow-hidden shadow-2xl">
                        <img src="https://images.unsplash.com/photo-1530789253388-582c481c54b0?auto=format&fit=crop&q=80&w=1200" className="w-full h-full object-cover" alt="Traveler" />
                     </div>
                     <div className="absolute -bottom-8 -right-8 bg-[#FF6321] p-10 rounded-[32px] text-white shadow-2xl max-w-[240px] hidden md:block">
                        <p className="text-4xl font-black mb-2">15+</p>
                        <p className="text-[10px] font-black uppercase tracking-widest">Years of Curating Extraordinary Memories</p>
                     </div>
                  </div>
                  <div>
                    <span className="text-[#FF6321] text-[10px] font-black uppercase tracking-[0.4em] mb-4 block">The TripHub Edge</span>
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#1A1A1A] mb-8">Why Discerning Travelers Choose Us</h2>
                    <div className="space-y-6">
                      {[
                        { title: "Personal Concierge", desc: "A dedicated expert assigned to your journey from planning to homecoming.", icon: User },
                        { title: "Exclusive Access", desc: "Skip lines and enter places closed to the public with our local connections.", icon: Navigation },
                        { title: "Seamless Comfort", desc: "From private jets to boutique stays, every detail is handled with precision.", icon: CheckCircle2 }
                      ].map((item, i) => (
                        <div key={i} className="flex gap-6 group">
                          <div className="w-14 h-14 rounded-2xl bg-[#FDF7F0] flex items-center justify-center shrink-0 group-hover:bg-[#FF6321] group-hover:text-white transition-colors">
                            <item.icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-xl font-bold mb-2">{item.title}</h4>
                            <p className="text-[#666] font-medium">{item.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
               </div>
            </section>

            {/* Contact / Inquiry Section */}
            <section id="contact" className="py-24 bg-[#FDF7F0]">
              <div className="max-w-7xl mx-auto px-6">
                <div className="bg-white rounded-[48px] shadow-2xl shadow-orange-100 overflow-hidden flex flex-col lg:flex-row">
                  <div className="lg:w-5/12 bg-[#1A1A1A] p-12 text-white flex flex-col justify-between">
                    <div>
                      <h2 className="text-4xl font-black mb-6">Plan your next <br /><span className="text-[#FF6321]">Masterpiece.</span></h2>
                      <p className="text-gray-400 font-medium mb-12">Leave your details and our senior concierge will reach out within 4 hours.</p>
                      
                      <div className="space-y-8">
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                            <MapPin className="w-5 h-5 text-[#FF6321]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-[#FF6321]">Headquarters</p>
                            <p className="font-bold">Mayfair, London • Ginza, Tokyo</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-[#FF6321]" />
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase text-[#FF6321]">Email Us</p>
                            <p className="font-bold">concierge@triphub.global</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-12 border-t border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#FF6321]">Available 24/7</p>
                    </div>
                  </div>

                  <div className="flex-1 p-12">
                     <form className="grid grid-cols-1 md:grid-cols-2 gap-8" onSubmit={(e) => e.preventDefault()}>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[#FF6321]">Full Name</label>
                           <input type="text" placeholder="Johnathan Doe" className="w-full bg-[#FDF7F0] border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6321] transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[#FF6321]">Email Address</label>
                           <input type="email" placeholder="john@voyage.com" className="w-full bg-[#FDF7F0] border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6321] transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[#FF6321]">Desired Destination</label>
                           <select className="w-full bg-[#FDF7F0] border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6321] transition-all appearance-none cursor-pointer">
                              <option>Santorini, Greece</option>
                              <option>Kyoto, Japan</option>
                              <option>Swiss Alps</option>
                              <option>Other / Custom</option>
                           </select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[#FF6321]">Travel Dates</label>
                           <input type="text" placeholder="Approx. Month & Year" className="w-full bg-[#FDF7F0] border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6321] transition-all" />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-widest text-[#FF6321]">Your Vision</label>
                           <textarea rows={4} placeholder="Describe the feeling you're chasing..." className="w-full bg-[#FDF7F0] border-0 rounded-2xl p-4 text-sm font-bold focus:ring-2 focus:ring-[#FF6321] transition-all" />
                        </div>
                        <button className="col-span-1 md:col-span-2 py-5 bg-[#FF6321] text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-200 hover:scale-[1.01] transition-all">
                           Send Inquiry
                        </button>
                     </form>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : activeTab === 'exclusive' ? (
          <section className="py-24 px-6 max-w-7xl mx-auto min-h-[60vh]">
            <div className="mb-16">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FF6321] mb-2 block">Premium Curations</span>
              <h2 className="text-5xl font-black tracking-tight text-[#1A1A1A]">Exclusive Voyages</h2>
              <p className="text-[#666] font-medium mt-4 max-w-lg">
                Hand-picked journeys that align with your unique travel spirit and refined preferences.
              </p>
            </div>

            {user ? (
              recommendedPackages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {recommendedPackages.map((pkg, idx) => (
                    <PackageCard 
                      key={pkg.id} 
                      pkg={pkg} 
                      delay={idx * 0.05} 
                      onClick={() => {
                        setSelectedPackage(pkg);
                        setShowBookingModal(true);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-24 rounded-[40px] bg-white border border-gray-100 shadow-xl shadow-gray-200/50">
                  <Compass className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                  <p className="text-[#666] font-medium text-lg mb-8">We're still curating your exclusive list. Try adjusting your preferences.</p>
                  <button 
                    onClick={() => setActiveTab('discover')}
                    className="px-10 py-4 bg-[#FF6321] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-200"
                  >
                    View All Collections
                  </button>
                </div>
              )
            ) : (
              <div className="text-center py-24 rounded-[40px] bg-white border border-gray-100 shadow-xl shadow-gray-200/50">
                <Globe className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                <h3 className="text-2xl font-black mb-4">A World of Privacy Awaits</h3>
                <p className="text-[#666] font-medium text-lg mb-8 max-w-md mx-auto">Sign in to unlock personalized exclusive voyages tailored to your specific travel DNA.</p>
                <button 
                  onClick={handleLogin}
                  className="px-10 py-4 bg-[#1A1A1A] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-gray-200"
                >
                  Unlock Access
                </button>
              </div>
            )}
          </section>
        ) : (
          <section className="py-24 px-6 max-w-4xl mx-auto min-h-[60vh]">
            <div className="mb-16">
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FF6321] mb-2 block">Personal History</span>
              <h2 className="text-5xl font-black tracking-tight text-[#1A1A1A]">My Journeys</h2>
            </div>

            {myBookings.length === 0 ? (
              <div className="text-center py-24 rounded-[40px] bg-white border border-gray-100 shadow-xl shadow-gray-200/50">
                <History className="w-16 h-16 text-gray-200 mx-auto mb-6" />
                <p className="text-[#666] font-medium text-lg mb-8">You haven't embarked on any journeys yet.</p>
                <button 
                  onClick={() => setActiveTab('discover')}
                  className="px-10 py-4 bg-[#FF6321] text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-orange-200"
                >
                  Start Exploring
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {myBookings.map((booking) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={booking.id} 
                    className="p-8 bg-white border border-gray-100 rounded-[32px] shadow-xl shadow-gray-100/50 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[#FF6321]/30 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-3 mb-3">
                         <span className={cn(
                           "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border",
                           booking.status === 'confirmed' ? "border-green-500/20 text-green-600 bg-green-50" : "border-orange-500/20 text-[#FF6321] bg-orange-50"
                         )}>
                           {booking.status}
                         </span>
                         <span className="text-gray-400 text-[10px] font-bold tracking-widest">REF: {booking.id.slice(-8).toUpperCase()}</span>
                      </div>
                      <h3 className="text-2xl font-black text-[#1A1A1A] tracking-tight mb-2">{booking.packageName}</h3>
                      <div className="flex flex-wrap items-center gap-6 text-sm text-[#666] font-medium mb-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#FF6321]" />
                          <span>{booking.startDate} — {booking.endDate}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-[#FF6321]" />
                          <span>{booking.guests} Travelers</span>
                        </div>
                      </div>
                      {booking.hasInsurance && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-lg w-fit border border-green-200">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span className="text-[10px] font-black uppercase tracking-widest">Insured Journey</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-black text-[#1A1A1A] tracking-tighter mb-1">${booking.totalAmount.toLocaleString()}</div>
                      <button className="text-[11px] font-black uppercase tracking-widest text-[#FF6321] hover:underline underline-offset-4">View Details</button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBookingModal && selectedPackage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBookingModal(false)}
              className="absolute inset-0 bg-[#1A1A1A]/40 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[48px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] border border-orange-50"
            >
              <div className="w-full md:w-5/12 aspect-square md:aspect-auto overflow-hidden">
                <img 
                  src={selectedPackage.images[0]} 
                  className="w-full h-full object-cover" 
                  alt={selectedPackage.name}
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-1 p-8 md:p-14 overflow-y-auto custom-scrollbar">
                <button 
                  onClick={() => setShowBookingModal(false)}
                  className="absolute top-8 right-8 w-10 h-10 rounded-full bg-[#FDF7F0] text-[#FF6321] flex items-center justify-center hover:bg-[#FF6321] hover:text-white transition-all shadow-md"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="mb-10">
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#FF6321] mb-3 block">{selectedPackage.category} Journey</span>
                  <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-[#1A1A1A] mb-4">{selectedPackage.name}</h2>
                  <div className="flex items-center gap-2 text-[#666] font-bold text-sm">
                    <MapPin className="w-4 h-4 text-[#FF6321]" />
                    <span>{selectedPackage.destination}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-8">
                     <div>
                       <p className="text-[#666] font-medium leading-relaxed mb-6 text-lg">{selectedPackage.description}</p>
                       <div className="flex flex-wrap gap-2 mb-10">
                          {selectedPackage.tags.map(t => (
                            <span key={t} className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 rounded-xl bg-[#FDF7F0] text-[#FF6321]">{t}</span>
                          ))}
                       </div>
                     </div>

                     <div className="bg-[#1A1A1A] p-8 rounded-[32px] text-white shadow-xl shadow-gray-200">
                       <div className="flex items-center justify-between mb-8">
                         <h4 className="text-xs font-black uppercase tracking-widest text-orange-400">Traveler Feedback</h4>
                         <div className="flex items-center gap-1">
                           <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                           <span className="text-sm font-bold">{selectedPackage.rating} <span className="text-white/40">({selectedPackage.totalReviews})</span></span>
                         </div>
                       </div>
                       
                       <div className="space-y-6 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mb-8">
                         {reviews.length > 0 ? (
                           reviews.map((r) => (
                             <div key={r.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                               <div className="flex items-center justify-between mb-2">
                                 <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">{r.userName}</span>
                                 <div className="flex gap-0.5">
                                   {[...Array(5)].map((_, i) => (
                                     <Star key={i} className={cn("w-2 h-2", i < r.rating ? "fill-yellow-400 text-yellow-400" : "text-white/20")} />
                                   ))}
                                 </div>
                               </div>
                               <p className="text-[12px] text-gray-300 leading-relaxed">{r.comment}</p>
                             </div>
                           ))
                         ) : (
                           <p className="text-sm text-white/40 italic text-center py-8">Be the first to review this journey.</p>
                         )}
                       </div>

                       {user ? (
                          <ReviewForm onSubmit={handleSubmitReview} />
                       ) : (
                          <div className="flex flex-col items-center gap-4 py-4 border-t border-white/5">
                            <p className="text-[10px] uppercase font-black tracking-widest text-white/60">Share your experience</p>
                            <button 
                              onClick={handleLogin}
                              className="px-6 py-2.5 bg-white text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#FF6321] hover:text-white transition-all"
                            >
                              Login to Review
                            </button>
                          </div>
                       )}
                     </div>
                   </div>

                   <BookingForm 
                    pricePerPerson={selectedPackage.price} 
                    onBook={handleBooking} 
                    isLoggedIn={!!user}
                    onLogin={handleLogin}
                   />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="py-24 px-6 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-16">
          <div className="max-w-sm">
            <Logo className="mb-8" />
            <p className="text-[#666] font-medium leading-relaxed mb-8">
              Personalized travel experiences curated just for you. Explore hidden gems and world-famous landmarks with the globe's finest experts.
            </p>
            <div className="flex gap-4">
              {['Ig', 'Tw', 'Li', 'Fb'].map(s => (
                <a key={s} href="#" className="w-12 h-12 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center hover:bg-[#FF6321] transition-all shadow-lg hover:-translate-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest">{s}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-12 text-[11px] font-black uppercase tracking-[0.3em]">
            <div className="space-y-8">
              <h4 className="text-[#FF6321]">Collections</h4>
              <ul className="space-y-4 text-[#555]">
                <li><a href="#" className="hover:text-[#FF6321] transition-colors">Coastal Dreams</a></li>
                <li><a href="#" className="hover:text-[#FF6321] transition-colors">Urban Wonders</a></li>
                <li><a href="#" className="hover:text-[#FF6321] transition-colors">Nature Mastery</a></li>
              </ul>
            </div>
            <div className="space-y-8">
              <h4 className="text-[#FF6321]">Company</h4>
              <ul className="space-y-4 text-[#555]">
                <li><a href="#" className="hover:text-[#FF6321] transition-colors">Our Ethos</a></li>
                <li><a href="#" className="hover:text-[#FF6321] transition-colors">Expeditions</a></li>
                <li><a href="#" className="hover:text-[#FF6321] transition-colors">Partners</a></li>
              </ul>
            </div>
            <div className="space-y-8 text-right hidden lg:block">
              <h4 className="text-[#FF6321]">Newsletter</h4>
              <p className="text-[#666] normal-case font-medium mb-4">Be the first to hear about curated retreats.</p>
              <div className="bg-[#FDF7F0] p-2 rounded-2xl flex gap-2">
                 <input type="text" placeholder="Email" className="bg-transparent px-4 text-xs w-full focus:outline-none" />
                 <button className="bg-[#FF6321] p-3 rounded-xl text-white"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-24 pt-8 border-t border-gray-50 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] font-bold uppercase tracking-[0.4em] text-[#999]">
          <span>© 2026 TripHub Platforms Inc.</span>
          <div className="flex gap-8">
            <a href="#" className="hover:text-[#FF6321]">Terms</a>
            <a href="#" className="hover:text-[#FF6321]">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PackageCard({ pkg, delay, onClick }: { pkg: Package; delay: number; onClick: () => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={{ y: -10 }}
      onClick={onClick}
      className="group cursor-pointer bg-white p-3 rounded-[40px] shadow-xl shadow-gray-100 hover:shadow-orange-100/50 transition-all border border-transparent hover:border-[#FF6321]/10"
    >
      <div className="relative aspect-square md:aspect-[4/5] overflow-hidden rounded-[32px] mb-6">
        <img 
          src={pkg.images[0]} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
          alt={pkg.name}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/60 via-transparent to-transparent opacity-40 group-hover:opacity-60 transition-opacity" />
        <div className="absolute top-5 left-5">
          <span className="px-4 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white border border-white/20">
            {pkg.category}
          </span>
        </div>
        <div className="absolute bottom-5 left-5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wider">
          7 Days / 6 Nights
        </div>
      </div>
      <div className="px-3 pb-3">
        <div className="flex justify-between items-start mb-1">
          <h3 className="text-xl font-black text-[#1A1A1A] tracking-tighter">{pkg.name}</h3>
          <span className="text-[#FF6321] font-black text-xl tracking-tighter">${pkg.price.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-1.5 text-[#666]">
            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            <span className="text-xs font-bold">{pkg.rating} ({pkg.totalReviews})</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#999]">{pkg.destination}</p>
        </div>
      </div>
    </motion.div>
  );
}

function BookingForm({ pricePerPerson, onBook, isLoggedIn, onLogin }: { 
  pricePerPerson: number; 
  onBook: (d: { startDate: string; endDate: string; guests: number; hasInsurance: boolean; insuranceCost: number }) => void;
  isLoggedIn: boolean;
  onLogin: () => void;
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [guests, setGuests] = useState(2);
  const [hasInsurance, setHasInsurance] = useState(false);

  const insurancePrice = 49;
  const insuranceTotal = hasInsurance ? insurancePrice : 0;
  const total = (pricePerPerson * guests) + insuranceTotal;

  return (
    <div className="bg-[#FDF7F0] p-8 rounded-[32px] shadow-2xl shadow-orange-100/50 border border-orange-50 h-fit sticky top-4">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-[10px] uppercase font-black text-[#FF6321] block mb-2">Arrival</label>
          <input 
            type="date" 
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full bg-white border border-orange-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-[#FF6321] transition-all shadow-sm"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase font-black text-[#FF6321] block mb-2">Departure</label>
          <input 
            type="date" 
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full bg-white border border-orange-100 rounded-2xl px-5 py-3.5 text-sm font-bold focus:outline-none focus:border-[#FF6321] transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="text-[10px] uppercase font-black text-[#FF6321] block mb-2">Travelers</label>
        <div className="flex items-center gap-6 bg-white border border-orange-100 rounded-2xl px-6 py-3 shadow-sm">
          <button 
            onClick={() => setGuests(Math.max(1, guests - 1))}
            className="w-10 h-10 rounded-xl hover:bg-[#FF6321] hover:text-white transition-all flex items-center justify-center font-bold text-lg"
          >
            -
          </button>
          <span className="flex-1 text-center font-black text-xl">{guests}</span>
          <button 
            onClick={() => setGuests(guests + 1)}
            className="w-10 h-10 rounded-xl hover:bg-[#FF6321] hover:text-white transition-all flex items-center justify-center font-bold text-lg"
          >
            +
          </button>
        </div>
      </div>

      {/* Insurance Toggle */}
      <div 
        onClick={() => setHasInsurance(!hasInsurance)}
        className={cn(
          "p-5 rounded-2xl border transition-all cursor-pointer mb-10",
          hasInsurance 
            ? "bg-[#FF6321]/5 border-[#FF6321] shadow-lg shadow-orange-100" 
            : "bg-white border-orange-100 opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
        )}
      >
        <div className="flex items-start gap-4">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
            hasInsurance ? "bg-[#FF6321] text-white" : "bg-gray-100 text-gray-400"
          )}>
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-black uppercase text-[#1A1A1A]">Travel Insurance</h4>
              <span className="text-xs font-black text-[#FF6321]">+$49</span>
            </div>
            <p className="text-[10px] text-[#666] font-medium leading-relaxed">
              Full medical coverage, trip cancellation protection, and 24/7 emergency assistance.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1 mb-10 pb-10 border-b border-orange-100">
        <span className="text-[11px] uppercase font-black text-[#666] tracking-[0.2em] mb-1">Total Voyage Price</span>
        <div className="flex items-baseline gap-2">
           <span className="text-5xl font-black text-[#1A1A1A] tracking-tighter">${total.toLocaleString()}</span>
           <span className="text-sm font-bold text-[#FF6321]">USD</span>
        </div>
      </div>

      {isLoggedIn ? (
        <button 
          onClick={() => onBook({ startDate, endDate, guests, hasInsurance, insuranceCost: insurancePrice })}
          disabled={!startDate || !endDate}
          className="w-full py-5 bg-[#FF6321] text-white text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-300 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reserve Your Spot
        </button>
      ) : (
        <button 
          onClick={onLogin}
          className="w-full py-5 bg-[#1A1A1A] text-white text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-gray-200 hover:scale-[1.02] transition-all"
        >
          Sign In to Reserve
        </button>
      )}

      <div className="flex items-center justify-center gap-2 mt-6 text-[#999]">
         <CheckCircle2 className="w-4 h-4 text-green-500" />
         <p className="text-[10px] uppercase font-bold tracking-widest">
           Secure Check-in Guaranteed
         </p>
      </div>
    </div>
  );
}

function ReviewForm({ onSubmit }: { onSubmit: (data: { rating: number; comment: string }) => void }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSubmitting(true);
    await onSubmit({ rating, comment });
    setComment('');
    setRating(5);
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-white/10 pt-8 mt-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-4">Leave an Impression</p>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            className="transition-transform active:scale-90"
          >
            <Star className={cn("w-5 h-5", star <= rating ? "fill-yellow-400 text-yellow-400" : "text-white/20")} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="How was your journey?"
        className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs font-medium text-white placeholder:text-white/20 focus:outline-none focus:border-orange-400 transition-all resize-none mb-4"
        rows={3}
      />
      <button
        type="submit"
        disabled={submitting || !comment.trim()}
        className="w-full py-3 bg-[#FF6321] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-orange-950/20 hover:scale-[1.02] transition-all disabled:opacity-50"
      >
        {submitting ? 'Sharing...' : 'Submit Reflection'}
      </button>
    </form>
  );
}
