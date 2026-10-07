const WMS_SESSION_KEY = "wmsUser";

async function loginUser(event) {
  event.preventDefault();
  const message = document.getElementById("loginMessage");
  message.textContent = "Memproses...";

  try {
    const result = await apiGet("login", {
      username: document.getElementById("username").value.trim(),
      password: document.getElementById("password").value
    });

    if (!result.success) throw new Error(result.message || "Login gagal.");

    sessionStorage.setItem(WMS_SESSION_KEY, JSON.stringify(result.user));
    showApp(result.user);
  } catch (e) {
    message.textContent = e.message;
  }
}

function showApp(user) {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("appPage").classList.remove("hidden");
  document.getElementById("userInfo").textContent =
    `${user.FullName || user.Username} · ${user.Role || ""}`;
}

function logoutUser() {
  sessionStorage.removeItem(WMS_SESSION_KEY);
  document.getElementById("appPage").classList.add("hidden");
  document.getElementById("loginPage").classList.remove("hidden");
  document.getElementById("password").value = "";
}

document.getElementById("loginForm").addEventListener("submit", loginUser);

(function restoreSession() {
  const raw = sessionStorage.getItem(WMS_SESSION_KEY);
  if (!raw) return;
  try { showApp(JSON.parse(raw)); } catch (_) { sessionStorage.removeItem(WMS_SESSION_KEY); }
})();
