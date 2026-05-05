// Quick script to create admin account in Firebase
// Run: node create-admin.js

const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBvOelr7XJ-MTYRUaxMDakTGpQcmEumZNs",
  authDomain: "pw-missiontopper.firebaseapp.com",
  projectId: "pw-missiontopper",
  storageBucket: "pw-missiontopper.firebasestorage.app",
  messagingSenderId: "255162339734",
  appId: "1:255162339734:web:f49f464c93c63bc280cdb7",
  measurementId: "G-5YX2GJKD6B"
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
