# LeetGroup

LeetGroup is a competitive LeetCode tracking platform designed for groups of friends. It allows users to log their solved problems, track their activity streaks, and compete on a weekly leaderboard to stay motivated and consistent with their interview preparation.

## Features

- **Activity Tracking**: Visualize your consistency with a GitHub-style activity heatmap that records your daily problem-solving streaks.
- **Weekly Competition**: A dynamic leaderboard that tracks points earned throughout the week. Points are automatically reset every Sunday to keep the competition fresh.
- **Groups & Invites**: Create private groups and invite friends via email. Filter the leaderboard to see how you stack up against specific groups.
- **Problem Logging**: Submit LeetCode URLs, difficulty levels, and the programming language used. The system automatically calculates points based on the problem's difficulty. (Easy: 1; Medium: 2; Hard: 3)
- **Google Authentication**: Secure and fast login using Firebase Authentication with Google accounts.

## Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Lucide Icons
- **Backend & Database**: Firebase Authentication, Cloud Firestore
- **Deployment**: Designed for Vercel, including automated Vercel Cron Jobs for weekly resets
