"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp } from "firebase/firestore";
import { startOfWeek, endOfWeek } from "date-fns";
import SubmissionForm from "./SubmissionForm";
import Leaderboard from "./Leaderboard";
import SubmissionHistory from "./SubmissionHistory";
import ActivityHeatmap from "./ActivityHeatmap";
import GroupsPanel from "./GroupsPanel";
import WeeklyResults from "./WeeklyResults";
import { LogOut, LayoutDashboard, Trophy, History, Users } from "lucide-react";

export default function Dashboard() {
  const { user, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<"dashboard" | "leaderboard" | "history" | "groups">("dashboard");
  const [computedWeeklyPoints, setComputedWeeklyPoints] = useState<number | null>(null);
  const [computedAllTimePoints, setComputedAllTimePoints] = useState<number | null>(null);

  // Compute points from actual submissions
  useEffect(() => {
    const computePoints = async () => {
      if (!user) return;

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 0 });

      const submissionsRef = collection(db, "submissions");
      
      // We can query all submissions for the user to compute all-time points
      const qAllTime = query(submissionsRef, where("userId", "==", user.uid));
      const snapshotAllTime = await getDocs(qAllTime);
      
      const DIFFICULTY_POINTS: Record<string, number> = { Easy: 1, Medium: 3, Hard: 5 };
      const problemFirstSub = new Map<string, { timestamp: Date, points: number }>();

      snapshotAllTime.forEach((doc) => {
        const data = doc.data();
        const titleSlug = data.titleSlug as string;
        const difficulty = data.difficulty as string;
        const subDate = (data.timestamp as Timestamp)?.toDate();
        
        if (!subDate || !titleSlug) return;
        
        const points = DIFFICULTY_POINTS[difficulty] || 0;

        if (!problemFirstSub.has(titleSlug)) {
           problemFirstSub.set(titleSlug, { timestamp: subDate, points });
        } else {
           const existing = problemFirstSub.get(titleSlug)!;
           if (subDate < existing.timestamp) {
              problemFirstSub.set(titleSlug, { timestamp: subDate, points });
           }
        }
      });
      
      let allTimeTotal = 0;
      let weeklyTotal = 0;
      
      for (const { timestamp, points } of problemFirstSub.values()) {
        allTimeTotal += points;
        if (timestamp >= weekStart && timestamp <= weekEnd) {
           weeklyTotal += points;
        }
      }

      setComputedAllTimePoints(allTimeTotal);
      setComputedWeeklyPoints(weeklyTotal);
    };

    computePoints();
  }, [user, activeTab]);

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const tabClass = (tab: string) =>
    `px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
      activeTab === tab
        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20"
        : "text-white/60 hover:text-white hover:bg-white/5"
    }`;

  return (
    <div className="w-[95vw] max-w-[1600px] mx-auto min-h-screen flex flex-col p-4 sm:p-6">
      {/* Navigation */}
      <nav className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl mb-8 flex flex-col sm:flex-row justify-between items-center py-3 px-5 gap-4">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
          <Trophy className="text-emerald-400" size={22} />
          LeetGroup
        </div>
        
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex flex-wrap justify-center gap-1 bg-white/5 rounded-xl p-1">
            <button className={tabClass("dashboard")} onClick={() => setActiveTab("dashboard")}>
              <span className="flex items-center gap-2">
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </span>
            </button>
            <button className={tabClass("groups")} onClick={() => setActiveTab("groups")}>
              <span className="flex items-center gap-2">
                <Users size={16} />
                <span className="hidden sm:inline">Groups</span>
              </span>
            </button>
            <button className={tabClass("leaderboard")} onClick={() => setActiveTab("leaderboard")}>
              <span className="flex items-center gap-2">
                <Trophy size={16} />
                <span className="hidden sm:inline">Leaderboard</span>
              </span>
            </button>
            <button className={tabClass("history")} onClick={() => setActiveTab("history")}>
              <span className="flex items-center gap-2">
                <History size={16} />
                <span className="hidden sm:inline">History</span>
              </span>
            </button>
          </div>
          
          <div className="hidden sm:block h-8 w-px bg-white/10 mx-1"></div>
          
          <div className="flex items-center gap-3">
            <img
              src={user?.photoURL || ""}
              alt="Profile"
              className="w-8 h-8 rounded-full ring-2 ring-white/10"
            />
            <span className="font-medium hidden md:inline text-white/80 text-sm">{user?.displayName}</span>
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 flex flex-col gap-8">
        {activeTab === "dashboard" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Submit Solution Card & Weekly Results */}
            <div className="md:col-span-2 flex flex-col gap-6">
              <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
                  <LayoutDashboard size={20} className="text-emerald-400" />
                  Submit Problem Completion
                </h2>
                <SubmissionForm />
              </div>
              
              <WeeklyResults />
            </div>

            {/* Right Column: Stats & Heatmap */}
            <div className="flex flex-col gap-6">
              {/* Stats Card */}
              <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 text-center">
                <h2 className="text-xl font-bold text-white mb-5">Your Stats</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-3xl font-bold text-emerald-400">{computedWeeklyPoints ?? userData?.weeklyPoints ?? 0}</div>
                    <div className="text-xs text-white/50 mt-1 uppercase tracking-wider">Weekly Points</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-3xl font-bold text-orange-400">{userData?.currentStreak || 0}</div>
                    <div className="text-xs text-white/50 mt-1 uppercase tracking-wider">Day Streak</div>
                  </div>
                  <div className="col-span-2 bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-3xl font-bold text-white">{computedAllTimePoints ?? userData?.allTimePoints ?? 0}</div>
                    <div className="text-xs text-white/50 mt-1 uppercase tracking-wider">All-Time Points</div>
                  </div>
                </div>
              </div>

              {/* Activity Heatmap */}
              <ActivityHeatmap />
            </div>
          </div>
        )}
        
        {activeTab === "groups" && <GroupsPanel />}
        {activeTab === "leaderboard" && <Leaderboard />}
        {activeTab === "history" && <SubmissionHistory />}
      </main>
    </div>
  );
}
