"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, doc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { History, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { isThisWeek } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Submission {
  id: string;
  titleSlug: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  language: string;
  pointsEarned: number;
  timestamp: any;
}

interface SubmissionHistoryProps {
  targetUserId?: string;
  targetUserName?: string;
  isModal?: boolean;
}

export default function SubmissionHistory({ targetUserId, targetUserName, isModal }: SubmissionHistoryProps = {}) {
  const { user: authUser } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uid = targetUserId || authUser?.uid;
  const isOwner = !targetUserId || targetUserId === authUser?.uid;

  const fetchHistory = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "submissions"), 
        where("userId", "==", uid),
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

  useEffect(() => {
    fetchHistory();
  }, [uid]);

  const handleDelete = async (sub: Submission) => {
    if (!authUser || !sub.timestamp || !isOwner) return;
    
    setDeletingId(sub.id);
    try {
      // 1. Delete submission
      await deleteDoc(doc(db, "submissions", sub.id));

      // 2. Subtract points from user
      const userRef = doc(db, "users", authUser.uid);
      const subDate = sub.timestamp.toDate();
      const updates: any = {
        allTimePoints: increment(-sub.pointsEarned)
      };
      
      if (isThisWeek(subDate, { weekStartsOn: 0 })) {
        updates.weeklyPoints = increment(-sub.pointsEarned);
      }
      
      await updateDoc(userRef, updates);

      // Refresh list
      await fetchHistory();
    } catch (error) {
      console.error("Failed to delete submission:", error);
      alert("Failed to delete submission.");
    } finally {
      setDeletingId(null);
    }
  };

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
    <div className={isModal ? "w-full" : "bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 max-w-4xl mx-auto w-full"}>
      {!isModal && (
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
          <History className="text-emerald-400" size={22} />
          {targetUserName ? `${targetUserName}'s History` : 'Submission History'}
        </h2>
      )}

      {loading ? (
        <div className="text-center py-8 text-white/50 animate-pulse">Loading history...</div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-8 text-white/50">
          {targetUserName ? `${targetUserName} hasn't submitted any problems yet.` : "You haven't submitted any problems yet."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl">
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
                  <td className="py-3 px-4 font-medium text-white max-w-[200px] sm:max-w-none">
                    <div className="leading-snug flex items-start gap-2">
                      <a 
                        href={`https://leetcode.com/problems/${sub.titleSlug}/`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="hover:text-emerald-400 transition inline"
                      >
                        {sub.problemTitle}
                        <ExternalLink size={14} className="text-white/30 inline-block align-text-bottom ml-1.5 mb-[2px] shrink-0" />
                      </a>
                      {isOwner && (
                        <AlertDialog>
                          <AlertDialogTrigger 
                            disabled={deletingId === sub.id}
                            className="text-white/30 hover:text-red-400 transition disabled:opacity-50 shrink-0 mt-[3px]"
                            title="Delete submission"
                          >
                            {deletingId === sub.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-neutral-900 border border-white/10 text-white rounded-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription className="text-white/60">
                                This will permanently delete your submission and remove the points from your score. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-white/10 hover:bg-white/20 hover:text-white border-transparent text-white">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(sub)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
                                Delete Submission
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
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
