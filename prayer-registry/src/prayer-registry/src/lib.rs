#![cfg_attr(not(feature = "std"), no_std, no_main)]

extern crate fluentbase_sdk;

use core::cmp::max;
use fluentbase_sdk::{
    basic_entrypoint,
    derive::{constructor, router, Contract, Storage},
    storage::{StorageAddress, StorageMap, StorageU16, StorageU32, StorageU64, StorageU8, StorageU256},
    Address, ContextReader, SharedAPI, B256, U256,
};

#[cfg(not(test))]
extern crate alloc;
#[cfg(not(test))]
use alloc::vec::Vec;
#[cfg(not(test))]
use fluentbase_sdk::{bytes::BytesMut, codec::SolidityABI};
#[cfg(not(test))]
use fluentbase_sdk::ExitCode;

const DAY_SECONDS: u64 = 86_400;
const MAX_SCORE: u16 = 10_000;

/// selector for sync(address,uint256,uint256,uint256,uint256,uint256,bytes32)
#[cfg(not(test))]
const SYNC_SELECTOR: [u8; 4] = [0x3f, 0x10, 0x4d, 0xad];

const MILESTONES: &[(u32, u32)] = &[
    (7, 1 << 0),
    (14, 1 << 1),
    (21, 1 << 2),
    (28, 1 << 3),
    (60, 1 << 4),
    (90, 1 << 5),
];

#[derive(Storage)]
struct UserRecord {
    streak:        StorageU32,
    longest:       StorageU32,
    total:         StorageU32,
    milestones:    StorageU32,
    last_check_in: StorageU64,
    score:         StorageU16,
    label:         StorageU8,
    prayer_hash:   StorageU256,
}

#[derive(Default, Clone)]
struct UserSnapshot {
    streak:        u32,
    longest:       u32,
    total:         u32,
    milestones:    u32,
    last_check_in: u64,
    score:         u16,
    label:         u8,
    prayer_hash:   B256,
}

#[derive(Contract)]
struct PrayerRegistry<SDK> {
    sdk:    SDK,
    owner:  StorageAddress,
    mirror: StorageAddress,
    users:  StorageMap<Address, UserRecord>,
}

pub trait RegistryAPI {
    fn check_in(&mut self, prayer_hash: B256, score: u16, label: u8)
        -> (U256, U256, U256, U256, U256, B256, U256, U256);

    fn get_user(&self, user: Address)
        -> (U256, U256, U256, U256, U256, B256, U256, U256);

    fn next_allowed_at(&self, user: Address) -> U256;

    fn mirror(&self) -> Address;
    fn evm_alias(&self) -> Address;
    fn owner(&self) -> Address;

    fn set_mirror(&mut self, new_mirror: Address);
}

#[constructor(mode = "solidity")]
impl<SDK: SharedAPI> PrayerRegistry<SDK> {
    pub fn constructor(&mut self, mirror: Address) {
        let owner = self.sdk.context().contract_caller();
        self.owner_accessor().set(&mut self.sdk, owner);
        self.mirror_accessor().set(&mut self.sdk, mirror);
    }
}

#[router(mode = "solidity")]
impl<SDK: SharedAPI> RegistryAPI for PrayerRegistry<SDK> {
    #[function_id("checkIn(bytes32,uint16,uint8)")]
    fn check_in(
        &mut self,
        prayer_hash: B256,
        score: u16,
        label: u8,
    ) -> (U256, U256, U256, U256, U256, B256, U256, U256) {
        let snapshot = self.handle_check_in(prayer_hash, score, label);
        (
            U256::from(snapshot.streak),
            U256::from(snapshot.longest),
            U256::from(snapshot.total),
            U256::from(snapshot.milestones),
            U256::from(snapshot.score),
            snapshot.prayer_hash,
            U256::from(snapshot.label),
            U256::from(snapshot.last_check_in),
        )
    }

    #[function_id("getUser(address)")]
    fn get_user(&self, user: Address) -> (U256, U256, U256, U256, U256, B256, U256, U256) {
        let snapshot = self.read_snapshot(user);
        (
            U256::from(snapshot.streak),
            U256::from(snapshot.longest),
            U256::from(snapshot.total),
            U256::from(snapshot.milestones),
            U256::from(snapshot.score),
            snapshot.prayer_hash,
            U256::from(snapshot.label),
            U256::from(snapshot.last_check_in),
        )
    }

    #[function_id("nextAllowedAt(address)")]
    fn next_allowed_at(&self, user: Address) -> U256 {
        let last = self
            .users_accessor()
            .entry(user)
            .last_check_in_accessor()
            .get(&self.sdk);
        let next = if last == 0 { 0 } else { last.saturating_add(DAY_SECONDS) };
        U256::from(next)
    }

