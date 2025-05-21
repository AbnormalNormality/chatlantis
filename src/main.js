const forceUpdateButton = document.getElementById("forceUpdate");

async function clearCache() {
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((name) => caches.delete(name)));
  }
  window.location.reload();
}

function handleKeyRelease(event) {
  if (event.altKey && event.key == "r") {
    clearCache();
  }
}

document.addEventListener("keyup", handleKeyRelease);
forceUpdateButton.addEventListener("click", () => {
  clearCache();
});

const allowNotifications = document.getElementById("enableNotifications");

if (!("Notification" in window)) {
  console.warn("This browser does not support desktop notifications.");
} else if (Notification.permission !== "granted") {
  allowNotifications.style.display = "inline-block";
}

allowNotifications.addEventListener("click", () => {
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") {
      console.info("Notifications enabled!");
      allowNotifications.style.display = "none";
    } else {
      console.info("Notifications denied.");
    }
  });
});
