import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCaC-6Jrjgm3cpgi7outr5t-IKPuZ4ipa0",
  authDomain: "dapurnyonya-9b752.firebaseapp.com",
  projectId: "dapurnyonya-9b752",
  storageBucket: "dapurnyonya-9b752.firebasestorage.app",
  messagingSenderId: "236811840368",
  appId: "1:236811840368:web:f1acde48db24122ac93db5",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
