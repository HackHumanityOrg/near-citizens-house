import { Account } from "@near-js/accounts"
import { KeyPair } from "@near-js/crypto"
import type { KeyPairString } from "@near-js/crypto"
import { KeyPairSigner } from "@near-js/signers"
import { JsonRpcProvider } from "@near-js/providers"
import { actionCreators } from "@near-js/transactions"

interface TestAccount {
  accountId: string
  publicKey: string
  privateKey: string // ed25519:... format
}

/**
 * Manages NEAR test subaccounts for E2E testing.
 *
 * Creates subaccounts under the parent account (from Doppler env vars)
 * and cleans them up after tests.
 */
export class NearAccountManager {
  private provider: JsonRpcProvider
  private parentAccountId: string
  private parentSigner: KeyPairSigner
  private createdAccounts: TestAccount[] = []

  constructor() {
    const networkId = process.env.NEXT_PUBLIC_NEAR_NETWORK || "testnet"
    const rpcUrl = networkId === "mainnet" ? "https://rpc.mainnet.near.org" : "https://rpc.testnet.near.org"

    this.provider = new JsonRpcProvider({ url: rpcUrl })

    // Initialize parent account from Doppler env vars
    const parentAccountId = process.env.NEAR_ACCOUNT_ID
    const parentPrivateKey = process.env.NEAR_PRIVATE_KEY

    if (!parentAccountId || !parentPrivateKey) {
      throw new Error("NEAR_ACCOUNT_ID and NEAR_PRIVATE_KEY environment variables are required")
    }

    this.parentAccountId = parentAccountId
    const parentKeyPair = KeyPair.fromString(parentPrivateKey as KeyPairString)
    this.parentSigner = new KeyPairSigner(parentKeyPair)
  }

  /**
   * Creates a new test subaccount with 0.1 NEAR initial balance.
   * Returns the account credentials for use in tests.
   */
  async createTestAccount(prefix = "e2e"): Promise<TestAccount> {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const subaccountId = `${prefix}-${timestamp}-${random}.${this.parentAccountId}`

    const keyPair = KeyPair.fromRandom("ed25519")
    const publicKey = keyPair.getPublicKey().toString()
    const privateKey = keyPair.toString()

    // Create parent account object
    const parentAccount = new Account(this.parentAccountId, this.provider, this.parentSigner)

    // Create subaccount with 0.1 NEAR (100000000000000000000000 yoctoNEAR)
    await parentAccount.createAccount(subaccountId, keyPair.getPublicKey(), BigInt("100000000000000000000000"))

    const account: TestAccount = { accountId: subaccountId, publicKey, privateKey }
    this.createdAccounts.push(account)

    return account
  }

  /**
   * Deletes a test subaccount and returns remaining balance to parent.
   */
  async deleteTestAccount(accountId: string): Promise<void> {
    const account = this.createdAccounts.find((a) => a.accountId === accountId)
    if (!account) {
      console.warn(`Account ${accountId} not found in created accounts list`)
      return
    }

    try {
      const keyPair = KeyPair.fromString(account.privateKey as KeyPairString)
      const signer = new KeyPairSigner(keyPair)
      const subaccount = new Account(accountId, this.provider, signer)

      // Delete account and send remaining balance back to parent
      await subaccount.signAndSendTransaction({
        receiverId: accountId,
        actions: [actionCreators.deleteAccount(this.parentAccountId)],
      })

      this.createdAccounts = this.createdAccounts.filter((a) => a.accountId !== accountId)
    } catch (error) {
      console.error(`Failed to delete account ${accountId}:`, error)
      throw error
    }
  }

  /**
   * Cleans up all created test accounts.
   * Call this in afterAll or test teardown.
   */
  async cleanupAll(): Promise<void> {
    const accountsToDelete = [...this.createdAccounts]
    for (const account of accountsToDelete) {
      try {
        await this.deleteTestAccount(account.accountId)
        console.log(`Deleted test account: ${account.accountId}`)
      } catch (e) {
        console.warn(`Failed to delete ${account.accountId}:`, e)
      }
    }
  }

  /**
   * Gets the list of created accounts (for debugging/verification).
   */
  getCreatedAccounts(): TestAccount[] {
    return [...this.createdAccounts]
  }
}
