//! Mock verified-accounts contract for integration tests.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::store::IterableMap;
use near_sdk::{
    env, near, AccountId, BorshStorageKey, Gas, NearSchema, NearToken, PanicOnDefault, Promise,
    PromiseOrValue,
};
use serde::{Deserialize, Serialize};

#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone, Debug, NearSchema)]
#[borsh(crate = "near_sdk::borsh")]
pub struct VerificationSummary {
    pub near_account_id: AccountId,
    pub verified_at: u64,
}

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Verified,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct MockVerifiedAccounts {
    verified: IterableMap<AccountId, VerificationSummary>,
    fail_get_verification: bool,
    delay_get_verification: bool,
}

#[near]
impl MockVerifiedAccounts {
    #[init]
    pub fn new(fail_get_verification: bool, delay_get_verification: bool) -> Self {
        Self {
            verified: IterableMap::new(StorageKey::Verified),
            fail_get_verification,
            delay_get_verification,
        }
    }

    pub fn add_verified(&mut self, account_id: AccountId, verified_at: u64) {
        let summary = VerificationSummary {
            near_account_id: account_id.clone(),
            verified_at,
        };
        self.verified.insert(account_id, summary);
    }

    pub fn set_fail_get_verification(&mut self, fail: bool) {
        self.fail_get_verification = fail;
    }

    pub fn set_delay_get_verification(&mut self, delay: bool) {
        self.delay_get_verification = delay;
    }

    pub fn get_verified_count(&self) -> PromiseOrValue<u32> {
        if self.delay_get_verification {
            let promise = Promise::new(env::current_account_id()).function_call(
                "get_verified_count_delayed".to_string(),
                Vec::new(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
            );
            return PromiseOrValue::Promise(promise);
        }
        PromiseOrValue::Value(self.verified.len())
    }

    pub fn get_verification(
        &self,
        account_id: AccountId,
    ) -> PromiseOrValue<Option<VerificationSummary>> {
        if self.fail_get_verification {
            near_sdk::env::panic_str("mock get_verification failure");
        }
        if self.delay_get_verification {
            let args = near_sdk::serde_json::to_vec(&near_sdk::serde_json::json!({
                "account_id": account_id
            }))
            .expect("serialize delayed verification args");
            let promise = Promise::new(env::current_account_id()).function_call(
                "get_verification_delayed".to_string(),
                args,
                NearToken::from_yoctonear(0),
                Gas::from_tgas(5),
            );
            return PromiseOrValue::Promise(promise);
        }
        PromiseOrValue::Value(self.verified.get(&account_id).cloned())
    }

    pub fn get_verification_delayed(&self, account_id: AccountId) -> Option<VerificationSummary> {
        self.verified.get(&account_id).cloned()
    }

    pub fn get_verified_count_delayed(&self) -> u32 {
        self.verified.len()
    }
}
