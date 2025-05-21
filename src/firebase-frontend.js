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
  getMessages,
  deleteMessage,
  parseMessageContent,
  parseSendContent,
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

  if (!userData.nickname) {
    userData.nickname == "Anonymous";
  }
  nicknameInput.placeholder = userData.nickname;
}

async function displayMessages() {
  if (updating) return;
  updating = true;

  const nearBottomThreshold = 10;
  const isAtBottom =
    messagesDiv.scrollHeight -
      messagesDiv.scrollTop -
      messagesDiv.clientHeight <
    nearBottomThreshold;

  const messages = await getMessages();
  const sortedMessages = [...messages].slice(-50);

  const authorIds = [...new Set(sortedMessages.map((msg) => msg.authorid))];

  const userDataMap = {};
  await Promise.all(
    authorIds.map(async (uid) => {
      const userData = (await getUserData(uid)) || { nickname: "Anonymous" };
      const cachedNickname = nicknameCache[uid];

      if (cachedNickname !== userData.nickname) {
        nicknameCache[uid] = userData.nickname;
      }
      userDataMap[uid] = userData;
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

    const nickname = userDataMap[message.authorid].nickname || "Anonymous";

    const newMessageDiv = document.createElement("div");
    newMessageDiv.classList.add("message");

    const messageHeader = document.createElement("div");
    messageHeader.classList.add("message-header");

    const messageAuthor = document.createElement("div");
    messageAuthor.classList.add("message-author");
    messageAuthor.textContent = nickname;

    const messageSubheader = document.createElement("div");
    messageSubheader.classList.add("message-subheader");

    const messageTimestamp = document.createElement("div");
    messageTimestamp.classList.add("message-timestamp");
    messageTimestamp.textContent = timestampStr ? timestampStr : "Soon-ish";

    const messageActions = document.createElement("div");
    messageActions.classList.add("message-actions");

    if (message.authorid == getUser().uid || getUser().dev) {
      const deleteMessageButton = document.createElement("button");
      deleteMessageButton.classList.add("message-delete-button");
      deleteMessageButton.textContent = "Delete";

      deleteMessageButton.addEventListener("click", async () => {
        deleteMessageButton.disabled = true;
        await deleteMessage(message.id);
      });

      messageActions.appendChild(deleteMessageButton);
    }

    const messageContent = document.createElement("div");
    messageContent.classList.add("message-content");
    messageContent.innerHTML = parseMessageContent(message, userDataMap);

    messageSubheader.appendChild(messageTimestamp);
    messageSubheader.appendChild(messageActions);
    messageHeader.appendChild(messageAuthor);
    messageHeader.appendChild(messageSubheader);
    newMessageDiv.appendChild(messageHeader);
    newMessageDiv.appendChild(messageContent);
    fragment.appendChild(newMessageDiv);
  }

  messagesDiv.textContent = "";
  messagesDiv.appendChild(fragment);

  if (isAtBottom) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  updating = false;
}

async function sendMessageFromInput() {
  let content = messageInput.value.trim();
  content = parseSendContent(content);

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
  updateNicknameButton.disabled = true;

  await setUserData(user.uid, { nickname: newName });
  nicknameInput.placeholder = newName;
  nicknameInput.value = "";

  renaming = false;
  updateNicknameButton.disabled = false;

  await triggerUpdate();
}

nicknameInput.addEventListener("keydown", async (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    await setNicknameFromInput();
  }
});

async function forcedUpdate() {
  await displayMessages();
}

updateNicknameButton.addEventListener("click", async () => {
  await setNicknameFromInput();
});

listenToUpdateTrigger(forcedUpdate);
listenMessages(displayMessages);

onAuthStateChange(handleUser);
