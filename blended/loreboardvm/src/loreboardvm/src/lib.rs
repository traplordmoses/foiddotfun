#![cfg_attr(not(feature = "std"), no_std, no_main)]

extern crate alloc;
extern crate fluentbase_sdk;

use alloc::vec::Vec;
use core::cmp::Ordering;
use fluentbase_sdk::{
    basic_entrypoint,
    codec::Codec,
    derive::{router, Contract},
    B256, SharedAPI, U256,
};

#[derive(Clone, Copy, Default, PartialEq, Eq, Debug, Codec)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[derive(Clone, Copy, Default, PartialEq, Eq, Debug, Codec)]
pub struct PlacementInput {
    pub id: B256,
    pub rect: Rect,
    pub bid_per_cell: U256,
}

#[derive(Contract, Default)]
struct LoreboardVM<SDK> {
    sdk: SDK,
}

pub trait LoreboardVMAPI {
    fn select_winners(
        &self,
        base: Vec<PlacementInput>,
        candidates: Vec<PlacementInput>,
    ) -> (Vec<B256>, Vec<B256>);
}

#[router(mode = "solidity")]
impl<SDK: SharedAPI> LoreboardVMAPI for LoreboardVM<SDK> {
    #[function_id("selectWinners((bytes32,(int32,int32,int32,int32),uint256)[],(bytes32,(int32,int32,int32,int32),uint256)[])")]
    fn select_winners(
        &self,
        base: Vec<PlacementInput>,
        candidates: Vec<PlacementInput>,
    ) -> (Vec<B256>, Vec<B256>) {
        let mut sorted = candidates.clone();
        sorted.sort_by(|a, b| compare_candidates(a, b));

        let mut accepted: Vec<B256> = Vec::new();
        let mut rejected: Vec<B256> = Vec::new();
        let mut accepted_rects: Vec<Rect> = Vec::new();

        for candidate in sorted {
            let mut overlaps = false;
            for existing in &base {
                if rects_overlap(&candidate.rect, &existing.rect) {
                    overlaps = true;
                    break;
                }
            }
            if !overlaps {
                for rect in &accepted_rects {
                    if rects_overlap(&candidate.rect, rect) {
                        overlaps = true;
                        break;
                    }
                }
            }

            if overlaps {
                rejected.push(candidate.id);
            } else {
                accepted_rects.push(candidate.rect);
                accepted.push(candidate.id);
            }
        }

        (accepted, rejected)
    }
}

impl<SDK: SharedAPI> LoreboardVM<SDK> {
    pub fn deploy(&self) {}
}

fn compare_candidates(a: &PlacementInput, b: &PlacementInput) -> Ordering {
    match b.bid_per_cell.cmp(&a.bid_per_cell) {
        Ordering::Equal => a.id.cmp(&b.id),
        other => other,
    }
}

fn rects_overlap(a: &Rect, b: &Rect) -> bool {
    let ax1 = a.x as i64;
    let ay1 = a.y as i64;
    let ax2 = ax1 + a.w as i64;
    let ay2 = ay1 + a.h as i64;

    let bx1 = b.x as i64;
    let by1 = b.y as i64;
    let bx2 = bx1 + b.w as i64;
    let by2 = by1 + b.h as i64;

    ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1
}

basic_entrypoint!(LoreboardVM);
