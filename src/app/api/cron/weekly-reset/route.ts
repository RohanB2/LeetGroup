import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, writeBatch, doc, addDoc, serverTimestamp } from "firebase/firestore";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    
    // In a real app, use a secure env variable for the cron secret
    // e.g. process.env.CRON_SECRET
    if (authHeader !== `Bearer ${process.env.CRON_SECRET || 'dev-secret'}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.empty) {
      return NextResponse.json({ message: "No users found" });
    }

    let users: any[] = [];
    snapshot.forEach(doc => {
      users.push({ id: doc.id, ...doc.data() });
    });

    // Find winner and loser (only considering users who have > 0 points or maybe everyone)
    // Sort by weeklyPoints descending
    users.sort((a, b) => b.weeklyPoints - a.weeklyPoints);
    
    const winner = users[0];
    const loser = users[users.length - 1];

    // Log the result
    await addDoc(collection(db, "weekly_results"), {
      timestamp: serverTimestamp(),
      winnerId: winner.id,
      winnerName: winner.displayName,
      winnerPoints: winner.weeklyPoints,
      loserId: loser.id,
      loserName: loser.displayName,
      loserPoints: loser.weeklyPoints,
      totalParticipants: users.length,
    });

    // Reset points using a batch
    const batch = writeBatch(db);
    users.forEach(user => {
      const userRef = doc(db, "users", user.id);
      batch.update(userRef, { weeklyPoints: 0 });
    });

    await batch.commit();

    return NextResponse.json({ 
      success: true, 
      message: "Weekly reset successful",
      winner: winner.displayName,
      loser: loser.displayName
    });

  } catch (error) {
    console.error("Cron reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
