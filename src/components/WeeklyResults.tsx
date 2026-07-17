"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, orderBy, where, Timestamp, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { Crown, Turtle, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

interface WeeklyResultUser {
  uid: string;
  displayName: string;
  photoURL: string;
  points: number;
}

interface WeeklyResult {
  id: string;
  isCurrentWeek: boolean;
  dateLabel: string;
  winner: WeeklyResultUser | null;
  loser: WeeklyResultUser | null;
}

export default function WeeklyResults() {
  const { userData } = useAuth();
  const [results, setResults] = useState<WeeklyResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
        const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 });
        const dateLabel = `${format(currentWeekStart, "MMM do")} — ${format(currentWeekEnd, "MMM do")}`;

        const combinedResults: WeeklyResult[] = [];

        // 1. Calculate Current Week (On-the-fly, but only for current week submissions)
        const currentWeekResult = await calculateCurrentWeek(currentWeekStart, currentWeekEnd, dateLabel);
        combinedResults.push(currentWeekResult);

        // 2. Fetch Past Weeks from weekly_results collection
        const pastResultsRef = collection(db, "weekly_results");
        const pastQuery = query(pastResultsRef, orderBy("weekStart", "desc"), limit(10));
        const pastSnapshot = await getDocs(pastQuery);

        pastSnapshot.forEach((doc) => {
          const data = doc.data();
          const start = (data.weekStart as Timestamp)?.toDate();
          const end = (data.weekEnd as Timestamp)?.toDate();
          
          if (start && end) {
            combinedResults.push({
              id: doc.id,
              isCurrentWeek: false,
              dateLabel: `${format(start, "MMM do")} — ${format(end, "MMM do")}`,
              winner: data.winner as WeeklyResultUser || null,
              loser: data.loser as WeeklyResultUser || null,
            });
          }
        });

        setResults(combinedResults);
      } catch (error) {
        console.error("Error fetching weekly results:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [userData]);

  const calculateCurrentWeek = async (weekStart: Date, weekEnd: Date, dateLabel: string): Promise<WeeklyResult> => {
    // Determine which group to scope to, if any. 
    // For simplicity and scaling, we will compute global current week stats here. 
    // In a robust app, we'd filter by selectedGroup, but we follow Leaderboard logic.
    const submissionsRef = collection(db, "submissions");
    const q = query(submissionsRef, where("timestamp", ">=", Timestamp.fromDate(weekStart)));
    
    const snapshot = await getDocs(q);
    const DIFFICULTY_POINTS: Record<string, number> = { Easy: 1, Medium: 3, Hard: 5 };
    
    const userProblems = new Map<string, Map<string, { timestamp: Date, difficulty: string }>>();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const userId = data.userId as string;
      const titleSlug = data.titleSlug as string;
      const difficulty = data.difficulty as string;
      const subDate = (data.timestamp as Timestamp)?.toDate();
      
      if (!userId || !titleSlug || !subDate || !difficulty || subDate > weekEnd) return;

      if (!userProblems.has(userId)) {
        userProblems.set(userId, new Map());
      }
      
      const userMap = userProblems.get(userId)!;
      if (!userMap.has(titleSlug)) {
         userMap.set(titleSlug, { timestamp: subDate, difficulty });
      } else {
         const existing = userMap.get(titleSlug)!;
         if (subDate < existing.timestamp) {
            userMap.set(titleSlug, { timestamp: subDate, difficulty });
         }
      }
    });

    const userPoints = new Map<string, number>();
    userProblems.forEach((problemMap, userId) => {
      let weekly = 0;
      problemMap.forEach((firstSub) => {
        weekly += DIFFICULTY_POINTS[firstSub.difficulty] || 0;
      });
      userPoints.set(userId, weekly);
    });

    // Fetch all users to include those with 0 points
    const usersRef = collection(db, "users");
    const usersSnapshot = await getDocs(usersRef);
    
    let allUsers: WeeklyResultUser[] = [];
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const uid = data.uid || doc.id;
      allUsers.push({
        uid,
        displayName: data.displayName || "Anonymous",
        photoURL: data.photoURL || "",
        points: userPoints.get(uid) || 0
      });
    });

    allUsers.sort((a, b) => b.points - a.points);
    
    let winner = null;
    let loser = null;
    
    if (allUsers.length > 0) {
      winner = allUsers[0];
      loser = allUsers[allUsers.length - 1];
    }

    return {
      id: "current-week",
      isCurrentWeek: true,
      dateLabel,
      winner,
      loser
    };
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % results.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + results.length) % results.length);
  };

  if (loading) {
    return (
      <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 h-64 flex items-center justify-center">
        <div className="text-white/50 animate-pulse">Loading results...</div>
      </div>
    );
  }

  if (results.length === 0) {
    return null;
  }

  const currentResult = results[currentIndex];

  return (
    <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 relative overflow-hidden group">
      {/* Subtle Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />

      {/* Header & Navigation */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <button 
          onClick={handlePrev}
          disabled={results.length <= 1}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-30"
        >
          <ChevronLeft size={20} />
        </button>
        
        <div className="text-center">
          <h3 className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Weekly Results</h3>
          <div className="text-white font-medium">{currentResult.dateLabel}</div>
        </div>

        <button 
          onClick={handleNext}
          disabled={results.length <= 1}
          className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors disabled:opacity-30"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Carousel Content */}
      <div className="relative z-10 flex flex-col gap-3">
        {currentResult.isCurrentWeek && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 px-3 flex items-center gap-2">
            <AlertCircle className="text-amber-500 shrink-0" size={14} />
            <p className="text-amber-500/90 text-[11px] leading-tight">
              This week is ongoing! The winner and loser are not yet finalized.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Winner Card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-yellow-600" />
            <Crown className="text-yellow-400 mb-2" size={24} />
            <img 
              src={currentResult.winner?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentResult.winner?.displayName || "W")}&background=random`} 
              alt="Winner"
              className="w-10 h-10 rounded-full ring-2 ring-yellow-400/30 mb-2"
            />
            <div className="text-white text-sm font-semibold truncate w-full">{currentResult.winner?.displayName || "TBD"}</div>
            <div className="text-emerald-400 font-bold text-xs mt-0.5">{currentResult.winner?.points || 0} pts</div>
          </div>

          {/* Loser Card */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col items-center text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-neutral-500 to-neutral-700" />
            <Turtle className="text-neutral-400 mb-2" size={24} />
            <img 
              src={currentResult.loser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentResult.loser?.displayName || "L")}&background=random`} 
              alt="Loser"
              className="w-10 h-10 rounded-full ring-2 ring-white/10 mb-2 grayscale opacity-80"
            />
            <div className="text-white/80 text-sm font-semibold truncate w-full">{currentResult.loser?.displayName || "TBD"}</div>
            <div className="text-white/40 font-bold text-xs mt-0.5">{currentResult.loser?.points || 0} pts</div>
          </div>
        </div>
      </div>

      {/* Pagination Dots */}
      {results.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4 relative z-10">
          {results.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? "w-6 bg-emerald-500" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
