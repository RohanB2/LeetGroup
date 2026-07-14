"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, Timestamp, orderBy } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { subWeeks, eachDayOfInterval, format, startOfWeek, endOfWeek } from "date-fns";
import { Calendar } from "lucide-react";

export default function ActivityHeatmap() {
  const { user } = useAuth();
  const [activityData, setActivityData] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Generate the last 12 weeks of days
  const today = new Date();
  const startDate = startOfWeek(subWeeks(today, 12), { weekStartsOn: 0 }); // Sunday start
  const endDate = endOfWeek(today, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  useEffect(() => {
    const fetchActivity = async () => {
      if (!user) return;
      setLoading(true);
      
      try {
        const startTimestamp = Timestamp.fromDate(startDate);
        const q = query(
          collection(db, "submissions"),
          where("userId", "==", user.uid),
          where("timestamp", ">=", startTimestamp),
          orderBy("timestamp", "desc")
        );
        
        const snapshot = await getDocs(q);
        const counts: Record<string, number> = {};
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.timestamp) {
            const dateStr = format(data.timestamp.toDate(), 'yyyy-MM-dd');
            counts[dateStr] = (counts[dateStr] || 0) + 1;
          }
        });
        
        setActivityData(counts);
      } catch (error) {
        console.error("Error fetching activity data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [user]);

  const getColorClass = (count: number) => {
    if (count === 0) return "bg-white/5 border-white/5";
    if (count === 1) return "bg-emerald-500/30 border-emerald-500/20";
    if (count === 2) return "bg-emerald-500/60 border-emerald-500/40";
    return "bg-emerald-500 border-emerald-500";
  };

  // Group days by week (columns)
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  
  days.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7 || index === days.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string }>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
  });

  return (
    <div id="heatmap-wrapper" className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 relative">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-white">
        <Calendar size={20} className="text-emerald-400" />
        Activity Streak
      </h2>
      
      {loading ? (
        <div className="h-[120px] flex items-center justify-center text-white/50 animate-pulse">
          Loading graph...
        </div>
      ) : (
        <div className="flex flex-col items-center">
          {/* Added padding (pt-2 px-2) to prevent clipping of scaled bubbles on edges */}
          <div className="flex gap-1.5 overflow-x-auto pb-2 pt-2 px-2 max-w-full">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-1.5">
                {week.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const count = activityData[dateStr] || 0;
                  const dateFormatted = format(day, "MMMM do");
                  
                  return (
                    <div 
                      key={dateStr}
                      className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm border ${getColorClass(count)} cursor-pointer transition-transform hover:scale-125`}
                      onMouseEnter={(e) => {
                        const wrapper = document.getElementById("heatmap-wrapper");
                        if (!wrapper) return;
                        const wrapperRect = wrapper.getBoundingClientRect();
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltip({
                          visible: true,
                          x: rect.left - wrapperRect.left + rect.width / 2,
                          y: rect.top - wrapperRect.top - 8,
                          text: count > 0 
                            ? `${count} completed on ${dateFormatted}.` 
                            : `No problems completed on ${dateFormatted}.`
                        });
                      }}
                      onMouseLeave={() => setTooltip((prev) => ({ ...prev, visible: false }))}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex w-full justify-end items-center gap-2 mt-3 text-xs text-white/50">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-white/5 border border-white/5" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/30 border border-emerald-500/20" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500/60 border border-emerald-500/40" />
            <div className="w-3 h-3 rounded-sm bg-emerald-500 border border-emerald-500" />
            <span>More</span>
          </div>
        </div>
      )}

      {/* Custom Tooltip */}
      {tooltip.visible && (
        <div 
          className="absolute z-50 px-3 py-2 text-xs font-medium text-white/90 bg-[#2d333b] border border-white/10 rounded-md shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full whitespace-nowrap"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
