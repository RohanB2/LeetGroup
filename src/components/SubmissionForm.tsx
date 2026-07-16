"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { Send, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

const LANGUAGES = [
  "Python", "JavaScript", "TypeScript", "Java", "C++", "C", "C#", "Go", "Rust", "Swift", "Kotlin", "Ruby", "PHP", "Other"
];

const DIFFICULTY_POINTS: Record<string, number> = {
  "Easy": 1,
  "Medium": 3,
  "Hard": 5,
};

export default function SubmissionForm() {
  const { user, userData } = useAuth();
  const [url, setUrl] = useState("");
  const [language, setLanguage] = useState("Python");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !user || !userData) return;

    setLoading(true);
    setMessage(null);

    try {
      // 1. Fetch from LeetCode API
      const res = await fetch("/api/leetcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urlOrSlug: url }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch problem");
      }

      const { titleSlug, title, difficulty } = data;

      // 2. Check for duplicates
      const submissionsRef = collection(db, "submissions");
      const q = query(
        submissionsRef, 
        where("userId", "==", user.uid), 
        where("titleSlug", "==", titleSlug)
      );
      
      const existingDocs = await getDocs(q);
      const existingLangs = existingDocs.docs.map(d => d.data().language);
      
      if (existingLangs.includes(language)) {
        setMessage({ text: `You already submitted ${title} in ${language}!`, type: "error" });
        setLoading(false);
        return;
      }

      // 3. Calculate points to increment cached user score
      const isFirstTimeSolving = existingDocs.empty;
      const pointsEarned = isFirstTimeSolving ? (DIFFICULTY_POINTS[difficulty] || 0) : 0;

      // 4. Save submission
      await addDoc(submissionsRef, {
        userId: user.uid,
        userName: userData.displayName,
        titleSlug,
        problemTitle: title,
        difficulty,
        language,
        timestamp: serverTimestamp(),
      });

      // 5. Update user stats
      const today = new Date().toISOString().split("T")[0];
      const isNewDay = userData.lastSubmissionDate !== today;
      
      const userRef = doc(db, "users", user.uid);
      
      // Calculate new streak
      let newStreak = userData.currentStreak;
      if (isNewDay) {
        if (userData.lastSubmissionDate) {
          const lastDate = new Date(userData.lastSubmissionDate);
          const current = new Date(today);
          const diffDays = Math.floor((current.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));
          
          if (diffDays === 1) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
        } else {
          newStreak = 1;
        }
      }

      await updateDoc(userRef, {
        weeklyPoints: increment(pointsEarned),
        allTimePoints: increment(pointsEarned),
        currentStreak: newStreak,
        lastSubmissionDate: today,
      });

      if (isFirstTimeSolving) {
        setMessage({ text: `Success! +${pointsEarned} points for ${title} (${difficulty})`, type: "success" });
      } else {
        setMessage({ text: `Logged ${title} in ${language}. (0 points - already solved previously)`, type: "info" });
      }
      
      setUrl("");
    } catch (err: any) {
      console.error(err);
      setMessage({ text: err.message || "An error occurred", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* URL Input */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-white/70">
          LeetCode URL or Problem Name (Slug)
        </label>
        <input
          type="text"
          placeholder="e.g. https://leetcode.com/problems/two-sum/"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all text-sm"
        />
      </div>
      
      {/* Language Select */}
      <div>
        <Select value={language} onValueChange={(val) => val && setLanguage(val)}>
          <SelectTrigger className="w-full h-11 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/8 transition-colors">
            <SelectValue placeholder="Language Used" />
          </SelectTrigger>
          <SelectContent className="bg-neutral-900 border-white/10 backdrop-blur-2xl rounded-xl shadow-2xl">
            <SelectGroup>
              <SelectLabel className="text-white/40 text-xs uppercase tracking-wider px-2 py-1.5">Language Used</SelectLabel>
              {LANGUAGES.map(lang => (
                <SelectItem
                  key={lang}
                  value={lang}
                  className="text-white/80 focus:bg-emerald-600/20 focus:text-emerald-300 rounded-lg cursor-pointer"
                >
                  {lang}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="w-full h-11 mt-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg hover:shadow-emerald-500/20"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={16} />}
        {loading ? "Submitting..." : "Submit Problem Completion"}
      </button>

      {/* Feedback Message */}
      {message && (
        <div className={`p-4 rounded-xl text-sm font-medium border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
          message.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
          'bg-blue-500/10 text-blue-400 border-blue-500/20'
        }`}>
          {message.text}
        </div>
      )}
    </form>
  );
}
