export const LogScope = {
  VERIFICATION: "verification",
  API: "api",
  SERVER_ACTION: "server_action",
  REDIS: "redis",
  ANALYTICS: "analytics",
  INSTRUMENTATION: "instrumentation",
  E2E: "e2e",
} as const

export type LogScope = (typeof LogScope)[keyof typeof LogScope]

export const OpRedis = {
  CONNECT: "redis.connect",
} as const

export const OpVerification = {
  ACCESS_KEY_CHECK: "verification.access_key_check",
  CHECK_STATUS: "verification.check_status",
  CALLBACK_INIT: "verification.callback.init",
  CALLBACK_POLL: "verification.callback.poll",
  CALLBACK_RESULT: "verification.callback.result",
  START_CHECK_EXISTING: "verification.start.check_existing",
  START_ATTESTATION_STATUS: "verification.start.attestation_status",
  START_CONNECT_WALLET: "verification.start.connect_wallet",
  START_SIGN_MESSAGE: "verification.start.sign_message",
  STEP2_CONFIRM_STATUS: "verification.step2.confirm_status",
  STEP2_FINALIZE: "verification.step2.finalize",
  NONCE_CHECK: "verification.nonce_check",
  NONCE_RESERVE: "verification.nonce_reserve",
  SESSION_CREATE: "verification.session_create",
  SESSION_GET: "verification.session_get",
  SESSION_UPDATE: "verification.session_update",
  SESSION_DELETE: "verification.session_delete",
  ANALYTICS: "verification.analytics",
  ZK_VERIFY: "verification.zk_verify",
  VERIFY_ACCOUNT: "verification.verify_account",
} as const

export const OpApi = {
  VERIFICATION_VERIFY: "api.verification.verify",
  VERIFICATION_STATUS: "api.verification.status",
} as const

export const OpServerAction = {
  CITIZENS_GET_VERIFICATIONS_WITH_STATUS: "server_action.citizens.getVerificationsWithStatus",
  CITIZENS_CHECK_IS_VERIFIED: "server_action.citizens.checkIsVerified",
} as const

export const OpInstrumentation = {
  INIT: "instrumentation.init",
} as const

export const OpE2E = {
  MOBILE_DEEPLINK_FLOW: "e2e.mobile_deeplink",
  DESKTOP_QR_FLOW: "e2e.desktop_qr",
  GLOBAL_SETUP: "e2e.global_setup",
  NEAR_ACCOUNT_MANAGER: "e2e.near_account_manager",
  SELF_WEBSOCKET_MOCK: "e2e.self_websocket_mock",
  METEOR_WALLET: "e2e.meteor_wallet",
  DYNAMIC_WALLET_FIXTURE: "e2e.dynamic_wallet_fixture",
  CLEANUP_ORPHAN_ACCOUNTS: "e2e.cleanup_orphan_accounts",
} as const

export const Op = {
  REDIS: OpRedis,
  VERIFICATION: OpVerification,
  API: OpApi,
  SERVER_ACTION: OpServerAction,
  INSTRUMENTATION: OpInstrumentation,
  E2E: OpE2E,
} as const

type OperationMap = typeof Op
export type LogOperation = {
  [K in keyof OperationMap]: OperationMap[K][keyof OperationMap[K]]
}[keyof OperationMap]
export type ApiOperation = (typeof OpApi)[keyof typeof OpApi]
export type ServerActionOperation = (typeof OpServerAction)[keyof typeof OpServerAction]
export type E2EOperation = (typeof OpE2E)[keyof typeof OpE2E]
