// firebase/config.js

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import { FIREBASE_API_KEY } from '@env';

const firebaseConfig = {
    apiKey: FIREBASE_API_KEY,
    authDomain: "hourkeeper-efda9.firebaseapp.com",
    projectId: "hourkeeper-efda9",
    storageBucket: "hourkeeper-efda9.firebasestorage.app",
    messagingSenderId: "1067929500748",
    appId: "1:1067929500748:web:98f6470ffe3dd54d1d88e9",
    measurementId: "G-8EGF2XFQB7"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

export { firebase, auth, db };