    #[function_id("mirror()")]
    fn mirror(&self) -> Address {
        self.mirror_accessor().get(&self.sdk)
    }

    #[function_id("evmAlias()")]
    fn evm_alias(&self) -> Address {
        self.sdk.context().contract_bytecode_address()
    }

    #[function_id("owner()")]
    fn owner(&self) -> Address {
        self.owner_accessor().get(&self.sdk)
    }

    #[function_id("setMirror(address)")]
    fn set_mirror(&mut self, new_mirror: Address) {
        self.assert_owner();
        self.mirror_accessor().set(&mut self.sdk, new_mirror);
    }
}

impl<SDK: SharedAPI> PrayerRegistry<SDK> {
    fn assert_owner(&mut self) {
        let caller = self.sdk.context().contract_caller();
        let owner  = self.owner_accessor().get(&self.sdk);
        if caller != owner {
            self.sdk.evm_panic("not owner");
        }
    }

    fn handle_check_in(&mut self, prayer_hash: B256, score: u16, label: u8) -> UserSnapshot {
        if score > MAX_SCORE {
            self.sdk.evm_panic("score too large");
        }

        let caller = self.sdk.context().contract_caller();
        let now    = self.sdk.context().block_timestamp();
        let user   = self.users_accessor().entry(caller);

        let previous_ts = user.last_check_in_accessor().get(&self.sdk);
        if previous_ts != 0 && now < previous_ts.saturating_add(DAY_SECONDS) {
            self.sdk.evm_panic("already checked today");
        }

        let previous_streak  = user.streak_accessor().get(&self.sdk);
        let previous_total   = user.total_accessor().get(&self.sdk);
        let previous_longest = user.longest_accessor().get(&self.sdk);
        let mut milestones   = user.milestones_accessor().get(&self.sdk);

        let streak = if previous_ts == 0 {
            1
        } else if now < previous_ts.saturating_add(DAY_SECONDS * 2) {
            previous_streak.checked_add(1).unwrap_or_else(|| self.evm_panic("streak overflow"))
        } else {
            1
        };

        let total   = previous_total.checked_add(1).unwrap_or_else(|| self.evm_panic("total overflow"));
        let longest = max(previous_longest, streak);

        for (threshold, bit) in MILESTONES {
            if streak == *threshold {
                milestones |= *bit;
            }
        }

        user.streak_accessor().set(&mut self.sdk, streak);
        user.longest_accessor().set(&mut self.sdk, longest);
        user.total_accessor().set(&mut self.sdk, total);
        user.milestones_accessor().set(&mut self.sdk, milestones);
        user.last_check_in_accessor().set(&mut self.sdk, now);
        user.score_accessor().set(&mut self.sdk, score);
        user.label_accessor().set(&mut self.sdk, label);
        let prayer_hash_word = U256::from_be_bytes(prayer_hash.0);
        user.prayer_hash_accessor().set(&mut self.sdk, prayer_hash_word);

        self.sync_mirror(caller, streak, longest, total, milestones, score, prayer_hash);

        UserSnapshot { streak, longest, total, milestones, last_check_in: now, score, label, prayer_hash }
    }

    fn read_snapshot(&self, user: Address) -> UserSnapshot {
        let record = self.users_accessor().entry(user);
        UserSnapshot {
            streak:        record.streak_accessor().get(&self.sdk),
            longest:       record.longest_accessor().get(&self.sdk),
            total:         record.total_accessor().get(&self.sdk),
            milestones:    record.milestones_accessor().get(&self.sdk),
            last_check_in: record.last_check_in_accessor().get(&self.sdk),
            score:         record.score_accessor().get(&self.sdk),
            label:         record.label_accessor().get(&self.sdk),
            prayer_hash:   B256::from(record.prayer_hash_accessor().get(&self.sdk)),
        }
    }

fn sync_mirror(
    &mut self,
    user: Address,
    streak: u32,
    longest: u32,
    total: u32,
    milestones: u32,
    score: u16,
    prayer_hash: B256,
) {
    let mirror = self.mirror_accessor().get(&self.sdk);
    if mirror == Address::ZERO {
        self.sdk.evm_panic("mirror not set");
    }

    // no external call in tests
    #[cfg(test)]
    {
        let _ = (user, streak, longest, total, milestones, score, prayer_hash, mirror);
        return;
    }

    // do the real EVM call on-chain
    #[cfg(not(test))]
    {
        // let the mirror consume remaining gas (no hard cap)
        let payload = encode_sync_payload(
            user, streak, longest, total, milestones, score, prayer_hash,
        );

        // pass None for unlimited gas
        let resp = self.sdk.call(mirror, U256::ZERO, &payload, None);

        if !resp.status.is_ok() {
            // forward revert data from PrayerMirror (e.g., NotAuthorized/whatever)
            if !resp.data.is_empty() {
                self.sdk.write(resp.data.as_ref());
            }
            self.sdk.native_exit(ExitCode::Panic);
        }
    }
}

fn evm_panic(&mut self, msg: &str) -> ! {
    self.sdk.evm_panic(msg)
}
}

