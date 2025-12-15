//! Quorum calculation tests for sputnik-bridge contract
//!
//! Tests for the calculate_quorum helper function and boundary conditions.
//! Formula: quorum = ceil(citizen_count * 7 / 100)

use super::helpers::assert_panic_with;
use allure_rs::prelude::*;
use sputnik_bridge::calculate_quorum;

// ==================== QUORUM CALCULATION TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies quorum is 0 when there are no citizens.")]
#[allure_test]
#[test]
fn test_quorum_with_0_citizens_equals_0() {
    assert_eq!(calculate_quorum(0), 0);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies ceil(1 * 7 / 100) = ceil(0.07) = 1.")]
#[allure_test]
#[test]
fn test_quorum_with_1_citizen_equals_1() {
    // 1 * 7 / 100 = 0.07 → ceiling = 1
    assert_eq!(calculate_quorum(1), 1);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies ceil(14 * 7 / 100) = ceil(0.98) = 1.")]
#[allure_test]
#[test]
fn test_quorum_with_14_citizens_equals_1() {
    // 14 * 7 / 100 = 0.98 → ceiling = 1
    assert_eq!(calculate_quorum(14), 1);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies ceil(15 * 7 / 100) = ceil(1.05) = 2.")]
#[allure_test]
#[test]
fn test_quorum_with_15_citizens_equals_2() {
    // 15 * 7 / 100 = 1.05 → ceiling = 2
    assert_eq!(calculate_quorum(15), 2);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies 100 * 7 / 100 = 7.0 exactly (no ceiling needed).")]
#[allure_test]
#[test]
fn test_quorum_with_100_citizens_equals_7() {
    // 100 * 7 / 100 = 7.0 → ceiling = 7
    assert_eq!(calculate_quorum(100), 7);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies ceil(101 * 7 / 100) = ceil(7.07) = 8.")]
#[allure_test]
#[test]
fn test_quorum_with_101_citizens_equals_8() {
    // 101 * 7 / 100 = 7.07 → ceiling = 8
    assert_eq!(calculate_quorum(101), 8);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("minor")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies ceil(143 * 7 / 100) = ceil(10.01) = 11.")]
#[allure_test]
#[test]
fn test_quorum_with_143_citizens_equals_11() {
    // 143 * 7 / 100 = 10.01 → ceiling = 11
    assert_eq!(calculate_quorum(143), 11);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("minor")]
#[allure_tags("unit", "quorum", "math")]
#[allure_description("Verifies 1000 * 7 / 100 = 70.0 exactly.")]
#[allure_test]
#[test]
fn test_quorum_with_1000_citizens_equals_70() {
    // 1000 * 7 / 100 = 70.0 → ceiling = 70
    assert_eq!(calculate_quorum(1000), 70);
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "math", "algorithm")]
#[allure_description("Verifies ceiling division across multiple boundary transitions.")]
#[allure_test]
#[test]
fn test_quorum_ceiling_division_correctness() {
    // Verify ceiling division works correctly at various boundaries
    assert_eq!(calculate_quorum(1), 1); // 0.07 → 1
    assert_eq!(calculate_quorum(14), 1); // 0.98 → 1
    assert_eq!(calculate_quorum(15), 2); // 1.05 → 2
    assert_eq!(calculate_quorum(28), 2); // 1.96 → 2
    assert_eq!(calculate_quorum(29), 3); // 2.03 → 3
    assert_eq!(calculate_quorum(42), 3); // 2.94 → 3
    assert_eq!(calculate_quorum(43), 4); // 3.01 → 4
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Calculation")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "math", "scale")]
#[allure_description("Verifies quorum calculation scales correctly with large citizen counts.")]
#[allure_test]
#[test]
fn test_quorum_large_numbers() {
    // Test with large citizen counts
    assert_eq!(calculate_quorum(10000), 700);
    assert_eq!(calculate_quorum(100000), 7000);
    assert_eq!(calculate_quorum(1000000), 70000);
}

// ==================== BOUNDARY VALUE TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Boundaries")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "boundary")]
#[allure_description("Tests boundary transition from 0 to 1 quorum.")]
#[allure_test]
#[test]
fn test_quorum_boundary_0_to_1() {
    assert_eq!(calculate_quorum(0), 0, "0 citizens should have 0 quorum");
    assert_eq!(
        calculate_quorum(1),
        1,
        "1 citizen should have 1 quorum (ceil(0.07) = 1)"
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Boundaries")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "boundary")]
#[allure_description("Tests boundary transition from 1 to 2 quorum (14→15 citizens).")]
#[allure_test]
#[test]
fn test_quorum_boundary_1_to_2() {
    assert_eq!(calculate_quorum(14), 1, "14 citizens: ceil(0.98) = 1");
    assert_eq!(calculate_quorum(15), 2, "15 citizens: ceil(1.05) = 2");
    assert_eq!(calculate_quorum(16), 2, "16 citizens: ceil(1.12) = 2");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Boundaries")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "boundary")]
#[allure_description("Tests boundary transition from 2 to 3 quorum (28→29 citizens).")]
#[allure_test]
#[test]
fn test_quorum_boundary_2_to_3() {
    assert_eq!(calculate_quorum(28), 2, "28 citizens: ceil(1.96) = 2");
    assert_eq!(calculate_quorum(29), 3, "29 citizens: ceil(2.03) = 3");
    assert_eq!(calculate_quorum(30), 3, "30 citizens: ceil(2.10) = 3");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Boundaries")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "boundary")]
#[allure_description("Tests boundary transition from 6 to 7 quorum (85→86 citizens).")]
#[allure_test]
#[test]
fn test_quorum_boundary_6_to_7() {
    assert_eq!(calculate_quorum(85), 6, "85 citizens: ceil(5.95) = 6");
    assert_eq!(calculate_quorum(86), 7, "86 citizens: ceil(6.02) = 7");
    assert_eq!(calculate_quorum(87), 7, "87 citizens: ceil(6.09) = 7");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Boundaries")]
#[allure_severity("normal")]
#[allure_tags("unit", "quorum", "boundary", "percentage")]
#[allure_description("Tests exact 7% boundary at 100 citizens.")]
#[allure_test]
#[test]
fn test_quorum_boundary_exact_7_percent() {
    assert_eq!(calculate_quorum(99), 7, "99 citizens: ceil(6.93) = 7");
    assert_eq!(calculate_quorum(100), 7, "100 citizens: exact 7% = 7");
    assert_eq!(calculate_quorum(101), 8, "101 citizens: ceil(7.07) = 8");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Boundaries")]
#[allure_severity("minor")]
#[allure_tags("unit", "quorum", "boundary", "percentage")]
#[allure_description("Tests exact 14% boundary at 200 citizens.")]
#[allure_test]
#[test]
fn test_quorum_boundary_exact_14_percent() {
    assert_eq!(calculate_quorum(199), 14, "199 citizens: ceil(13.93) = 14");
    assert_eq!(calculate_quorum(200), 14, "200 citizens: exact 14% = 14");
    assert_eq!(calculate_quorum(201), 15, "201 citizens: ceil(14.07) = 15");
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Boundaries")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "boundary", "algorithm")]
#[allure_description("Verifies ceiling is used (not floor) for fractional quorum values.")]
#[allure_test]
#[test]
fn test_quorum_boundary_floor_vs_ceil_difference() {
    // Test cases where floor and ceiling would give different results
    assert_eq!(
        calculate_quorum(1),
        1,
        "1 citizen: floor=0, ceil=1, should be 1"
    );
    assert_eq!(
        calculate_quorum(14),
        1,
        "14 citizens: floor=0, ceil=1, should be 1"
    );
    assert_eq!(
        calculate_quorum(15),
        2,
        "15 citizens: floor=1, ceil=2, should be 2"
    );
    assert_eq!(
        calculate_quorum(99),
        7,
        "99 citizens: floor=6, ceil=7, should be 7"
    );
}

// ==================== OVERFLOW TESTS ====================

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Overflow")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "overflow", "security")]
#[allure_description("Verifies u64::MAX input causes overflow panic (u64::MAX * 7 overflows).")]
#[allure_test]
#[test]
fn test_quorum_overflow_panics() {
    // u64::MAX * 7 would overflow u64, so checked_mul returns None
    // and the function should panic with the overflow message.
    // This tests that the contract properly handles overflow scenarios.
    assert_panic_with(
        || {
            calculate_quorum(u64::MAX);
        },
        "Quorum calculation overflow",
    );
}

#[allure_parent_suite("Near Citizens House")]
#[allure_suite_label("Sputnik Bridge Unit Tests")]
#[allure_sub_suite("Quorum Overflow")]
#[allure_severity("critical")]
#[allure_tags("unit", "quorum", "overflow", "security")]
#[allure_description("Verifies max safe value (u64::MAX / 7) calculates without overflow.")]
#[allure_test]
#[test]
fn test_quorum_near_overflow_boundary() {
    // Test with a large value that's just below the overflow threshold
    // u64::MAX / 7 = 2635249153387078802
    // At this value, citizen_count * 7 should still be within u64 range
    let safe_max = u64::MAX / 7;
    let result = calculate_quorum(safe_max);
    // Expected: ceil(safe_max * 7 / 100) = ceil(safe_max * 0.07)
    // safe_max * 7 = u64::MAX (approximately), divided by 100 gives ~26352491533870788
    assert!(result > 0, "Quorum should be calculated for safe_max");
}
