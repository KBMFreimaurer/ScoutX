export function createTeamRouteBaseContext(input) {
  return {
    url: input.url,
    origin: input.origin,
    requestId: input.requestId,
    clientIp: input.clientIp,
    requestLogger: input.requestLogger,
    state: input.state,
    readBody: input.readBody,
    sendJson: input.sendJson,
    persistTeamState: input.persistTeamState,
    applyTeamStateMutation: input.applyTeamStateMutation,
    runTeamWriteIdempotent: input.runTeamWriteIdempotent,
    findAccount: input.findAccount,
    createTeamSessionForAccount: input.createTeamSessionForAccount,
    createSessionCookie: input.createSessionCookie,
    buildTeamStatePayload: input.buildTeamStatePayload,
  };
}