#[cfg(not(test))]
fn encode_sync_payload(
    user: Address,
    streak: u32,
    longest: u32,
    total: u32,
    milestones: u32,
    score: u16,
    prayer_hash: B256,
) -> Vec<u8> {
    let args = (
        user,
        U256::from(streak),
        U256::from(longest),
        U256::from(total),
        U256::from(milestones),
        U256::from(score),
        prayer_hash,
    );
    let mut encoded = BytesMut::new();
    SolidityABI::<(Address, U256, U256, U256, U256, U256, B256)>::encode(&args, &mut encoded, 0)
        .expect("encode failed");
    let mut payload = Vec::with_capacity(4 + encoded.len());
    payload.extend_from_slice(&SYNC_SELECTOR);
    let bytes = encoded.freeze();
    payload.extend_from_slice(&bytes);
    payload
}

basic_entrypoint!(PrayerRegistry);

#[cfg(test)]
mod tests {
    use super::*;
    use fluentbase_sdk::{address, BlockContextV1, ContractContextV1, SharedContextInputV1, TxContextV1};
    use fluentbase_testing::HostTestingContext;

    fn hash(value: u64) -> B256 { B256::from(U256::from(value)) }

    fn context(caller: Address, contract: Address, timestamp: u64) -> SharedContextInputV1 {
        SharedContextInputV1 {
            block: BlockContextV1 { timestamp, ..Default::default() },
            tx: TxContextV1 { origin: caller, ..Default::default() },
            contract: ContractContextV1 { address: contract, caller, ..Default::default() },
        }
    }

    fn build_registry(owner: Address, mirror: Address, contract: Address, timestamp: u64) -> PrayerRegistry<HostTestingContext> {
        let ctx = context(owner, contract, timestamp);
        let sdk = HostTestingContext::default().with_shared_context_input(ctx.clone());
        let mut registry = PrayerRegistry::new(sdk.clone());
        registry.constructor(mirror);
        registry
    }

    fn advance(registry: &mut PrayerRegistry<HostTestingContext>, caller: Address, contract: Address, timestamp: u64) {
        let ctx = context(caller, contract, timestamp);
        registry.sdk = registry.sdk.clone().with_shared_context_input(ctx);
    }

    #[test]
    fn first_check_in_initializes_state() {
        let owner = address!("0x1111111111111111111111111111111111111111");
        let mirror = address!("0x2222222222222222222222222222222222222222");
        let contract = address!("0x3333333333333333333333333333333333333333");
        let mut registry = build_registry(owner, mirror, contract, 1_700_000_000);

        advance(&mut registry, owner, contract, 1_700_000_000);
        let snapshot = registry.handle_check_in(hash(1), 72, 3);

        assert_eq!(snapshot.streak, 1);
        assert_eq!(snapshot.total, 1);
        assert_eq!(snapshot.longest, 1);
        assert_eq!(snapshot.milestones, 0);
        assert_eq!(snapshot.score, 72);
        assert_eq!(snapshot.label, 3);

        let stored = registry.read_snapshot(owner);
        assert_eq!(stored.streak, 1);
        assert_eq!(stored.total, 1);
        assert_eq!(stored.last_check_in, 1_700_000_000);
    }

    #[test]
    fn second_day_increments_streak() {
        let user = address!("0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
        let mirror = address!("0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB");
        let contract = address!("0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC");

        let mut registry = build_registry(user, mirror, contract, 1_700_000_000);

        advance(&mut registry, user, contract, 1_700_000_000);
        registry.handle_check_in(hash(42), 10, 1);

        advance(&mut registry, user, contract, 1_700_000_000 + DAY_SECONDS + 10);
        let snapshot = registry.handle_check_in(hash(77), 8, 2);
        assert_eq!(snapshot.streak, 2);
        assert_eq!(snapshot.total, 2);
        assert_eq!(snapshot.longest, 2);
        assert_eq!(snapshot.milestones, 0);
    }

    #[test]
    #[should_panic]
    fn double_check_in_same_day_reverts() {
        let user     = address!("0x1212121212121212121212121212121212121212");
        let mirror   = address!("0x3434343434343434343434343434343434343434");
        let contract = address!("0x5656565656565656565656565656565656565656");
        let mut registry = build_registry(user, mirror, contract, 1_700_000_000);

        advance(&mut registry, user, contract, 1_700_000_000);
        registry.handle_check_in(hash(1), 20, 2);

        advance(&mut registry, user, contract, 1_700_000_000 + DAY_SECONDS - 60);
        registry.handle_check_in(hash(2), 21, 3);
    }
}
