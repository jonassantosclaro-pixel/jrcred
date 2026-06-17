import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Configuração obtida do firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyDngF2REduV_dtx4s3ooG1XX-hDH6U9-Cs",
  authDomain: "gen-lang-client-0764078049.firebaseapp.com",
  projectId: "gen-lang-client-0764078049",
  storageBucket: "gen-lang-client-0764078049.firebasestorage.app",
  messagingSenderId: "774726434975",
  appId: "1:774726434975:web:a8b327afb3e2ca3ddee2aa"
};

const app = initializeApp(firebaseConfig);

// Inicialização especial com o ID do banco de dados customizado do AI Studio
const db = initializeFirestore(app, {}, "ai-studio-ef642b0f-0f18-4a65-84d2-3677a8adf1fe");
const auth = getAuth(app);

export { app, db, auth };
