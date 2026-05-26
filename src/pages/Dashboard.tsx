import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Activity,
  BarChart3,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Zap,
  RefreshCw,
  BookOpen,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StoryEval {
  id: string;
  story_id: string;
  used_fallback: boolean;
  generation_time_ms: number;
  openai_retries: number;
  fal_failures: number;
  reading_level_score: number;
  personalization_score: number;
  theme_contamination: boolean;
  refrain_count: number;
  uniqueness_score: number;
  page_count_valid: boolean;
  created_at: string;
}

interface StoryRow {
  id: string;
  title: string;
  theme: string;
  status: string;
  created_at: string;
  page_count: number;
}

interface DashboardStats {
  totalStories: number;
  completedStories: number;
  failedStories: number;
  stuckStories: number;
  avgGenerationTime: number;
  p95GenerationTime: number;
  fallbackRate: number;
  retryRate: number;
  falFailureRate: number;
  readingLevelAvg: number;
  personalizationAvg: number;
  themeContaminationRate: number;
  refrainPresenceRate: number;
  uniquenessAvg: number;
  structureValidRate: number;
  storiesByTheme: Record<string, number>;
  storiesLast24h: number;
  storiesLast7d: number;
  storiesLast30d: number;
}

function computeStats(stories: StoryRow[], evals: StoryEval[]): DashboardStats {
  const totalStories = stories.length;
  const completedStories = stories.filter(s => s.status === 'complete').length;
  const failedStories = stories.filter(s => s.status === 'failed').length;
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const stuckStories = stories.filter(
    s => s.status === 'generating' && new Date(s.created_at).getTime() < fiveMinAgo
  ).length;

  const now = Date.now();
  const storiesLast24h = stories.filter(s => now - new Date(s.created_at).getTime() < 86400000).length;
  const storiesLast7d = stories.filter(s => now - new Date(s.created_at).getTime() < 604800000).length;
  const storiesLast30d = stories.filter(s => now - new Date(s.created_at).getTime() < 2592000000).length;

  const storiesByTheme: Record<string, number> = {};
  stories.forEach(s => {
    storiesByTheme[s.theme] = (storiesByTheme[s.theme] || 0) + 1;
  });

  if (evals.length === 0) {
    return {
      totalStories,
      completedStories,
      failedStories,
      stuckStories,
      avgGenerationTime: 0,
      p95GenerationTime: 0,
      fallbackRate: 0,
      retryRate: 0,
      falFailureRate: 0,
      readingLevelAvg: 0,
      personalizationAvg: 0,
      themeContaminationRate: 0,
      refrainPresenceRate: 0,
      uniquenessAvg: 0,
      structureValidRate: 0,
      storiesByTheme,
      storiesLast24h,
      storiesLast7d,
      storiesLast30d,
    };
  }

  const times = evals.map(e => e.generation_time_ms).filter(t => t > 0).sort((a, b) => a - b);
  const avgGenerationTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  const p95GenerationTime = times.length > 0 ? times[Math.floor(times.length * 0.95)] || times[times.length - 1] : 0;

  const fallbackRate = (evals.filter(e => e.used_fallback).length / evals.length) * 100;
  const retryRate = (evals.filter(e => e.openai_retries > 0).length / evals.length) * 100;
  const falFailureRate = (evals.filter(e => e.fal_failures > 0).length / evals.length) * 100;

  const readingLevelAvg = evals.reduce((sum, e) => sum + Number(e.reading_level_score), 0) / evals.length;
  const personalizationAvg = evals.reduce((sum, e) => sum + Number(e.personalization_score), 0) / evals.length;
  const themeContaminationRate = (evals.filter(e => e.theme_contamination).length / evals.length) * 100;
  const refrainPresenceRate = (evals.filter(e => e.refrain_count >= 3).length / evals.length) * 100;
  const uniquenessAvg = evals.reduce((sum, e) => sum + Number(e.uniqueness_score), 0) / evals.length;
  const structureValidRate = (evals.filter(e => e.page_count_valid).length / evals.length) * 100;

  return {
    totalStories,
    completedStories,
    failedStories,
    stuckStories,
    avgGenerationTime,
    p95GenerationTime,
    fallbackRate,
    retryRate,
    falFailureRate,
    readingLevelAvg,
    personalizationAvg,
    themeContaminationRate,
    refrainPresenceRate,
    uniquenessAvg,
    structureValidRate,
    storiesByTheme,
    storiesLast24h,
    storiesLast7d,
    storiesLast30d,
  };
}

