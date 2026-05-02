src/
├── config/
│   └── firebase.ts
├── contexts/
│   ├── AuthContext.tsx          ← has presence heartbeat
│   └── WebRTCContext.tsx
├── services/
│   ├── chatService.ts
│   └── typingService.ts
├── hooks/
│   ├── useUserPresence.ts      (realtime listener)
│   └── useTypingIndicator.ts   (typing listener)
├── components/
│   ├── Layout.tsx              (collapsible sidebar)
│   ├── AuthGuard.tsx
│   ├── PublicRoute.tsx
│   ├── CallModal.tsx
│   ├── ConversationList.tsx    (extracted sidebar list)
│   └── ui/
│       ├── PresenceDot.tsx
│       └── TypingDots.tsx
├── pages/
│   ├── Login.tsx
│   ├── SetPassword.tsx
│   ├── MessagesPage.tsx        (main chat page, now lean)
│   ├── SettingsPage.tsx
│   ├── GroupsPage.tsx
│   └── CallPage.tsx
├── utils/
│   └── getInitials.ts
├── App.tsx
└── main.tsx