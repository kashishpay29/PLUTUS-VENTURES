importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDACmqlSoGfQR_2QXDzS-Srdo85sjwpQ8A",
  authDomain: "plutus-ventures.firebaseapp.com",
  projectId: "plutus-ventures",
  storageBucket: "plutus-ventures.firebasestorage.app",
  messagingSenderId: "931539119504",
  appId: "1:931539119504:web:5508da58244fc483ef5715"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("Background Message:", payload);

  self.registration.showNotification(
    payload.notification?.title || "New Notification",
    {
      body: payload.notification?.body || "",
      icon: "/plutus_logo.jpeg"
    }
  );
});