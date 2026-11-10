# Python Coding Rules (sourced from AGENTS.md)

Apply these rules when writing or modifying Python code.

## Pythonic code
- Use idiomatic Python: list comprehensions over `map`/`filter` with lambdas, context managers (`with`) over manual `open`/`close`, `enumerate` over manual index counters.
- Use `pathlib.Path` for filesystem paths, never `os.path`.
- Type hints on all public functions and methods.

## Reuse via functions
- Extract repeated logic when it improves clarity or avoids meaningful duplication; don't abstract solely because a pattern appears twice.
- Keep functions focused. Split a function when doing so makes its responsibilities clearer or easier to test.
- Use `@lru_cache` / `@cache` for pure functions called repeatedly with the same args.

## Async when appropriate
- Use `async`/`await` for I/O-bound operations when the surrounding code and libraries support async; keep synchronous operations synchronous when that fits the existing design.
- Use synchronous code for CPU-bound work. Don't make things async just because.
- Use `asyncio.gather` for independent async calls that should run concurrently; await sequentially when one depends on another.

## String formatting
- Prefer f-strings (`f"...{var}..."`) for ordinary string formatting. Follow API requirements and surrounding conventions when another format is needed.
- Logging strings should use `%`-style (`logger.warning("foo %s", bar)`) so lazy evaluation works.
