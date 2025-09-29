import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BarChart3, FileCheck, ShieldCheck, ChevronRight } from 'lucide-react';
import { apiService, DashboardStats } from '@/services/apiService';

// Counter animation hook
const useCounter = (end: number, duration: number = 2000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return count;
};

// Hook to fetch dashboard stats
const useDashboardStats = () => {
  const [stats, setStats] = useState<DashboardStats>({
    total_evaluations: 0,
    pending_evaluations: 0,
    completed_evaluations: 0,
    failed_evaluations: 0,
    total_students_processed: 0,
    average_score: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const dashboardStats = await apiService.getDashboardStats();
        setStats(dashboardStats);
        setHasRealData(true);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setError('Failed to load stats');
        setHasRealData(false);
        // Keep stats at 0 if API fails - don't show fake data
        setStats({
          total_evaluations: 0,
          pending_evaluations: 0,
          completed_evaluations: 0,
          failed_evaluations: 0,
          total_students_processed: 0,
          average_score: 0
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return { stats, loading, error, hasRealData };
};

const Home: React.FC = () => {
  const { stats, loading, error, hasRealData } = useDashboardStats();

  const sheetsProcessed = useCounter(hasRealData ? stats.total_students_processed : 0, 2500);
  const avgScore = useCounter(hasRealData ? Math.round(stats.average_score * 10) : 0, 2000);
  const totalEvaluations = useCounter(hasRealData ? stats.total_evaluations : 0, 1800);

  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900">
      <section className="relative flex flex-col justify-center overflow-hidden min-h-[600px] md:min-h-[700px] bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 via-transparent to-slate-900/50" />
          <div className="absolute inset-0 opacity-5 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.3)_1px,transparent_1px)] bg-[length:40px_40px]" />
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-b from-transparent via-gray-50/20 to-gray-50" />
        </div>

        <div className="relative py-32 md:py-40 z-10">
          <div className="max-w-6xl mx-auto px-6 flex flex-col items-center text-center">
            <div className="mb-8 relative group">
              <div className="absolute -inset-3 bg-gradient-to-r from-blue-400 to-purple-400 rounded-3xl blur-lg opacity-75 group-hover:opacity-100 transition duration-300"></div>
              <div className="absolute -inset-1 bg-white rounded-3xl shadow-xl"></div>
              <img
                src="/hero_image.jpg"
                alt="AutoEval Logo"
                className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl shadow-2xl object-cover"
              />
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border-2 border-white/40 bg-white/25 backdrop-blur-md px-6 py-2 text-sm font-bold text-white mb-8 shadow-xl">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-sm" />
              <span className="tracking-wide">AI-Powered Grading</span>
            </div>

            <h1 className="font-black tracking-tight text-white text-6xl md:text-7xl leading-[0.95] mb-8 drop-shadow-2xl">
              AutoEval
            </h1>

            <p className="max-w-3xl text-xl md:text-2xl text-white font-medium leading-relaxed mb-12 drop-shadow-lg">
              Automatic Evaluation of Handwritten True/False Answer Sheets
            </p>

            <div className="flex flex-col sm:flex-row gap-6">
              <Link to="/upload" className="group">
                <Button className="px-10 py-7 text-lg font-bold bg-white text-indigo-700 hover:bg-gray-50 shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105 border-2 border-transparent hover:border-white/20">
                  <span className="flex items-center">
                    Start Grading Now
                    <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
              </Link>
              <Link to="#features">
                <Button variant="outline" className="px-10 py-7 text-lg font-bold border-2 border-white bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-indigo-700 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:scale-105">
                  Learn More
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap justify-center gap-12 mt-16">
              <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-xl hover:bg-white/15 transition-all duration-300">
                <div className="text-3xl font-black text-white drop-shadow-lg">
                  {loading ? (
                    <div className="animate-pulse bg-white/20 rounded h-8 w-16 mx-auto"></div>
                  ) : hasRealData && stats.average_score > 0 ? (
                    `${(avgScore / 10).toFixed(1)}%`
                  ) : (
                    '--'
                  )}
                </div>
                <div className="text-sm font-semibold text-white/90 tracking-wide">Avg. Score</div>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-xl hover:bg-white/15 transition-all duration-300">
                <div className="text-3xl font-black text-white drop-shadow-lg">
                  {loading ? (
                    <div className="animate-pulse bg-white/20 rounded h-8 w-12 mx-auto"></div>
                  ) : (
                    totalEvaluations > 0 ? `${totalEvaluations}` : '0'
                  )}
                </div>
                <div className="text-sm font-semibold text-white/90 tracking-wide">Evaluations</div>
              </div>
              <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl px-6 py-4 border border-white/20 shadow-xl hover:bg-white/15 transition-all duration-300">
                <div className="text-3xl font-black text-white drop-shadow-lg">
                  {loading ? (
                    <div className="animate-pulse bg-white/20 rounded h-8 w-16 mx-auto"></div>
                  ) : sheetsProcessed > 0 ? (
                    sheetsProcessed >= 1000 ? `${(sheetsProcessed / 1000).toFixed(1)}K+` : `${sheetsProcessed}`
                  ) : (
                    '0'
                  )}
                </div>
                <div className="text-sm font-semibold text-white/90 tracking-wide">Sheets Graded</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1440 320" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(79, 70, 229, 0.8)" />
                <stop offset="50%" stopColor="rgba(249, 250, 251, 0.9)" />
                <stop offset="100%" stopColor="#f9fafb" />
              </linearGradient>
            </defs>
            <path
              fill="url(#waveGradient)"
              d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,138.7C960,139,1056,117,1152,122.7C1248,128,1344,160,1392,176L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"
            />
          </svg>
        </div>
      </section>

      <section id="features" className="relative py-24 bg-gray-50 -mt-16">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-50 to-white" />
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_80%,rgba(59,130,246,0.1)_0%,transparent_50%),radial-gradient(circle_at_80%_20%,rgba(147,51,234,0.1)_0%,transparent_50%),radial-gradient(circle_at_40%_40%,rgba(16,185,129,0.1)_0%,transparent_50%)]" />
        </div>
        <div className="max-w-6xl mx-auto px-6 relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 mb-4">How It Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Simple, fast, and accurate grading in three easy steps</p>
            <div className="mx-auto h-1 w-24 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600 rounded-full mt-6" />
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Feature 1 */}
            <div className="group relative bg-white rounded-3xl border border-gray-200/60 shadow-lg hover:shadow-2xl transition-all duration-500 p-10 overflow-hidden transform hover:-translate-y-2">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-br from-blue-50 via-white to-indigo-50" />
              <div className="relative">
                <div className="flex items-center justify-center mb-8">
                  <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-xl">
                    <FileCheck className="h-10 w-10 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">1. Upload</h3>
                <p className="text-gray-600 leading-relaxed text-lg">Upload a model answer sheet and student answer sheets.</p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative bg-white rounded-3xl border border-gray-200/60 shadow-lg hover:shadow-2xl transition-all duration-500 p-10 overflow-hidden transform hover:-translate-y-2">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-br from-purple-50 via-white to-indigo-50" />
              <div className="relative">
                <div className="flex items-center justify-center mb-8">
                  <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-xl">
                    <BarChart3 className="h-10 w-10 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">2. Process</h3>
                <p className="text-gray-600 leading-relaxed text-lg">Our home grown, state of the art model evaluates the answer sheets.</p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative bg-white rounded-3xl border border-gray-200/60 shadow-lg hover:shadow-2xl transition-all duration-500 p-10 overflow-hidden transform hover:-translate-y-2">
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-500 bg-gradient-to-br from-green-50 via-white to-emerald-50" />
              <div className="relative">
                <div className="flex items-center justify-center mb-8">
                  <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-xl">
                    <ShieldCheck className="h-10 w-10 text-white" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-gray-900">3. Review</h3>
                <p className="text-gray-600 leading-relaxed text-lg">View detailed results, and various stats from your dashboard.</p>
              </div>
            </div>
          </div>

          <div className="text-center mt-16">
            <Link to="/upload" className="group inline-block">
              <Button className="px-12 py-6 text-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-800 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 font-semibold">
                <span className="flex items-center justify-center gap-3">
                  Try It Now
                  <ChevronRight className="h-6 w-6 transition-transform group-hover:translate-x-1" />
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Elevated CTA band (no new text, re-uses existing CTA context visually) */}
      <div className="relative -mt-10 mb-20 mx-auto w-full max-w-6xl px-5">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-700 p-[1px] shadow-xl">
          <div className="rounded-2xl bg-white/95 backdrop-blur px-8 py-10 md:py-14 flex flex-col md:flex-row items-center gap-8 justify-between">
            <div className="max-w-2xl text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-700">AutoEval</h3>
              <p className="mt-2 text-gray-600 text-sm md:text-base leading-relaxed">Automatic Evaluation of Handwritten True/False Answer Sheets</p>
            </div>
            <Link to="/upload" className="group">
              <Button className="px-8 py-5 text-base md:text-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-800 shadow-lg shadow-indigo-900/30">
                <span className="flex items-center">Start Grading Now <ChevronRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" /></span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-auto bg-gray-950 text-white/90 pt-16 pb-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.35),transparent_60%)]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-5">
          <div className="grid gap-12 md:gap-8 md:grid-cols-3 mb-12">
            {/* Column 1 */}
            <div>
              <h3 className="text-xl font-bold mb-4 tracking-tight text-white">AutoEval</h3>
              <p className="text-gray-400 max-w-sm leading-relaxed">Automatic Evaluation of Handwritten True/False Answer Sheets.</p>
              <div className="flex mt-5 space-x-4">
                <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Facebook">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"></path></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Twitter">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors" aria-label="Instagram">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd"></path></svg>
                </a>
              </div>
            </div>
            {/* Column 2 */}
            <div>
              <h3 className="text-lg font-semibold mb-4 tracking-tight text-white">Quick Links</h3>
              <ul className="space-y-2">
                <li><Link to="/dashboard" className="text-gray-400 hover:text-white transition-colors">Dashboard</Link></li>
                <li><Link to="/upload" className="text-gray-400 hover:text-white transition-colors">Upload</Link></li>
                <li><Link to="/results" className="text-gray-400 hover:text-white transition-colors">Results</Link></li>
                <li><Link to="/login" className="text-gray-400 hover:text-white transition-colors">Login</Link></li>
              </ul>
            </div>
            {/* Column 3 */}
            <div>
              <h3 className="text-lg font-semibold mb-4 tracking-tight text-white">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Help Center</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 text-center text-gray-500 text-sm tracking-wide">
            <p>&copy; {new Date().getFullYear()} AutoEval. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
