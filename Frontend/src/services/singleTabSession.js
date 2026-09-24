const TAB_ID_KEY = "devflow_tab_id";
const ACTIVE_TAB_KEY = "devflow_active_tab";
const HEARTBEAT_INTERVAL = 5000;
const STALE_AFTER = 15000;

let heartbeatTimer = null;
let channel = null;

function getTabId() {
  let tabId = sessionStorage.getItem(TAB_ID_KEY);
  if (!tabId) {
    tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(TAB_ID_KEY, tabId);
  }
  return tabId;
}

function readLock() {
  try {
    const value = localStorage.getItem(ACTIVE_TAB_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Unable to read DevFlow tab lock:", error);
    return null;
  }
}

function isFresh(lock) {
  return Boolean(lock?.tabId && Number.isFinite(lock.lastSeen) &&
    Date.now() - lock.lastSeen < STALE_AFTER);
}

function announce(type) {
  if (!channel) {
    channel = typeof BroadcastChannel === "function"
      ? new BroadcastChannel("devflow_single_tab")
      : null;
  }
  channel?.postMessage({ type });
}

export function hasActiveTabLock() {
  const lock = readLock();
  return isFresh(lock) && lock.tabId !== getTabId();
}

export function claimTabLock(accountId) {
  const tabId = getTabId();
  const current = readLock();
  if (isFresh(current) && current.tabId !== tabId) return false;

  const lock = {
    tabId,
    accountId: String(accountId),
    lastSeen: Date.now(),
  };
  localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(lock));
  const claimed = readLock();
  if (claimed?.tabId !== tabId) return false;

  announce("claimed");
  startHeartbeat(accountId);
  return true;
}

export function releaseTabLock() {
  const current = readLock();
  if (current?.tabId === getTabId()) {
    localStorage.removeItem(ACTIVE_TAB_KEY);
    announce("released");
  }
  stopHeartbeat();
}

export function startHeartbeat(accountId) {
  stopHeartbeat();
  heartbeatTimer = window.setInterval(() => {
    const current = readLock();
    if (current?.tabId !== getTabId()) {
      stopHeartbeat();
      return;
    }
    localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify({
      tabId: getTabId(),
      accountId: String(accountId),
      lastSeen: Date.now(),
    }));
  }, HEARTBEAT_INTERVAL);
}

export function stopHeartbeat() {
  if (heartbeatTimer !== null) {
    window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function subscribeToTabLock(callback) {
  const handleChange = () => callback();
  const handleMessage = () => callback();
  window.addEventListener("storage", handleChange);
  if (typeof BroadcastChannel === "function") {
    if (!channel) channel = new BroadcastChannel("devflow_single_tab");
    channel.addEventListener("message", handleMessage);
  }
  return () => {
    window.removeEventListener("storage", handleChange);
    channel?.removeEventListener("message", handleMessage);
  };
}

export { ACTIVE_TAB_KEY, HEARTBEAT_INTERVAL, STALE_AFTER, TAB_ID_KEY };
