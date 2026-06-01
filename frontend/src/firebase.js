import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDACmqlSoGfQR_2QXDzS-Srdo85sjwpQ8A",
  authDomain: "plutus-ventures.firebaseapp.com",
  projectId: "plutus-ventures",
  storageBucket: "plutus-ventures.firebasestorage.app",
  messagingSenderId: "931539119504",
  appId: "1:931539119504:web:5508da58244fc483ef5715",
  measurementId: "G-3Q4TN90FXL"
};

const app = initializeApp(firebaseConfig);

export const messaging = getMessaging(app);

export const requestPermission = async () => {
  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      const token = await getToken(messaging, {
        vapidKey: "BDI6P2eT_y6boJ0JSTx6qpjTg4fM0WN9YotWVmDV1igiZ3K3ftyJbwpJ_gQQKfimbbLLPWH3_YheaYWaPionClQ"
      });

      console.log("FCM Token:", token);
      return token;
    }

    return null;
  } catch (error) {
    console.error("Error getting notification permission:", error);
    return null;
  }
};

onMessage(messaging, (payload) => {
  console.log("Foreground Message:", payload);
});