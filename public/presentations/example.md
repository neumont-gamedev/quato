# C++ Smart Pointers

Smart pointers express ownership rules directly in code.

---

## Ownership

Use `std::unique_ptr` when exactly one owner should manage an object.

---

@question q1

---

## Shared Ownership

Use `std::shared_ptr` only when multiple owners really need shared lifetime.

---

@question q2

---

## Weak References

Use `std::weak_ptr` to observe shared state without keeping it alive.

---

@question q3

---

## Smart Pointer Construction

Prefer `std::make_unique` and `std::make_shared` for ordinary construction.

```cpp
auto owner = std::make_unique<int>(42);
```

---

@question q4

---

@results
