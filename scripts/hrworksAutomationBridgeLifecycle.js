export function isRecoverableHrworksSessionError(error) {
  const message = String(error?.message || error || "");
  return /Target page, context or browser has been closed|Browser has been closed|has been closed/i.test(message);
}

export function createHrworksBridgeSessionManager({ createSession }) {
  let sessionPromise = null;

  async function getSession() {
    if (!sessionPromise) {
      sessionPromise = Promise.resolve().then(() => createSession());
    }
    return sessionPromise;
  }

  function resetSession() {
    sessionPromise = null;
  }

  async function withSession(task) {
    const firstSession = await getSession();
    try {
      return await task(firstSession);
    } catch (error) {
      if (!isRecoverableHrworksSessionError(error)) {
        throw error;
      }
      resetSession();
      const freshSession = await getSession();
      return task(freshSession);
    }
  }

  return {
    getSession,
    resetSession,
    withSession,
  };
}
