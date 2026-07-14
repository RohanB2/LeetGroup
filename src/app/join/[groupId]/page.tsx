"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function JoinGroupPage({ params }: { params: { groupId: string } }) {
  const { user, userData, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [group, setGroup] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const gDoc = await getDoc(doc(db, "groups", params.groupId));
        if (gDoc.exists()) {
          setGroup({ id: gDoc.id, name: gDoc.data().name });
        } else {
          setMessage({ type: 'error', text: 'Group not found.' });
        }
      } catch (err) {
        console.error(err);
        setMessage({ type: 'error', text: 'Failed to fetch group.' });
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [params.groupId]);

  const handleJoin = async () => {
    if (!user || !userData || !group) return;
    
    // Check if already in group
    if (userData.groups?.includes(group.id)) {
      router.push('/');
      return;
    }

    setActionLoading(true);
    try {
      // Add user to group
      await updateDoc(doc(db, "groups", group.id), {
        members: arrayUnion(user.uid)
      });
      // Add group to user
      await updateDoc(doc(db, "users", user.uid), {
        groups: arrayUnion(group.id)
      });
      setMessage({ type: 'success', text: 'Joined group successfully! Redirecting...' });
      setTimeout(() => {
        router.push('/');
      }, 1500);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to join group.' });
      setActionLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-transparent">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="bg-black/40 backdrop-blur-2xl border border-white/10 p-10 rounded-3xl shadow-2xl max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-emerald-500/20 rounded-full ring-1 ring-emerald-500/30">
            <Users size={48} className="text-emerald-400" />
          </div>
        </div>
        
        {group ? (
          <>
            <h1 className="text-3xl font-bold tracking-tight mb-3 text-white">
              Join <span className="text-emerald-400">{group.name}</span>
            </h1>
            <p className="mb-8 text-white/60 leading-relaxed">
              You have been invited to join this group. Compete and track your LeetCode progress together!
            </p>
            
            {!user ? (
              <div className="flex flex-col gap-4">
                <p className="text-orange-400 font-medium bg-orange-400/10 p-4 rounded-xl border border-orange-400/20">
                  You need to log in first.
                </p>
                <Button
                  onClick={() => router.push('/')}
                  className="w-full h-12 text-base font-semibold bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                >
                  Go to Login
                </Button>
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={actionLoading}
                className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl flex justify-center items-center gap-2 transition-all duration-200 disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : null}
                {userData?.groups?.includes(group.id) ? "Go to Dashboard" : "Join Group"}
              </button>
            )}
          </>
        ) : (
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4 text-white">Oops!</h1>
            <p className="mb-8 text-white/60">We couldn't find this group. The link might be invalid.</p>
            <Button
              onClick={() => router.push('/')}
              className="w-full h-12 text-base font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all"
            >
              Go Home
            </Button>
          </div>
        )}

        {message && (
          <div className={`mt-6 p-4 rounded-xl text-sm font-medium border ${
            message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
            'bg-red-500/10 text-red-400 border-red-500/20'
          }`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
