import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import {
  getFirestore,
  onSnapshot,
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyANE-4EiHNFKLH1zvLuOBHx4-f_cYjYgOM",
  authDomain: "chatlantis-70da1.firebaseapp.com",
  projectId: "chatlantis-70da1",
  storageBucket: "chatlantis-70da1.firebasestorage.app",
  messagingSenderId: "659883885342",
  appId: "1:659883885342:web:385b1f22a211080b5b3f0f",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const messagesCol = collection(db, "messages");
const messagesQuery = query(messagesCol, orderBy("timestamp"));

const googleProvider = new GoogleAuthProvider();

async function signInWith(method) {
  if (method == "google") {
    await signInWithPopup(auth, googleProvider);
  }
}

async function onAuthStateChange(callback) {
  await onAuthStateChanged(auth, handleUser);
  return onAuthStateChanged(auth, callback);
}

async function signOutUser() {
  await signOut(auth);
}

function listenMessages(callback) {
  return onSnapshot(messagesQuery, () => {
    callback();
  });
}

async function sendMessage(content) {
  const user = getUser();

  await addDoc(messagesCol, {
    authorid: user.uid,
    content: content,
    timestamp: serverTimestamp(),
  });
}

function getUser() {
  return auth.currentUser;
}

async function getUserData(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  return userDoc.exists() ? userDoc.data() : null;
}

async function setUserData(uid, newData) {
  await setDoc(doc(db, "users", uid), newData, { merge: true });
}

async function handleUser(user) {
  if (!user) return;

  const userData = (await getUserData(user.uid)) || {};

  if (!userData.nickname) {
    userData.nickname = "Anonymous";
  }

  setUserData(user.uid, userData);
}

function listenToUpdateTrigger(callback) {
  async function fetchMessagesAndRunCallback() {
    callback();
  }

  const updateDocRef = doc(db, "dev", "update");
  return onSnapshot(updateDocRef, () => {
    fetchMessagesAndRunCallback();
  });
}

async function triggerUpdate() {
  const updateDocRef = doc(db, "dev", "update");
  await setDoc(updateDocRef, {
    updatedAt: serverTimestamp(),
  });
}

async function getMessages() {
  const snapshot = await getDocs(messagesQuery);
  const messages = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    timestamp: doc.data().timestamp?.toDate(),
  }));
  return messages;
}

async function deleteMessage(id) {
  const messageDocRef = doc(db, "messages", id);
  await deleteDoc(messageDocRef);
}

function parseMessageContent(message, userDataMap) {
  let content = message.content;

  content = content.replace(
    /(?<!["\w])\$name(?!\w)/g,
    userDataMap[message.authorid].nickname
  );

  return content;
}

export {
  signInWith,
  onAuthStateChange,
  signOutUser,
  listenMessages,
  sendMessage,
  getUser,
  getUserData,
  setUserData,
  listenToUpdateTrigger,
  triggerUpdate,
  getMessages,
  deleteMessage,
  parseMessageContent,
};
