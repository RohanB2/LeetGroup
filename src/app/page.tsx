"use client";

import { useAuth } from "@/context/AuthContext";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { LogIn, Trophy, Flame, Code } from "lucide-react";
import Dashboard from "@/components/Dashboard";
import { Button } from "@/components/ui/button";

export default function Home() {
  const { user, loading } = useAuth();

  const handleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl font-semibold text-white/80 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Dashboard />;
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl shadow-2xl max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-emerald-500/20 rounded-full ring-1 ring-emerald-500/30">
            <Trophy size={48} className="text-emerald-400" />
          </div>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-3 text-white">
          LeetCode Tracker
        </h1>
        <p className="mb-8 text-lg text-white/60 leading-relaxed">
          Hold yourself and your friends accountable. Compete, track streaks, and master algorithms together.
        </p>
        
        <div className="flex flex-col gap-4 mb-8 text-left">
          <div className="flex items-center gap-3 text-white/80">
            <div className="p-2 bg-orange-500/15 rounded-lg">
              <Flame className="text-orange-400" size={20} />
            </div>
            <span className="font-medium">Maintain daily streaks</span>
          </div>
          <div className="flex items-center gap-3 text-white/80">
            <div className="p-2 bg-emerald-500/15 rounded-lg">
              <Code className="text-emerald-400" size={20} />
            </div>
            <span className="font-medium">Submit solutions in any language</span>
          </div>
          <div className="flex items-center gap-3 text-white/80">
            <div className="p-2 bg-yellow-500/15 rounded-lg">
              <Trophy className="text-yellow-400" size={20} />
            </div>
            <span className="font-medium">Climb the weekly leaderboard</span>
          </div>
        </div>

        <Button
          onClick={handleSignIn}
          size="lg"
          className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-emerald-500/25"
        >
          <LogIn size={20} className="mr-2" />
          Sign in with Google
        </Button>
      </div>
    </main>
  );
}
