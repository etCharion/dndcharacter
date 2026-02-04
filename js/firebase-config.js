import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA-NNxdZCN1dGipFWo5ntYpeSGUboQ0IdA",
  authDomain: "dndcharacter-384e8.firebaseapp.com",
  projectId: "dndcharacter-384e8",
  storageBucket: "dndcharacter-384e8.firebasestorage.app",
  messagingSenderId: "451161556924",
  appId: "1:451161556924:web:95496c3fcbb3155000cdb9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export { auth, db, googleProvider };
