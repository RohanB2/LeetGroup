"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, arrayUnion, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { Users, Plus, Mail, Check, X, Loader2, User as UserIcon, Crown, UserMinus } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface Group {
  id: string;
  name: string;
  members: string[];
  ownerId?: string;
}

interface Invite {
  id: string;
  groupId: string;
  groupName: string;
  fromUserName: string;
}

export default function GroupsPanel() {
  const { user, userData } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Forms state
  const [newGroupName, setNewGroupName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // View Members state
  const [viewingGroup, setViewingGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<{uid: string, displayName: string}[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user, userData]);

  const fetchData = async () => {
    if (!user || !userData) return;
    setLoading(true);
    try {
      // 1. Fetch user's groups
      const userGroupIds = userData.groups || [];
      const fetchedGroups: Group[] = [];
      
      // We process them one by one. In a real app we might use 'in' queries, 
      // but 'in' is limited to 10. This is fine for a small scale app.
      if (userGroupIds.includes("global")) {
        fetchedGroups.push({ id: "global", name: "Global Leaderboard", members: [] });
      }
      
      const customGroups = userGroupIds.filter(id => id !== "global");
      for (const groupId of customGroups) {
        const gDoc = await getDoc(doc(db, "groups", groupId));
        if (gDoc.exists()) {
          fetchedGroups.push({ id: gDoc.id, ...gDoc.data() } as Group);
        }
      }
      setGroups(fetchedGroups);
      if (fetchedGroups.length > 0 && !selectedGroupId) {
        setSelectedGroupId(fetchedGroups[0].id);
      }

      // 2. Fetch pending invites for this user's email
      if (userData.email) {
        const q = query(
          collection(db, "invites"),
          where("toUserEmail", "==", userData.email),
          where("status", "==", "pending")
        );
        const invSnap = await getDocs(q);
        const fetchedInvites: Invite[] = [];
        invSnap.forEach(doc => fetchedInvites.push({ id: doc.id, ...doc.data() } as Invite));
        setInvites(fetchedInvites);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !newGroupName.trim()) return;
    
    setActionLoading(true);
    setMessage(null);
    try {
      // Create group document
      const groupRef = await addDoc(collection(db, "groups"), {
        name: newGroupName.trim(),
        ownerId: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp()
      });
      
      // Add group to user's list
      await updateDoc(doc(db, "users", user.uid), {
        groups: arrayUnion(groupRef.id)
      });
      
      setNewGroupName("");
      setMessage({ type: 'success', text: 'Group created successfully!' });
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to create group.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData || !inviteEmail.trim() || !selectedGroupId || selectedGroupId === "global") {
      setMessage({ type: 'error', text: 'Please select a custom group.' });
      return;
    }
    
    setActionLoading(true);
    setMessage(null);
    try {
      const group = groups.find(g => g.id === selectedGroupId);
      await addDoc(collection(db, "invites"), {
        groupId: selectedGroupId,
        groupName: group?.name || "A Group",
        fromUserId: user.uid,
        fromUserName: userData.displayName,
        toUserEmail: inviteEmail.trim(),
        status: "pending",
        createdAt: serverTimestamp()
      });
      
      setInviteEmail("");
      setMessage({ type: 'success', text: `Invite sent to ${inviteEmail}!` });
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to send invite.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRespondToInvite = async (inviteId: string, groupId: string, accept: boolean) => {
    if (!user) return;
    try {
      // Update invite status
      await updateDoc(doc(db, "invites", inviteId), {
        status: accept ? "accepted" : "declined"
      });
      
      if (accept) {
        // Add user to group
        await updateDoc(doc(db, "groups", groupId), {
          members: arrayUnion(user.uid)
        });
        // Add group to user
        await updateDoc(doc(db, "users", user.uid), {
          groups: arrayUnion(groupId)
        });
        setMessage({ type: 'success', text: 'Group joined successfully!' });
      }
      
      // Refresh
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Action failed.' });
    }
  };

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const handleCopyLink = (groupId: string) => {
    const link = `${window.location.origin}/join/${groupId}`;
    navigator.clipboard.writeText(link);
    setMessage({ type: 'success', text: 'Invite link copied to clipboard!' });
  };

  const handleLeaveGroup = async (groupId: string) => {
    if (!user || !userData) return;
    
    setActionLoading(true);
    try {
      // Remove user from group members
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        const members = groupDoc.data().members || [];
        await updateDoc(doc(db, "groups", groupId), {
          members: members.filter((m: string) => m !== user.uid)
        });
      }
      
      // Remove group from user
      const updatedGroups = (userData.groups || []).filter(g => g !== groupId);
      await updateDoc(doc(db, "users", user.uid), {
        groups: updatedGroups
      });
      
      setMessage({ type: 'success', text: 'Left the group.' });
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to leave group.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    if (!editGroupName.trim()) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "groups", groupId), {
        name: editGroupName.trim()
      });
      setMessage({ type: 'success', text: 'Group renamed successfully.' });
      setEditingGroupId(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to rename group.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleKickMember = async (groupId: string, memberId: string) => {
    if (!user || !userData) return;
    setActionLoading(true);
    try {
      // Remove member from group
      const groupDoc = await getDoc(doc(db, "groups", groupId));
      if (groupDoc.exists()) {
        const members = groupDoc.data().members || [];
        await updateDoc(doc(db, "groups", groupId), {
          members: members.filter((m: string) => m !== memberId)
        });
      }
      
      // Remove group from user
      const uDoc = await getDoc(doc(db, "users", memberId));
      if (uDoc.exists()) {
        const uGroups = uDoc.data().groups || [];
        await updateDoc(doc(db, "users", memberId), {
          groups: uGroups.filter((g: string) => g !== groupId)
        });
      }
      
      setMessage({ type: 'success', text: 'Member kicked successfully.' });
      
      // Update local members list
      setGroupMembers(prev => prev.filter(m => m.uid !== memberId));
      
      // Also update the viewingGroup local state
      if (viewingGroup && viewingGroup.id === groupId) {
         setViewingGroup({ ...viewingGroup, members: viewingGroup.members?.filter(m => m !== memberId) });
      }

      fetchData();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'Failed to kick member.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleViewGroup = async (group: Group) => {
    setViewingGroup(group);
    setLoadingMembers(true);
    setGroupMembers([]);
    try {
      const membersData = [];
      const memberIds = group.members || [];
      // Fetch users one by one (could use 'in' query if <= 10, but this handles >10)
      for (const uid of memberIds) {
        const uDoc = await getDoc(doc(db, "users", uid));
        if (uDoc.exists()) {
          membersData.push({ uid, displayName: uDoc.data().displayName || "Unknown User" });
        } else {
          membersData.push({ uid, displayName: "Unknown User" });
        }
      }
      setGroupMembers(membersData);
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  if (loading) {
    return <div className="text-center py-4 text-white/50 animate-pulse">Loading groups...</div>;
  }

  return (
    <div className="bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-6 max-w-4xl mx-auto w-full">
      <h2 className="text-xl font-bold flex items-center gap-2 text-white mb-6">
        <Users className="text-emerald-400" size={22} />
        Groups
      </h2>
      <div className="flex flex-col gap-6">
      
      {/* Pending Invites Section */}
      {invites.length > 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
          <h3 className="text-emerald-400 font-semibold mb-3 text-sm flex items-center gap-2">
            <Mail size={16} /> Pending Invites ({invites.length})
          </h3>
          <div className="flex flex-col gap-2">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center justify-between bg-black/20 rounded-lg p-3">
                <div className="text-sm">
                  <span className="text-white font-medium">{inv.fromUserName}</span> invited you to <span className="text-white font-medium">{inv.groupName}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleRespondToInvite(inv.id, inv.groupId, true)} className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-400 rounded-md transition">
                    <Check size={16} />
                  </button>
                  <button onClick={() => handleRespondToInvite(inv.id, inv.groupId, false)} className="p-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-md transition">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Group List & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Create Group */}
        <div className="bg-black/20 rounded-xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Users size={18} className="text-emerald-400" /> Create a Group
          </h3>
          <form onSubmit={handleCreateGroup} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Group Name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 text-sm"
              required
            />
            <button
              type="submit"
              disabled={actionLoading || !newGroupName.trim()}
              className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Group
            </button>
          </form>
        </div>

        {/* Invite Someone */}
        <div className="bg-black/20 rounded-xl border border-white/10 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Mail size={18} className="text-emerald-400" /> Invite via Email
          </h3>
          <form onSubmit={handleSendInvite} className="flex flex-col gap-3">
            <Select value={selectedGroupId} onValueChange={(val) => val && setSelectedGroupId(val)}>
              <SelectTrigger className="w-full h-10 rounded-lg bg-black/20 border-white/10 text-white hover:bg-black/30 transition-colors">
                <SelectValue placeholder="Select Group">
                  {groups.find(g => g.id === selectedGroupId)?.name || "Select Group"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-neutral-900 border-white/10 backdrop-blur-2xl rounded-xl shadow-2xl">
                <SelectGroup>
                  <SelectLabel className="text-white/40 text-xs uppercase tracking-wider px-2 py-1.5">Your Groups</SelectLabel>
                  {groups.filter(g => g.id !== "global").map(g => (
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
            <input
              type="email"
              placeholder="Friend's Email Address"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-black/20 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50 text-sm"
              required
            />
            <button
              type="submit"
              disabled={actionLoading || !inviteEmail.trim() || !selectedGroupId || selectedGroupId === "global"}
              className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
              Send Email Invite
            </button>
          </form>
        </div>
      </div>

      {/* Manage Groups Section */}
      <div className="bg-black/20 rounded-xl border border-white/10 p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Users size={18} className="text-emerald-400" /> Manage Groups
        </h3>
        {groups.filter(g => g.id !== "global").length === 0 ? (
          <p className="text-white/50 text-sm">You are not in any custom groups yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.filter(g => g.id !== "global").map(group => (
              <div key={group.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-black/20 rounded-lg p-3 gap-3 border border-white/5">
                {editingGroupId === group.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editGroupName}
                      onChange={(e) => setEditGroupName(e.target.value)}
                      className="h-9 px-3 rounded-md bg-white/10 border border-white/20 text-white focus:outline-none focus:border-emerald-500/50 text-sm flex-1"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameGroup(group.id)}
                      disabled={actionLoading || !editGroupName.trim()}
                      className="px-3 h-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingGroupId(null)}
                      className="px-3 h-9 bg-white/10 hover:bg-white/20 text-white rounded-md text-sm font-medium transition"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div 
                      className="flex items-center gap-3 cursor-pointer group/name flex-1"
                      onClick={() => handleViewGroup(group)}
                    >
                      <span className="text-white font-medium group-hover/name:text-emerald-400 transition-colors">{group.name}</span>
                      <span className="text-white/40 text-xs bg-white/5 px-2 py-1 rounded-md group-hover/name:bg-emerald-500/10 group-hover/name:text-emerald-400 transition-colors">
                        {group.members?.length === 1 ? '1 member' : `${group.members?.length || 0} members`}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                          setEditingGroupId(group.id);
                          setEditGroupName(group.name);
                        }}
                        className="text-white/40 hover:text-white transition p-1"
                        title="Rename Group"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleCopyLink(group.id)}
                        className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 rounded-md text-sm font-medium transition flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        Copy Link
                      </button>
                      <AlertDialog>
                        <AlertDialogTrigger
                          className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-md text-sm font-medium transition"
                        >
                          Leave Group
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-neutral-900 border border-white/10 text-white rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription className="text-white/60">
                              You will be removed from this group. You will need a new invite to join again.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-white/10 hover:bg-white/20 hover:text-white border-transparent text-white">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleLeaveGroup(group.id)}
                              className="bg-red-600 hover:bg-red-700 text-white"
                            >
                              Leave Group
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm font-medium border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
          'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
          {message.text}
        </div>
      )}
      </div>

      {/* Members Dialog */}
      <Dialog open={!!viewingGroup} onOpenChange={(open) => !open && setViewingGroup(null)}>
        <DialogContent className="bg-neutral-900 border-white/10 text-white rounded-xl">
          <DialogHeader>
            <DialogTitle>{viewingGroup?.name} Members</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4 max-h-[60vh] overflow-y-auto">
            {loadingMembers ? (
              <div className="text-center text-white/50 py-4 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading members...
              </div>
            ) : groupMembers.length === 0 ? (
              <div className="text-center text-white/50 py-4">No members found.</div>
            ) : (
              groupMembers.map(member => (
                <div key={member.uid} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                      <UserIcon size={16} />
                    </div>
                    <span className="font-medium text-white/90 flex items-center gap-2">
                      {member.displayName}
                      {member.uid === viewingGroup?.ownerId && (
                        <div className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
                          <Crown size={12} />
                          Leader
                        </div>
                      )}
                    </span>
                  </div>
                  
                  {user?.uid === viewingGroup?.ownerId && member.uid !== viewingGroup?.ownerId && (
                    <button 
                      onClick={() => handleKickMember(viewingGroup!.id, member.uid)}
                      disabled={actionLoading}
                      className="text-xs px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md transition disabled:opacity-50 flex items-center gap-1"
                    >
                      <UserMinus size={12} />
                      Kick
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
