"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { History, ExternalLink } from "lucide-react";

interface Submission {
  id: string;
  titleSlug: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  language: string;
  pointsEarned: number;
  timestamp: any;
}

export default function SubmissionHistory() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, "submissions"), 
          where("userId", "==", user.uid),
          orderBy("timestamp", "desc"),
          limit(50)
        );
        const snapshot = await getDocs(q);
        
        const fetchedSubmissions: Submission[] = [];
        snapshot.forEach((doc) => {
          fetchedSubmissions.push({ id: doc.id, ...doc.data() } as Submission);
        });
        
        setSubmissions(fetchedSubmissions);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(date);
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case "Easy": return "text-emerald-400";
      case "Medium": return "text-orange-400";
      case "Hard": return "text-red-400";
      default: return "text-white/50";
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 max-w-4xl mx-auto w-full">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
        <History className="text-emerald-400" size={22} />
        Submission History
      </h2>

      {loading ? (
        <div className="text-center py-8 text-white/50 animate-pulse">Loading history...</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 text-white/50">You haven&apos;t submitted any problems yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider">Problem</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider">Difficulty</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider">Language</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider text-right">Points</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((sub) => (
                <tr key={sub.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-medium text-white">
                    <a 
                      href={`https://leetcode.com/problems/${sub.titleSlug}/`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="hover:text-emerald-400 transition flex items-center gap-1.5"
                    >
                      {sub.problemTitle}
                      <ExternalLink size={13} className="text-white/30" />
                    </a>
                  </td>
                  <td className={`py-3 px-4 font-semibold text-sm ${getDifficultyColor(sub.difficulty)}`}>
                    {sub.difficulty}
                  </td>
                  <td className="py-3 px-4">
                    <span className="bg-white/10 text-white/70 px-2.5 py-1 rounded-lg text-xs font-medium">
                      {sub.language}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">
                    +{sub.pointsEarned}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-white/40">
                    {formatDate(sub.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
