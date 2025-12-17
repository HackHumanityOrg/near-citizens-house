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
    step("Calculate and verify quorum for 0 citizens", || {
        assert_eq!(calculate_quorum(0), 0);
    });
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
    step("Calculate and verify quorum for 1 citizen (ceil(0.07) = 1)", || {
        assert_eq!(calculate_quorum(1), 1);
    });
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
    step("Calculate and verify quorum for 14 citizens (ceil(0.98) = 1)", || {
        assert_eq!(calculate_quorum(14), 1);
    });
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
    step("Calculate and verify quorum for 15 citizens (ceil(1.05) = 2)", || {
        assert_eq!(calculate_quorum(15), 2);
    });
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
    step("Calculate and verify quorum for 100 citizens (exact 7.0)", || {
        assert_eq!(calculate_quorum(100), 7);
    });
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
    step("Calculate and verify quorum for 101 citizens (ceil(7.07) = 8)", || {
        assert_eq!(calculate_quorum(101), 8);
    });
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
    step("Calculate and verify quorum for 143 citizens (ceil(10.01) = 11)", || {
        assert_eq!(calculate_quorum(143), 11);
    });
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
    step("Calculate and verify quorum for 1000 citizens (exact 70.0)", || {
        assert_eq!(calculate_quorum(1000), 70);
    });
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
    step("Verify ceiling division at various boundaries", || {
        assert_eq!(calculate_quorum(1), 1); // 0.07 → 1
        assert_eq!(calculate_quorum(14), 1); // 0.98 → 1
        assert_eq!(calculate_quorum(15), 2); // 1.05 → 2
        assert_eq!(calculate_quorum(28), 2); // 1.96 → 2
        assert_eq!(calculate_quorum(29), 3); // 2.03 → 3
        assert_eq!(calculate_quorum(42), 3); // 2.94 → 3
        assert_eq!(calculate_quorum(43), 4); // 3.01 → 4
    });
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
    step("Verify quorum calculation with large citizen counts", || {
        assert_eq!(calculate_quorum(10000), 700);
        assert_eq!(calculate_quorum(100000), 7000);
        assert_eq!(calculate_quorum(1000000), 70000);
    });
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
    step("Verify 0 citizens yields 0 quorum", || {
        assert_eq!(calculate_quorum(0), 0, "0 citizens should have 0 quorum");
    });

    step("Verify 1 citizen yields 1 quorum", || {
        assert_eq!(
            calculate_quorum(1),
            1,
            "1 citizen should have 1 quorum (ceil(0.07) = 1)"
        );
    });
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
    step("Verify 14 citizens stays at quorum 1", || {
        assert_eq!(calculate_quorum(14), 1, "14 citizens: ceil(0.98) = 1");
    });

    step("Verify 15 citizens transitions to quorum 2", || {
        assert_eq!(calculate_quorum(15), 2, "15 citizens: ceil(1.05) = 2");
    });

    step("Verify 16 citizens stays at quorum 2", || {
        assert_eq!(calculate_quorum(16), 2, "16 citizens: ceil(1.12) = 2");
    });
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
    step("Verify 28 citizens stays at quorum 2", || {
        assert_eq!(calculate_quorum(28), 2, "28 citizens: ceil(1.96) = 2");
    });

    step("Verify 29 citizens transitions to quorum 3", || {
        assert_eq!(calculate_quorum(29), 3, "29 citizens: ceil(2.03) = 3");
    });

    step("Verify 30 citizens stays at quorum 3", || {
        assert_eq!(calculate_quorum(30), 3, "30 citizens: ceil(2.10) = 3");
    });
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
    step("Verify 85 citizens stays at quorum 6", || {
        assert_eq!(calculate_quorum(85), 6, "85 citizens: ceil(5.95) = 6");
    });

    step("Verify 86 citizens transitions to quorum 7", || {
        assert_eq!(calculate_quorum(86), 7, "86 citizens: ceil(6.02) = 7");
    });

    step("Verify 87 citizens stays at quorum 7", || {
        assert_eq!(calculate_quorum(87), 7, "87 citizens: ceil(6.09) = 7");
    });
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
    step("Verify 99 citizens yields quorum 7", || {
        assert_eq!(calculate_quorum(99), 7, "99 citizens: ceil(6.93) = 7");
    });

    step("Verify 100 citizens yields exact 7% quorum", || {
        assert_eq!(calculate_quorum(100), 7, "100 citizens: exact 7% = 7");
    });

    step("Verify 101 citizens transitions to quorum 8", || {
        assert_eq!(calculate_quorum(101), 8, "101 citizens: ceil(7.07) = 8");
    });
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
    step("Verify 199 citizens yields quorum 14", || {
        assert_eq!(calculate_quorum(199), 14, "199 citizens: ceil(13.93) = 14");
    });

    step("Verify 200 citizens yields exact 14% quorum", || {
        assert_eq!(calculate_quorum(200), 14, "200 citizens: exact 14% = 14");
    });

    step("Verify 201 citizens transitions to quorum 15", || {
        assert_eq!(calculate_quorum(201), 15, "201 citizens: ceil(14.07) = 15");
    });
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
    step("Verify ceiling is used for 1 citizen (floor=0, ceil=1)", || {
        assert_eq!(
            calculate_quorum(1),
            1,
            "1 citizen: floor=0, ceil=1, should be 1"
        );
    });

    step("Verify ceiling is used for 14 citizens (floor=0, ceil=1)", || {
        assert_eq!(
            calculate_quorum(14),
            1,
            "14 citizens: floor=0, ceil=1, should be 1"
        );
    });

    step("Verify ceiling is used for 15 citizens (floor=1, ceil=2)", || {
        assert_eq!(
            calculate_quorum(15),
            2,
            "15 citizens: floor=1, ceil=2, should be 2"
        );
    });

    step("Verify ceiling is used for 99 citizens (floor=6, ceil=7)", || {
        assert_eq!(
            calculate_quorum(99),
            7,
            "99 citizens: floor=6, ceil=7, should be 7"
        );
    });
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
    step("Verify u64::MAX causes overflow panic", || {
        assert_panic_with(
            || {
                calculate_quorum(u64::MAX);
            },
            "Quorum calculation overflow",
        );
    });
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
    step("Calculate safe max value (u64::MAX / 7)", || {
        let safe_max = u64::MAX / 7;
        let result = calculate_quorum(safe_max);
        assert!(result > 0, "Quorum should be calculated for safe_max");
    });
}
