import {
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
} from "./firebase-backend.js";

const signedInDiv = document.getElementById("signedIn");
const signedOutDiv = document.getElementById("signedOut");
const messagesDiv = document.getElementById("messages");

const siGoogleButton = document.getElementById("signInGoogle");
const signOutButton = document.getElementById("signOut");
const sendMessageButton = document.getElementById("sendMessage");
const updateNicknameButton = document.getElementById("updateNickname");

const messageInput = document.getElementById("messageInput");
const nicknameInput = document.getElementById("nicknameInput");

let unsubscribeMessages = null;
let sending = false;
let renaming = false;
let updating = false;
const nicknameCache = {};

siGoogleButton.addEventListener("click", async () => {
  siGoogleButton.disabled = true;
  await signInWith("google");
  siGoogleButton.disabled = false;
});
signOutButton.addEventListener("click", async () => {
  signOutButton.disabled = true;
  await signOutUser();
  signOutButton.disabled = false;
});

function signedIn() {
  signedInDiv.style.display = "flex";
  signedOutDiv.style.display = "none";
  messageInput.disabled = false;
  sendMessageButton.disabled = false;
}

function signedOut() {
  signedInDiv.style.display = "none";
  signedOutDiv.style.display = "flex";
  messageInput.disabled = true;
  sendMessageButton.disabled = true;
}

async function handleUser(user) {
  if (!user) {
    signedOut();
    return;
  }

  signedIn();

  const userData = await getUserData(user.uid);

  nicknameInput.placeholder = userData.nickname;

  // if (unsubscribeMessages) unsubscribeMessages();
  // unsubscribeMessages = listenMessages(displayMessages);
}

async function displayMessages(messages) {
  if (updating) return;
  updating = true;

  const nearBottomThreshold = 10;
  const isAtBottom =
    messagesDiv.scrollHeight -
      messagesDiv.scrollTop -
      messagesDiv.clientHeight <
    nearBottomThreshold;

  const sortedMessages = [...messages].slice(-50);

  const authorIds = [...new Set(sortedMessages.map((msg) => msg.authorid))];

  const userDataMap = {};
  await Promise.all(
    authorIds.map(async (uid) => {
      const dbNickname = (await getUserData(uid))?.nickname || "Anonymous";
      const cachedNickname = nicknameCache[uid];

      if (cachedNickname !== dbNickname) nicknameCache[uid] = dbNickname;
      userDataMap[uid] = dbNickname;
    })
  );

  const fragment = document.createDocumentFragment();

  for (const message of sortedMessages) {
    const timestampDate =
      message.timestamp instanceof Date ? message.timestamp : null;

    const timestampStr = timestampDate
      ? (() => {
          const date = timestampDate;
          const hours = date.getHours().toString().padStart(2, "0");
          const minutes = date.getMinutes().toString().padStart(2, "0");
          const day = date.getDate().toString().padStart(2, "0");
          const month = (date.getMonth() + 1).toString().padStart(2, "0");
          const year = date.getFullYear();

          return `${hours}:${minutes} ${day}-${month}-${year}`;
        })()
      : "";

    const nickname = userDataMap[message.authorid] || "Anonymous";

    const newMessageDiv = document.createElement("div");
    newMessageDiv.classList.add("message");

    const messageHeader = document.createElement("div");
    messageHeader.classList.add("message-header");

    const messageAuthor = document.createElement("div");
    messageAuthor.classList.add("message-author");
    messageAuthor.textContent = nickname;
    messageAuthor.dataset.authorid = message.authorid;
    messageAuthor.dataset.nickname = nickname;

    const messageTimestamp = document.createElement("div");
    messageTimestamp.classList.add("message-timestamp");
    messageTimestamp.textContent = timestampStr;
    if (timestampDate) {
      messageTimestamp.dataset.timestamp = timestampDate.toISOString();
    }

    const messageContent = document.createElement("div");
    messageContent.classList.add("message-content");
    messageContent.textContent = message.content;

    messageHeader.appendChild(messageAuthor);
    messageHeader.appendChild(messageTimestamp);
    newMessageDiv.appendChild(messageHeader);
    newMessageDiv.appendChild(messageContent);
    fragment.appendChild(newMessageDiv);
  }

  messagesDiv.textContent = "";
  messagesDiv.appendChild(fragment);

  if (isAtBottom) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  async function correct() {
    const authorEls = document.querySelectorAll(".message-author");
    await Promise.all(
      Array.from(authorEls).map(async (el) => {
        const uid = el.dataset.authorid;
        const dbNickname = (await getUserData(uid))?.nickname || "Anonymous";
        if (nicknameCache[uid] !== dbNickname) {
          nicknameCache[uid] = dbNickname;
        }
        if (el.textContent !== dbNickname) {
          el.textContent = dbNickname;
        }
      })
    );

    const timestampEls = document.querySelectorAll(".message-timestamp");
    for (const el of timestampEls) {
      const iso = el.dataset.timestamp;
      if (!iso) continue;

      const date = new Date(iso);
      const formatted = (() => {
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();

        return `${hours}:${minutes} ${day}-${month}-${year}`;
      })();

      if (el.textContent !== formatted) {
        el.textContent = formatted;
      }
    }
  }

  await correct();

  updating = false;
}

async function sendMessageFromInput() {
  const content = messageInput.value.trim();

  if (!getUser() || !content || sending) return;

  sending = true;

  await sendMessage(content);

  messageInput.value = "";
  messageInput.focus();
  sending = false;
}

sendMessageButton.addEventListener("click", async () => {
  await sendMessageFromInput();
});

messageInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await sendMessageFromInput();
  }
});

async function setNicknameFromInput() {
  const user = getUser();
  const newName = nicknameInput.value.trim();

  if (!user || !newName || renaming) return;

  renaming = true;

  await setUserData(user.uid, { nickname: newName });
  nicknameInput.placeholder = newName;
  nicknameInput.value = "";
  await triggerUpdate();

  renaming = false;
}

nicknameInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await setNicknameFromInput();
  }
});

async function forcedUpdate(messages) {
  await displayMessages(messages);
}

updateNicknameButton.addEventListener("click", async () => {
  await setNicknameFromInput();
});

listenToUpdateTrigger(forcedUpdate);
unsubscribeMessages = listenMessages(displayMessages);

onAuthStateChange(handleUser);
