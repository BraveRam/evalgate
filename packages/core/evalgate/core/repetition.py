"""Validated attempt counts shared by every evaluation entry point."""

from evalgate.core.types import SuiteConfig


def validate_repeat(repeat: int) -> int:
    if isinstance(repeat, bool) or not isinstance(repeat, int) or not 1 <= repeat <= 100:
        raise ValueError("repeat must be an integer between 1 and 100")
    return repeat


def attempt_counts(suite: SuiteConfig, repeat: int | None = None) -> list[int]:
    default = validate_repeat(suite.repeat if repeat is None else repeat)
    return [
        validate_repeat(case.repeat if case.repeat is not None else default) for case in suite.tests
    ]
