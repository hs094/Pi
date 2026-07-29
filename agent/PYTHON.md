# Python Coding Rules (sourced from AGENTS.md)

Apply these rules when writing or modifying Python code.

## Pythonic code
- Use idiomatic Python: list comprehensions over `map`/`filter` with lambdas, context managers (`with`) over manual `open`/`close`, `enumerate` over manual index counters.
- Use `pathlib.Path` for filesystem paths, never `os.path`.
- Type hints on all public functions and methods.

## Reuse via functions
- Extract repeated logic into reusable functions. If a pattern appears twice, it gets a name.
- Keep functions small and single-purpose. If a function does more than one thing, split it.
- Use `@lru_cache` / `@cache` for pure functions called repeatedly with the same args.

## Async when appropriate
- Use `async`/`await` for I/O-bound operations: HTTP calls, database queries, file reads, subprocesses.
- Use synchronous code for CPU-bound work. Don't make things async just because.
- Use `asyncio.gather` for concurrent independent async calls. Don't `await` them sequentially.

## Always f-strings
- Use f-strings (`f"...{var}..."`) for string formatting. No `%` formatting, no `.format()`, no string concatenation for expressions.
- Exception: logging strings should use `%`-style (`logger.warning("foo %s", bar)`) so lazy evaluation works.