function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  color = 'ocean',
  trend,
}: {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: React.ElementType;
  color?: 'ocean' | 'forest' | 'brand' | 'red' | 'sand';
  trend?: 'up' | 'down' | 'neutral';
}) {
  const colorMap = {
    ocean: 'bg-ocean-50 text-ocean-700 border-ocean-200',
    forest: 'bg-forest-50 text-forest-700 border-forest-200',
    brand: 'bg-brand-50 text-brand-700 border-brand-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    sand: 'bg-sand-50 text-sand-700 border-sand-200',
  };
  const iconColorMap = {
    ocean: 'text-ocean-500',
    forest: 'text-forest-500',
    brand: 'text-brand-500',
    red: 'text-red-500',
    sand: 'text-sand-500',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color]} transition-all duration-200 hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {sublabel && <p className="mt-0.5 text-xs opacity-60">{sublabel}</p>}
        </div>
        <div className="flex items-center gap-1">
          {trend && (
            <TrendingUp
              className={`w-3.5 h-3.5 ${trend === 'up' ? 'text-forest-500' : trend === 'down' ? 'text-red-500 rotate-180' : 'text-gray-400'}`}
            />
          )}
          <Icon className={`w-5 h-5 ${iconColorMap[color]}`} />
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, max = 100, color = 'ocean' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const barColor = {
    ocean: 'bg-ocean-500',
    forest: 'bg-forest-500',
    brand: 'bg-brand-500',
    red: 'bg-red-500',
  }[color] || 'bg-ocean-500';

  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ThemeDistribution({ storiesByTheme }: { storiesByTheme: Record<string, number> }) {
  const total = Object.values(storiesByTheme).reduce((a, b) => a + b, 0);
  if (total === 0) return <p className="text-sm text-gray-500">No stories yet</p>;

  const themeColors: Record<string, string> = {
    superhero: 'bg-brand-400',
    'fairy-tale': 'bg-ocean-400',
  };

  const themeLabels: Record<string, string> = {
    superhero: 'Superhero Quest',
    'fairy-tale': 'Fairy Tale Kingdom',
  };

  return (
    <div className="space-y-3">
      {Object.entries(storiesByTheme)
        .sort(([, a], [, b]) => b - a)
        .map(([theme, count]) => (
          <div key={theme} className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-28 truncate">
              {themeLabels[theme] || theme}
            </span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${themeColors[theme] || 'bg-gray-400'}`}
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-500 w-8 text-right">{count}</span>
          </div>
        ))}
    </div>
  );
}

export function Dashboard() {
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [evals, setEvals] = useState<StoryEval[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  async function fetchData() {
    setLoading(true);
    const [storiesRes, evalsRes] = await Promise.all([
      supabase.from('stories').select('id, title, theme, status, created_at, page_count').order('created_at', { ascending: false }),
      supabase.from('story_evals').select('*').order('created_at', { ascending: false }),
    ]);
    if (storiesRes.data) setStories(storiesRes.data);
    if (evalsRes.data) setEvals(evalsRes.data);
    setLoading(false);
    setLastRefresh(new Date());
  }

  useEffect(() => {
    fetchData();
  }, []);

  const stats = computeStats(stories, evals);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm">Back</span>
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-ocean-600" />
                <h1 className="text-lg font-semibold text-gray-900">System Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
              <button
                onClick={fetchData}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ocean-700 bg-ocean-50 border border-ocean-200 rounded-lg hover:bg-ocean-100 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Section 1: System Reliability */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-ocean-600" />
            <h2 className="text-base font-semibold text-gray-900">System Reliability</h2>
            <span className="text-xs text-gray-400 ml-2">Real-time health metrics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Success Rate"
              value={stats.totalStories > 0 ? `${((stats.completedStories / stats.totalStories) * 100).toFixed(1)}%` : '--'}
              sublabel={`${stats.completedStories} of ${stats.totalStories} stories`}
              icon={CheckCircle2}
              color="forest"
            />
            <StatCard
              label="Fallback Rate"
              value={evals.length > 0 ? `${stats.fallbackRate.toFixed(1)}%` : '--'}
              sublabel="Stories using hardcoded text"
              icon={AlertTriangle}
              color={stats.fallbackRate > 20 ? 'red' : 'brand'}
            />
            <StatCard
              label="Avg Generation Time"
              value={stats.avgGenerationTime > 0 ? `${(stats.avgGenerationTime / 1000).toFixed(1)}s` : '--'}
              sublabel={stats.p95GenerationTime > 0 ? `p95: ${(stats.p95GenerationTime / 1000).toFixed(1)}s` : undefined}
              icon={Clock}
              color="ocean"
            />
            <StatCard
              label="Stuck Stories"
              value={stats.stuckStories}
              sublabel="Generating > 5 minutes"
              icon={XCircle}
              color={stats.stuckStories > 0 ? 'red' : 'forest'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <StatCard
              label="OpenAI 429 Retry Rate"
              value={evals.length > 0 ? `${stats.retryRate.toFixed(1)}%` : '--'}
              sublabel="Stories hitting rate limits"
              icon={RefreshCw}
              color={stats.retryRate > 50 ? 'red' : 'sand'}
            />
            <StatCard
              label="fal.ai Failure Rate"
              value={evals.length > 0 ? `${stats.falFailureRate.toFixed(1)}%` : '--'}
              sublabel="Stories with image fallbacks"
              icon={XCircle}
              color={stats.falFailureRate > 30 ? 'red' : 'sand'}
            />
            <StatCard
              label="Failed Stories"
              value={stats.failedStories}
              sublabel="Unrecoverable errors"
              icon={XCircle}
              color={stats.failedStories > 0 ? 'red' : 'forest'}
            />
          </div>

          {/* Volume row */}
          <div className="mt-4 p-5 bg-white rounded-xl border border-gray-200">
            <p className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Generation Volume</p>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.storiesLast24h}</p>
                <p className="text-xs text-gray-500">Last 24 hours</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.storiesLast7d}</p>
                <p className="text-xs text-gray-500">Last 7 days</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.storiesLast30d}</p>
                <p className="text-xs text-gray-500">Last 30 days</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Story Quality */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Zap className="w-5 h-5 text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">Story Quality</h2>
            <span className="text-xs text-gray-400 ml-2">Aggregated eval scores</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <h3 className="text-sm font-medium text-gray-700">Quality Scores</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Reading Level Compliance</span>
                    <span className="text-xs font-mono font-medium text-gray-900">
                      {evals.length > 0 ? `${stats.readingLevelAvg.toFixed(0)}%` : '--'}
                    </span>
                  </div>
                  <ProgressBar value={stats.readingLevelAvg} color={stats.readingLevelAvg >= 80 ? 'forest' : 'red'} />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Personalization Density</span>
                    <span className="text-xs font-mono font-medium text-gray-900">
                      {evals.length > 0 ? `${stats.personalizationAvg.toFixed(0)}%` : '--'}
                    </span>
                  </div>
                  <ProgressBar value={stats.personalizationAvg} color={stats.personalizationAvg >= 70 ? 'forest' : 'brand'} />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Story Uniqueness</span>
                    <span className="text-xs font-mono font-medium text-gray-900">
                      {evals.length > 0 ? `${stats.uniquenessAvg.toFixed(0)}%` : '--'}
                    </span>
                  </div>
                  <ProgressBar value={stats.uniquenessAvg} color={stats.uniquenessAvg >= 70 ? 'ocean' : 'red'} />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">Structural Validity (8 pages)</span>
                    <span className="text-xs font-mono font-medium text-gray-900">
                      {evals.length > 0 ? `${stats.structureValidRate.toFixed(0)}%` : '--'}
                    </span>
                  </div>
                  <ProgressBar value={stats.structureValidRate} color={stats.structureValidRate >= 95 ? 'forest' : 'brand'} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
              <h3 className="text-sm font-medium text-gray-700">Quality Flags</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">Theme Contamination</span>
                  <span className={`text-sm font-medium ${stats.themeContaminationRate > 10 ? 'text-red-600' : 'text-forest-600'}`}>
                    {evals.length > 0 ? `${stats.themeContaminationRate.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">Refrain Present (3+ times)</span>
                  <span className={`text-sm font-medium ${stats.refrainPresenceRate >= 80 ? 'text-forest-600' : 'text-brand-600'}`}>
                    {evals.length > 0 ? `${stats.refrainPresenceRate.toFixed(1)}%` : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">AI Text (non-fallback)</span>
                  <span className={`text-sm font-medium ${stats.fallbackRate < 20 ? 'text-forest-600' : 'text-red-600'}`}>
                    {evals.length > 0 ? `${(100 - stats.fallbackRate).toFixed(1)}%` : '--'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Theme Distribution</h4>
                <ThemeDistribution storiesByTheme={stats.storiesByTheme} />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: User Engagement */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Users className="w-5 h-5 text-forest-600" />
            <h2 className="text-base font-semibold text-gray-900">User Engagement</h2>
            <span className="text-xs text-gray-400 ml-2">Usage patterns and feedback</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-4 h-4 text-forest-500" />
                <h3 className="text-sm font-medium text-gray-700">Stories Created</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalStories}</p>
              <p className="text-xs text-gray-500 mt-1">Total lifetime stories</p>
              <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{stats.storiesLast7d}</p>
                  <p className="text-xs text-gray-500">This week</p>
                </div>
                <div>
                  <p className="text-lg font-semibold text-gray-900">
                    {stats.storiesLast7d > 0 ? (stats.storiesLast7d / 7).toFixed(1) : '0'}
                  </p>
                  <p className="text-xs text-gray-500">Daily avg</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-ocean-500" />
                <h3 className="text-sm font-medium text-gray-700">Most Popular Themes</h3>
              </div>
              {Object.keys(stats.storiesByTheme).length > 0 ? (
                <div className="space-y-2">
                  {Object.entries(stats.storiesByTheme)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 3)
                    .map(([theme, count], i) => (
                      <div key={theme} className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-400 w-4">{i + 1}.</span>
                        <span className="text-sm text-gray-700 capitalize">{theme.replace('-', ' ')}</span>
                        <span className="ml-auto text-xs font-mono text-gray-500">{count}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No data yet</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-medium text-gray-700">Feedback</h3>
              </div>
              <div className="flex flex-col items-center justify-center h-28 text-center">
                <p className="text-sm text-gray-400">Parent feedback not yet implemented</p>
                <p className="text-xs text-gray-300 mt-1">Add thumbs up/down in StoryReader</p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Stories Table */}
        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Stories</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Theme</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stories.slice(0, 10).map(story => (
                    <tr key={story.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900 font-medium truncate max-w-[200px]">
                        {story.title || '(Untitled)'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{story.theme.replace('-', ' ')}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={story.status} />
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(story.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {stories.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                        No stories generated yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; dot: string }> = {
    complete: { bg: 'bg-forest-50', text: 'text-forest-700', dot: 'bg-forest-500' },
    generating: { bg: 'bg-ocean-50', text: 'text-ocean-700', dot: 'bg-ocean-500' },
    pending: { bg: 'bg-gray-50', text: 'text-gray-600', dot: 'bg-gray-400' },
    failed: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {status}
    </span>
  );
}
