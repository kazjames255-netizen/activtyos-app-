// A-level Maths — Proof (Years 12–13). Original content aligned to the DfE GCE AS and A-level mathematics subject content.
// Answer keys are recomputed by _check_m4_a.ts — re-run it after ANY edit here.
import type { CTopic } from "../types";
import { S, M, NUM, WR } from "./_h4";

export const TOPIC: CTopic = {
  key: "proof",
  topic: "Proof",
  subject: "Maths",
  years: {
    12: {
      year: 12,
      subtopic: "Year 12 (AS)",
      objectives: [
        "Understand and use the structure of mathematical proof, proceeding from given assumptions through a series of logical steps to a conclusion.",
        "Prove statements by deduction, using algebra (even, odd and consecutive integers, inequalities and completing the square).",
        "Prove statements by exhaustion, splitting the possibilities into a finite set of cases.",
        "Disprove a statement by providing a counter-example.",
      ],
      note: {
        title: "Year 12: proof by deduction, exhaustion and counter-example",
        body: `## What you need to know

A **proof** is a chain of logical steps from things we know to a conclusion. Checking a few examples never proves a statement for *all* cases, but **one** counter-example is enough to disprove it.

| Method | Idea |
| --- | --- |
| **Deduction** | Start from general algebra and reason to the result |
| **Exhaustion** | Split into a finite number of cases and check every one |
| **Counter-example** | One value where the claim fails |

**Algebra toolkit**
- Even number: 2k. Odd number: 2k + 1 (k an integer).
- Consecutive integers: n, n + 1, n + 2, and so on.
- To show a multiple of m, factorise so that m is a factor.
- To show an expression is always positive, complete the square: a squared bracket is never negative.

## Worked example 1: deduction

**Prove that the sum of three consecutive even numbers is a multiple of 6.**

Let the numbers be 2n, 2n + 2 and 2n + 4 (n an integer).
Sum = 6n + 6 = 6(n + 1), which has 6 as a factor. So the sum is always a multiple of 6. ∎

## Worked example 2: counter-example

**Disprove: "If x² > 9 then x > 3".**

Try x = −5. Then x² = 25 > 9, but −5 is not greater than 3. One counter-example is enough, so the statement is false.

## Worked example 3: exhaustion

**Show that n² + n is even for every integer n.**
Case 1: n even, so n² and n are both even and their sum is even.
Case 2: n odd, so n² and n are both odd and their sum is even.
Both cases give an even number. ∎

Tip: always finish with a sentence that says what has been proved.`,
      },
      quiz: {
        title: "Proof: Year 12 quiz",
        questions: [
          S("proof-y12-01", 1, "Which pair of prime numbers is a counter-example to the claim: “the sum of any two prime numbers is even”?", ["3 + 5", "7 + 11", "2 + 7", "13 + 17"], "2 + 7", "2 + 7 = 9 is odd, because 2 is the only even prime. The other pairs all add to even numbers, so they do not disprove the claim."),
          S("proof-y12-02", 1, "Which value of n is a counter-example to the claim: “n² > n for every real number n”?", ["n = 2", "n = −3", "n = 5", "n = ½"], "n = ½", "For n = ½, n² = ¼ which is less than ½. The other values all satisfy n² > n, so they do not disprove the claim."),
          S("proof-y12-03", 1, "The sum of any three consecutive integers n, n + 1, n + 2 is 3n + 3. The sum is therefore always a multiple of which number?", ["2", "3", "4", "6"], "3", "3n + 3 = 3(n + 1), so 3 is a factor. It is not always even, and not always a multiple of 4 or 6 (for example 1 + 2 + 3 = 6 but 2 + 3 + 4 = 9)."),
          S("proof-y12-04", 2, "A proof by exhaustion considers n = 5k, 5k + 1, 5k + 2, 5k + 3 and 5k + 4. What remainders can n² leave when divided by 5?", ["0, 1, 2, 4", "0, 1, 2, 3, 4", "1 and 4 only", "0, 1, 4"], "0, 1, 4", "Squaring the five cases gives remainders 0, 1, 4, 4, 1, so only 0, 1 and 4 can occur (a square never leaves 2 or 3)."),
          S("proof-y12-05", 2, "An odd number is 2k + 1. Its square (2k + 1)² can be written as 2m + 1 for an integer m, which proves that odd² is odd. What is m?", ["4k² + 4k", "2k² + 2k", "k² + k", "2k² + k"], "2k² + 2k", "(2k + 1)² = 4k² + 4k + 1 = 2(2k² + 2k) + 1, so m = 2k² + 2k.", { diagnostic: true }),
          NUM("proof-y12-06", 2, "Find the smallest positive integer n for which n! + 1 is not prime, showing that “n! + 1 is prime for every positive integer n” is false.", 4, 0, "Check in turn: 1! + 1 = 2, 2! + 1 = 3, 3! + 1 = 7 are all prime, but 4! + 1 = 25 = 5 × 5 is not."),
          NUM("proof-y12-07", 2, "Completing the square shows that x² + 6x + 14 is always positive. What is its minimum value?", 5, 0, "x² + 6x + 14 = (x + 3)² + 5. A squared bracket is at least 0, so the minimum is 5, at x = −3. Since 5 > 0 the expression is always positive.", { diagnostic: true }),
          NUM("proof-y12-08", 2, "For any integer n, n² + (n + 1)² = 2m + 1 for some integer m (so the sum of the squares of two consecutive integers is odd). Find m when n = 6.", 42, 0, "n² + (n + 1)² = 2n² + 2n + 1 = 2(n² + n) + 1, so m = n² + n. For n = 6 that is 36 + 6 = 42, and 36 + 49 = 85 = 2 × 42 + 1."),
          M("proof-y12-09", 2, "Which TWO of these statements are false?", ["Every prime number is odd.", "The sum of two even numbers is even.", "If x² = 16 then x = 4.", "The product of two odd numbers is odd."], ["Every prime number is odd.", "If x² = 16 then x = 4."], "2 is an even prime, and x = −4 also satisfies x² = 16, so those two are false. Even + even = even and odd × odd = odd are both true."),
          S("proof-y12-10", 3, "Squares of integers leave remainder 0 or 1 when divided by 4 (proof by exhaustion on even and odd n). Which of these numbers can NOT be written as the sum of two square numbers (0 allowed)?", ["27", "10", "25", "41"], "27", "Two squares add to a remainder of 0, 1 or 2 mod 4, but 27 leaves remainder 3. The others work: 10 = 1 + 9, 25 = 0 + 25, 41 = 16 + 25."),
          NUM("proof-y12-11", 3, "The claim “n² − n + 11 is prime for every positive integer n” is false. Find the smallest positive integer n that is a counter-example.", 11, 0, "The values for n = 1 to 10 are 11, 13, 17, 23, 31, 41, 53, 67, 83, 101, all prime. For n = 11 the value is 121 = 11 × 11, which is not prime."),
          S("proof-y12-12", 3, "The claim “2ⁿ − 1 is prime for every prime number n” is false. Which value of n is a counter-example?", ["n = 3", "n = 5", "n = 11", "n = 7"], "n = 11", "2¹¹ − 1 = 2047 = 23 × 89. For n = 3, 5 and 7 the values 7, 31 and 127 are all prime, so they are not counter-examples."),
          WR("proof-y12-13", 3, "Prove that the sum of the squares of any two odd numbers is even but is never a multiple of 4.", 4, "Mark scheme (4 marks). M1: write two odd numbers as 2a + 1 and 2b + 1 (integers a, b). M1: expand (2a + 1)² + (2b + 1)² = 4a² + 4a + 4b² + 4b + 2. A1: factorise as 4(a² + a + b² + b) + 2, which is 2 more than a multiple of 4. A1: conclude the sum is even (2 is a factor) but leaves remainder 2 on division by 4, so it is never a multiple of 4."),
        ],
      },
      flashcards: [
        { front: "What is one counter-example enough to do?", back: "Disprove a statement. Examples never prove it; a single failure disproves it." },
        { front: "Proof by exhaustion", back: "Split into a finite number of cases and show the statement holds in every case." },
        { front: "Algebraic form of an even number and an odd number", back: "Even: 2k. Odd: 2k + 1 (k an integer)." },
        { front: "Three consecutive integers (algebra)", back: "n, n + 1, n + 2 with n an integer." },
        { front: "How to show an expression is a multiple of m", back: "Factorise it so that m is a factor of every term." },
        { front: "How to show x² + bx + c > 0 for all x", back: "Complete the square: (x + b/2)² + (c − b²/4). If c − b²/4 > 0 it is always positive." },
        { front: "Why can a squared bracket never be negative?", back: "(anything)² ≥ 0 for every real number." },
        { front: "The only even prime", back: "2. Many false ‘all primes are odd’ style claims are disproved by it." },
        { front: "What should the last line of a proof say?", back: "A clear conclusion that states what has been proved (∎ or ‘as required’)." },
        { front: "Does a pattern that works for n = 0 to 39 prove a claim?", back: "No. It is evidence only. n² + n + 41 is prime for n = 0 to 39 but not for n = 40 (1681 = 41²)." },
      ],
    },
    13: {
      year: 13,
      subtopic: "Year 13 (A2)",
      objectives: [
        "Prove statements by contradiction, assuming the opposite and reaching an impossible result.",
        "Prove that √2 (and similar surds) is irrational.",
        "Prove that there are infinitely many primes.",
        "Use contradiction to prove that certain equations have no integer solutions, and identify the step that gives the contradiction.",
      ],
      note: {
        title: "Year 13: proof by contradiction",
        body: `## What you need to know

**Proof by contradiction:**
1. **Assume the statement is false** (assume its opposite).
2. Reason logically from that assumption.
3. Reach something impossible (a contradiction).
4. Conclude that the assumption was wrong, so the original statement is true.

**Useful facts**
- If n² is even then n is even. If n² is a multiple of p (p prime) then n is a multiple of p.
- A rational number is p/q with integers p and q, q ≠ 0, and we can always take p/q in **lowest terms**.
- Rational + rational = rational. Rational + irrational = irrational.

## Worked example 1: no smallest positive rational

**Prove that there is no smallest positive rational number.**

Assume r is the smallest positive rational. Then r/2 is also rational and positive, and r/2 < r. This contradicts r being the smallest. So no smallest positive rational exists. ∎

## Worked example 2: √7 is irrational

Assume √7 = a/b in lowest terms. Then 7b² = a², so a² is a multiple of 7, so a is a multiple of 7. Write a = 7k: 7b² = 49k², so b² = 7k², and b is also a multiple of 7. Then a and b share the factor 7, contradicting lowest terms. So √7 is irrational. ∎

## Worked example 3: infinitely many primes (outline)

Assume the only primes are p₁, …, pₙ. Let N = p₁ × p₂ × … × pₙ + 1. Dividing N by any pᵢ leaves remainder 1, so no listed prime divides N. But N has a prime factor (or is prime itself), which is not on the list. Contradiction. ∎

Tip: write “Assume, for a contradiction, that …” to start.`,
      },
      quiz: {
        title: "Proof: Year 13 quiz",
        questions: [
          S("proof-y13-01", 1, "A proof by contradiction begins by:", ["assuming the statement is true and finding examples", "assuming the statement is false and reaching an impossible result", "testing many values until a pattern appears", "working backwards from the conclusion only"], "assuming the statement is false and reaching an impossible result", "We assume the opposite of what we want to prove, and show it leads to a contradiction, so the original statement must be true."),
          S("proof-y13-02", 1, "In the standard proof that √2 is irrational we write √2 = a/b with a/b in lowest terms. What does ‘lowest terms’ tell us?", ["a and b are both prime", "a and b are both even", "a and b have no common factor greater than 1", "b = 1"], "a and b have no common factor greater than 1", "A fraction in lowest terms has been cancelled fully, so a and b share no factor greater than 1. The proof ends by finding that they share the factor 2."),
          S("proof-y13-03", 2, "From √2 = a/b we get a² = 2b², so a² is even. Which fact allows us to conclude that a is even?", ["If a were odd then a² would be odd, so a must be even", "Every square number is even", "2b² is a multiple of 4", "a and b are both even"], "If a were odd then a² would be odd, so a must be even", "An odd number squared is odd, so an even square must come from an even number. The other options are false or assume what we are trying to show."),
          S("proof-y13-04", 2, "Continuing, a = 2k gives 2b² = 4k², so b² = 2k². What is the contradiction?", ["k is not an integer", "b is odd, which contradicts a being even", "a² would equal b²", "b is also even, so a and b have a common factor 2, contradicting lowest terms"], "b is also even, so a and b have a common factor 2, contradicting lowest terms", "b² = 2k² is even, so b is even. Both a and b are then even, which contradicts the assumption that a/b was in lowest terms."),
          S("proof-y13-05", 2, "Assume the only primes are p₁, p₂, …, pₙ and let N = p₁p₂…pₙ + 1. Which statement is true about N?", ["N is divisible by p₁", "N leaves remainder 1 when divided by each pᵢ", "N is always prime", "N is always even"], "N leaves remainder 1 when divided by each pᵢ", "p₁p₂…pₙ is a multiple of every pᵢ, so adding 1 leaves remainder 1. N is not always prime (it is only guaranteed to have a prime factor that is not on the list).", { diagnostic: true }),
          NUM("proof-y13-06", 3, "For the primes 2, 3, 5, 7, 11, 13 the number N = 2 × 3 × 5 × 7 × 11 × 13 + 1 = 30 031 is not itself prime. Find its smallest prime factor.", 59, 0, "Divide by primes in turn: none of 2 to 53 divides 30 031, but 30 031 = 59 × 509. So the smallest prime factor is 59, which is not in the original list."),
          S("proof-y13-07", 2, "To prove that √3 is irrational we reach 3b² = a². Which fact is needed to conclude that a is a multiple of 3?", ["a² is even so a is even", "3b² is always a perfect square", "If a² is a multiple of 3 then a is a multiple of 3", "a and b must both be prime"], "If a² is a multiple of 3 then a is a multiple of 3", "3 is prime, so if it divides a² it divides a. Then a = 3k gives 3b² = 9k², b² = 3k², and b is also a multiple of 3, the contradiction.", { diagnostic: true }),
          S("proof-y13-08", 1, "To prove by contradiction that there is no greatest even integer, assume N is the greatest even integer. Which number gives the contradiction?", ["N − 2", "N + 2", "N + 1", "N ÷ 2"], "N + 2", "N + 2 is even and larger than N, contradicting the assumption that N is the greatest even integer."),
          M("proof-y13-09", 2, "Which TWO of these numbers are irrational?", ["√2", "√16", "√20", "√(49/4)"], ["√2", "√20"], "√16 = 4 and √(49/4) = 7/2 are rational. √2 and √20 = 2√5 are irrational because 2 and 20 are not squares of rational numbers."),
          S("proof-y13-10", 3, "A student claims a² − b² = 10 has no integer solutions and writes (a − b)(a + b) = 10. Which fact completes the contradiction?", ["a − b must equal a + b", "10 is not a square number, so a² − b² cannot equal it", "a and b must both be prime", "a − b and a + b have the same parity, but no factor pair of 10 has two factors of the same parity"], "a − b and a + b have the same parity, but no factor pair of 10 has two factors of the same parity", "a + b = (a − b) + 2b, so the two factors are both odd or both even. The factor pairs of 10 are 1 × 10 and 2 × 5, each with one odd and one even factor."),
          WR("proof-y13-11", 3, "Prove by contradiction that 3 + √2 is irrational. You may assume that √2 is irrational.", 3, "Mark scheme (3 marks). M1: assume, for a contradiction, that 3 + √2 = p/q with p, q integers and q ≠ 0. M1: rearrange to √2 = p/q − 3 = (p − 3q)/q, a quotient of two integers. A1: so √2 would be rational, which contradicts the known fact; hence 3 + √2 is irrational."),
          S("proof-y13-12", 2, "Claim: x + 1/x ≥ 2 for all x > 0. Assume instead that x + 1/x < 2. Multiplying by x (positive) and rearranging gives a squared expression that is less than 0. Which is it?", ["x² + 1", "(x + 1)²", "(x − 1)²", "x² − 1"], "(x − 1)²", "x² + 1 < 2x rearranges to x² − 2x + 1 < 0, that is (x − 1)² < 0. A square cannot be negative, which is the contradiction."),
          S("proof-y13-13", 3, "Suppose log₂3 = p/q for positive integers p and q. Then 2^p = 3^q. What is the contradiction?", ["2^p is odd but 3^q is even", "2^p is less than 3^q", "2^p is even but 3^q is odd", "p and q must both be prime"], "2^p is even but 3^q is odd", "log₂3 = p/q means 3 = 2^(p/q), so 3^q = 2^p. A positive power of 2 is even and a power of 3 is odd, so they can never be equal."),
        ],
      },
      flashcards: [
        { front: "First line of a proof by contradiction", back: "“Assume, for a contradiction, that the statement is false.”" },
        { front: "What has to happen for the proof to work?", back: "The assumption leads to something impossible (a contradiction), so the assumption is wrong." },
        { front: "Define a rational number", back: "p/q with p, q integers and q ≠ 0; it can always be written in lowest terms." },
        { front: "If n² is even, then …", back: "n is even (an odd number squared is odd)." },
        { front: "If p is prime and p divides n², then …", back: "p divides n." },
        { front: "Proof that √2 is irrational: the contradiction", back: "a and b both turn out to be even, but a/b was assumed to be in lowest terms." },
        { front: "Euclid’s number N = p₁p₂…pₙ + 1", back: "Leaves remainder 1 on division by every listed prime, so it has a prime factor not on the list." },
        { front: "Rational + irrational is …", back: "irrational (otherwise the irrational would equal a difference of rationals)." },
        { front: "Does N = p₁p₂…pₙ + 1 have to be prime?", back: "No. It only has to have a prime factor outside the list (for example, 2×3×5×7×11×13 + 1 = 30 031 is not prime, yet each of the six listed primes leaves remainder 1)." },
        { front: "a² − b² = (a − b)(a + b): parity fact", back: "a − b and a + b are both even or both odd." },
      ],
    },
  },
};
