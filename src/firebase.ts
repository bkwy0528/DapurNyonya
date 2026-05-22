// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCaC-6Jrjgm3cpgi7outr5t-IKPuZ4ipa0",
  authDomain: "dapurnyonya-9b752.firebaseapp.com",
  projectId: "dapurnyonya-9b752",
  storageBucket: "dapurnyonya-9b752.firebasestorage.app",
  messagingSenderId: "236811840368",
  appId: "1:236811840368:web:f1acde48db24122ac93db5",
  measurementId: "G-9PDL3SK2NM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);