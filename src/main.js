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
