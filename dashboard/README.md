# Flame in Freefall dashboard

This is the Agent B dashboard MVP. It is dependency-light so it can be demoed
before the full Next.js shell is installed.

Run from the repository root:

~~~powershell
npx serve .
~~~

Then open /dashboard/. The dashboard reads the small committed catalog at
dashboard/data/experiments.json. Large NASA datasets and videos remain local
and are ignored by Git.
