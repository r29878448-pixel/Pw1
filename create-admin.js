// Quick script to create admin account in Firebase
// Run: node create-admin.js

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyDy4cef7XvSOQ0kI-geiBD_-1ZhQ7dlnNg",
  authDomain: "pw-missiontopper-d603d.firebaseapp.com",
  projectId: "pw-missiontopper-d603d",
  storageBucket: "pw-missiontopper-d603d.firebasestorage.app",
  messagingSenderId: "41342728127",
  appId: "1:41342728127:web:983b3e038dd59c6acc130a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const ADMIN_EMAIL = 'adityaghoghari01@gmail.com';
const ADMIN_PASSWORD = 'aditya-ghoghari1234';

async function createAdmin() {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('✅ Admin account created successfully!');
    console.log('Email:', userCredential.user.email);
    console.log('UID:', userCredential.user.uid);
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log('✅ Admin account already exists!');
      console.log('Email:', ADMIN_EMAIL);
      console.log('Password:', ADMIN_PASSWORD);
    } else {
      console.error('❌ Error creating admin:', error.message);
    }
    process.exit(1);
  }
}

createAdmin();
