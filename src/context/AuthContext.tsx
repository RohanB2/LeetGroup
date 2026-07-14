"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userData: UserData | null;
}

export interface UserData {
  uid: string;
  email: string | null;
  displayName: string;
  photoURL: string;
  weeklyPoints: number;
  allTimePoints: number;
  currentStreak: number;
  lastSubmissionDate: string | null;
  groups: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userData: null,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      // Clean up previous document listener if it exists
      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = undefined;
      }
      
      if (currentUser) {
        const userRef = doc(db, "users", currentUser.uid);
        
        // Listen to real-time updates for the user document
        unsubscribeDoc = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const data = userSnap.data() as UserData;
            // Migration for existing users
            if (data.email === undefined || data.groups === undefined) {
              await setDoc(userRef, { 
                email: currentUser.email || null,
                groups: data.groups || ["global"] 
              }, { merge: true });
            }
            setUserData(data);
          } else {
            // Create new user profile if it doesn't exist yet
            const newUserData: UserData = {
              uid: currentUser.uid,
              email: currentUser.email || null,
              displayName: currentUser.displayName || "Anonymous User",
              photoURL: currentUser.photoURL || "",
              weeklyPoints: 0,
              allTimePoints: 0,
              currentStreak: 0,
              lastSubmissionDate: null,
              groups: ["global"],
            };
            await setDoc(userRef, newUserData);
          }
          // Only stop loading once we have the user data from Firestore
          setLoading(false);
        });
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) {
        unsubscribeDoc();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, userData }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
