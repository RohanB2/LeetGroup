"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, doc, deleteDoc, updateDoc, increment } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { History, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { startOfWeek, endOfWeek } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";

const DIFFICULTY_POINTS: Record<string, number> = { Easy: 1, Medium: 3, Hard: 5 };

interface Submission {
  id: string;
  titleSlug: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  language: string;
  timestamp: any;
}

interface GroupedSubmission {
  id: string; 
  titleSlug: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  totalPoints: number;
  mostRecentTimestamp: any;
  submissions: Submission[];
}

interface SubmissionHistoryProps {
  targetUserId?: string;
  targetUserName?: string;
  isModal?: boolean;
}

function DeleteSubmissionsDialog({ 
  group, 
  onDelete, 
  deleting 
}: { 
  group: GroupedSubmission; 
  onDelete: (subs: Submission[]) => void;
  deleting: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(group.submissions.map(s => s.id)));
  const [isOpen, setIsOpen] = useState(false);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const isMulti = group.submissions.length > 1;

  const handleDelete = () => {
    const toDelete = group.submissions.filter(s => selectedIds.has(s.id));
    onDelete(toDelete);
    setIsOpen(false);
  };

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(group.submissions.map(s => s.id)));
    }
  }, [isOpen, group]);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger 
        disabled={deleting}
        className="text-white/30 hover:text-red-400 transition disabled:opacity-50 shrink-0 mt-[3px]"
        title="Delete submission"
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-neutral-900 border border-white/10 text-white rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription className="text-white/60">
            {isMulti 
              ? "Select which submissions you want to delete. If you delete all submissions for this problem, the points will be removed from your score."
              : "This will permanently delete your submission and remove the points from your score. This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        {isMulti && (
          <div className="flex flex-col gap-3 py-4 max-h-[50vh] overflow-y-auto">
            {group.submissions.map(sub => (
              <div key={sub.id} className="flex items-center space-x-3 bg-white/5 p-3 rounded-lg border border-white/10">
                <Checkbox 
                  id={`delete-${sub.id}`} 
                  checked={selectedIds.has(sub.id)}
                  onCheckedChange={() => toggleSelection(sub.id)}
                  className="border-white/30 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                />
                <label 
                  htmlFor={`delete-${sub.id}`} 
                  className="text-sm font-medium leading-none cursor-pointer flex-1 flex justify-between items-center"
                >
                  <span className="bg-white/10 text-white/70 px-2.5 py-1 rounded-md text-xs">
                    {sub.language}
                  </span>
                </label>
              </div>
            ))}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/10 hover:bg-white/20 hover:text-white border-transparent text-white">Cancel</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete}
            disabled={selectedIds.size === 0}
            className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            Delete Selected
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function SubmissionHistory({ targetUserId, targetUserName, isModal }: SubmissionHistoryProps = {}) {
  const { user: authUser } = useAuth();
  const [groupedSubmissions, setGroupedSubmissions] = useState<GroupedSubmission[]>([]);
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
      
      const groupMap = new Map<string, GroupedSubmission>();

      snapshot.forEach((doc) => {
        const sub = { id: doc.id, ...doc.data() } as Submission;
        if (groupMap.has(sub.titleSlug)) {
           const existing = groupMap.get(sub.titleSlug)!;
           existing.submissions.push(sub);
        } else {
           groupMap.set(sub.titleSlug, {
              id: sub.titleSlug,
              titleSlug: sub.titleSlug,
              problemTitle: sub.problemTitle,
              difficulty: sub.difficulty,
              totalPoints: DIFFICULTY_POINTS[sub.difficulty] || 0,
              mostRecentTimestamp: sub.timestamp,
              submissions: [sub]
           });
        }
      });
      
      setGroupedSubmissions(Array.from(groupMap.values()));
    } catch (error) {
      console.error("Error fetching history:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [uid]);

  const recalculateUserPoints = async (userId: string) => {
    const submissionsRef = collection(db, "submissions");
    const q = query(submissionsRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);
    
    const problemFirstSub = new Map<string, { timestamp: Date, difficulty: string }>();

    snapshot.forEach((doc) => {
      const data = doc.data();
      const titleSlug = data.titleSlug as string;
      const difficulty = data.difficulty as string;
      const subDate = data.timestamp?.toDate();
      
      if (!titleSlug || !subDate || !difficulty) return;
      
      if (!problemFirstSub.has(titleSlug)) {
         problemFirstSub.set(titleSlug, { timestamp: subDate, difficulty });
      } else {
         if (subDate < problemFirstSub.get(titleSlug)!.timestamp) {
            problemFirstSub.set(titleSlug, { timestamp: subDate, difficulty });
         }
      }
    });

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    
    let allTime = 0;
    let weekly = 0;
    
    for (const { timestamp, difficulty } of problemFirstSub.values()) {
       const points = DIFFICULTY_POINTS[difficulty] || 0;
       allTime += points;
       if (timestamp >= weekStart && timestamp <= weekEnd) {
          weekly += points;
       }
    }

    await updateDoc(doc(db, "users", userId), {
       allTimePoints: allTime,
       weeklyPoints: weekly
    });
  };

  const handleDeleteGrouped = async (subsToDelete: Submission[]) => {
    if (!authUser || !isOwner || subsToDelete.length === 0) return;
    
    setDeletingId(subsToDelete[0].titleSlug); 
    try {
      for (const sub of subsToDelete) {
        await deleteDoc(doc(db, "submissions", sub.id));
      }

      await recalculateUserPoints(authUser.uid);
      await fetchHistory();
    } catch (error) {
      console.error("Failed to delete submissions:", error);
      alert("Failed to delete submissions.");
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
      ) : groupedSubmissions.length === 0 ? (
        <div className="text-center py-8 text-white/50">
          {targetUserName ? `${targetUserName} hasn't submitted any problems yet.` : "You haven't submitted any problems yet."}
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh] rounded-2xl custom-scrollbar pr-2">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10">
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider">Problem</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider">Difficulty</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider">Languages</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider text-right">Points</th>
                <th className="py-3 px-4 font-medium text-sm text-white/50 uppercase tracking-wider text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {groupedSubmissions.map((group) => (
                <tr key={group.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4 font-medium text-white max-w-[200px] sm:max-w-none">
                    <div className="leading-snug flex items-start gap-2">
                      <a 
                        href={`https://leetcode.com/problems/${group.titleSlug}/`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="hover:text-emerald-400 transition inline"
                      >
                        {group.problemTitle}
                        <ExternalLink size={14} className="text-white/30 inline-block align-text-bottom ml-1.5 mb-[2px] shrink-0" />
                      </a>
                      {isOwner && (
                        <DeleteSubmissionsDialog 
                          group={group} 
                          onDelete={handleDeleteGrouped} 
                          deleting={deletingId === group.id} 
                        />
                      )}
                    </div>
                  </td>
                  <td className={`py-3 px-4 font-semibold text-sm ${getDifficultyColor(group.difficulty)}`}>
                    {group.difficulty}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      {group.submissions.map((sub, idx) => (
                        <span key={idx} className="bg-white/10 text-white/70 px-2.5 py-1 rounded-lg text-xs font-medium">
                          {sub.language}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-400">
                    +{group.totalPoints}
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-white/40">
                    {formatDate(group.mostRecentTimestamp)}
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
