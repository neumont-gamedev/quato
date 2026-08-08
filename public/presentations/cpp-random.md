# C++ Random Numbers

The `<random>` library separates engines from distributions.

---

## Entropy Source

`std::random_device` can provide entropy for seeding a pseudo-random engine.

---

@question q1

---

## Engines and Distributions

`std::mt19937` generates pseudo-random bits. A distribution turns those bits into values in a useful range.

---

@question q2

---

## Rolling a Die

```cpp
std::mt19937 rng{std::random_device{}()};
std::uniform_int_distribution<int> die(1, 6);
```

---

@question q3

---

@results
