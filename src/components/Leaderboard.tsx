"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, getDocs, getDoc, doc, where } from "firebase/firestore";
import { Trophy, Medal, Award, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfWeek, endOfWeek, formatDistanceToNowStrict } from "date-fns";
import SubmissionHistory from "./SubmissionHistory";

interface LeaderboardUser {
  uid: string;
  displayName: string;
  photoURL: string;
  weeklyPoints: number;
  allTimePoints: number;
  currentStreak: number;
}

interface Group {
  id: string;
  name: string;
}

export default function Leaderboard() {
  const { user, userData } = useAuth();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<"weekly" | "allTime">("weekly");
  const [selectedGroup, setSelectedGroup] = useState<string>("global");
  const [availableGroups, setAvailableGroups] = useState<Group[]>([{ id: "global", name: "Global Leaderboard" }]);
  const [timeLeft, setTimeLeft] = useState("");
  const [weekRange, setWeekRange] = useState({ start: "", end: "" });
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);

  // Timer logic
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const start = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
      const end = endOfWeek(now, { weekStartsOn: 0 }); // Saturday 23:59:59
      
      setWeekRange({
        start: format(start, "MMM do"),
        end: format(end, "MMM do"),
      });
      
      setTimeLeft(formatDistanceToNowStrict(end));
    };
    
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      if (!userData || !userData.groups) return;
      const fetched: Group[] = [{ id: "global", name: "Global Leaderboard" }];
      const customIds = userData.groups.filter(id => id !== "global");
      for (const gid of customIds) {
        const gDoc = await getDoc(doc(db, "groups", gid));
        if (gDoc.exists()) {
          fetched.push({ id: gDoc.id, name: gDoc.data().name });
        }
      }
      setAvailableGroups(fetched);
    };
    fetchGroups();
  }, [userData]);

  // Fetch leaderboard
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const usersRef = collection(db, "users");
        let q;
        
        if (selectedGroup === "global") {
          q = query(
            usersRef,
            orderBy(timeframe === "weekly" ? "weeklyPoints" : "allTimePoints", "desc"),
            limit(50)
          );
        } else {
          // Requires a composite index for groups array-contains + orderBy
          q = query(
            usersRef,
            where("groups", "array-contains", selectedGroup),
            orderBy(timeframe === "weekly" ? "weeklyPoints" : "allTimePoints", "desc"),
            limit(50)
          );
        }

        const snapshot = await getDocs(q);
        const fetchedUsers: LeaderboardUser[] = [];
        snapshot.forEach((doc) => {
          fetchedUsers.push(doc.data() as LeaderboardUser);
        });
        setUsers(fetchedUsers);
      } catch (error: any) {
        console.error("Error fetching leaderboard:", error);
        if (error.message && error.message.includes("requires an index")) {
          console.warn("Firestore index missing. Please create the index suggested in the console.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [timeframe, selectedGroup]);

  return (
    <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <Trophy className="text-emerald-400" size={22} />
          Leaderboard
        </h2>
        
        <div className="flex items-center gap-3">
          {/* Group Selector */}
          <Select value={selectedGroup} onValueChange={(val) => val && setSelectedGroup(val)}>
            <SelectTrigger className="h-10 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/8 transition-colors min-w-[180px]">
              <SelectValue placeholder="Select Group">
                {availableGroups.find(g => g.id === selectedGroup)?.name || "Select Group"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-white/10 backdrop-blur-2xl rounded-xl shadow-2xl">
              <SelectGroup>
                <SelectLabel className="text-white/40 text-xs uppercase tracking-wider px-2 py-1.5">Groups</SelectLabel>
                {availableGroups.map(g => (
                  <SelectItem
                    key={g.id}
                    value={g.id}
                    className="text-white/80 focus:bg-emerald-600/20 focus:text-emerald-300 rounded-lg cursor-pointer"
                  >
                    {g.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Timeframe Toggles */}
          <div className="flex bg-white/5 rounded-xl p-1">
            <button 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                timeframe === 'weekly'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-white/50 hover:text-white'
              }`}
              onClick={() => setTimeframe('weekly')}
            >
              Weekly
            </button>
            <button 
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                timeframe === 'allTime'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                  : 'text-white/50 hover:text-white'
              }`}
              onClick={() => setTimeframe('allTime')}
            >
              All-Time
            </button>
          </div>
        </div>
      </div>

      {/* Weekly Timer Info */}
      {timeframe === "weekly" && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-6 flex justify-between items-center text-sm">
          <div className="text-emerald-400/80">
            <span className="font-medium text-emerald-400">Current Week:</span> {weekRange.start} — {weekRange.end}
          </div>
          <div className="text-emerald-400/80 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Clock size={14} className="text-emerald-500" />
            Ends in {timeLeft}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-white/50 animate-pulse">Loading leaderboard...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-white/50">No users found in this group.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {users.map((u, index) => (
            <div
              key={u.uid}
              onClick={() => setSelectedUser(u)}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer ${
                index < 3
                  ? 'bg-white/5 border-white/10 hover:bg-white/10'
                  : 'bg-transparent border-transparent hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-8 h-8 font-bold">
                  {index === 0 && <Trophy className="text-yellow-400" size={24} />}
                  {index === 1 && <Medal className="text-gray-300" size={24} />}
                  {index === 2 && <Award className="text-amber-600" size={24} />}
                  {index > 2 && <span className="text-white/30 text-lg">{index + 1}</span>}
                </div>
                <img
                  src={u.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.displayName)}&background=198a48&color=fff`}
                  alt={u.displayName}
                  className="w-10 h-10 rounded-full ring-2 ring-white/10"
                />
                <div>
                  <div className="font-semibold text-white">{u.displayName}</div>
                  <div className="text-xs text-white/40 flex items-center gap-1">
                    <span className="text-orange-400 font-medium">🔥 {u.currentStreak} day streak</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-emerald-400">
                  {timeframe === "weekly" ? u.weeklyPoints : u.allTimePoints}
                </div>
                <div className="text-xs text-white/40 uppercase tracking-wider">Points</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* User History Modal */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-2xl sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedUser?.displayName}&apos;s History</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <SubmissionHistory targetUserId={selectedUser.uid} targetUserName={selectedUser.displayName} isModal={true} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
