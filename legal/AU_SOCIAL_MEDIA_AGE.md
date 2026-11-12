# Australia: social media minimum age self-assessment

Bluestem Software LLC's assessment of whether Rust Strength is an
"age-restricted social media platform" under Australia's Online Safety Act 2021.
Written November 6, 2026, against the Act, the Online Safety (Age-Restricted
Social Media Platforms) Rules 2025 as amended on March 26, 2026, and the Rules'
explanatory statement. **Not reviewed by a lawyer.** eSafety and the courts
decide this, not us; this file records our reasoning in good faith.

**Reassess** whenever the social features change, if eSafety gets in touch, and
at least once a year.

## The rule

Since December 10, 2025, age-restricted social media platforms must take
reasonable steps to stop Australians under 16 from having accounts (s 63D).
Rust Strength's minimum age is 13, so the question matters.

A service is one if (s 63C(1)(a) and Rules s 4A):

1. its sole purpose, or a significant purpose, is to enable online social
   interaction between two or more end-users;
2. it lets end-users link to, or interact with, other end-users;
3. it lets end-users post material on it; and
4. it has a recommender feature, or a feature available only with an account:
   an endless feed, a feedback feature (showing a user how others engaged with
   what they posted), or a time-limited feature (posts that disappear).

It is **not** one if it falls in a class the Rules exclude. The one that fits is
s 5(1)(f): "services that have the sole or primary purpose of supporting the
health of end-users".

## How Rust Strength measures up

| Condition | Rust Strength | Met? |
|---|---|---|
| 1. Social interaction a significant purpose | Friends, a feed of friends' session summaries, reactions, a friends-only leaderboard. All optional: nobody is visible until they choose a username and accept a friend, and every other feature works without friends. | Arguable. Treated as met, to be safe. |
| 2. Link to or interact with others | Friend requests, reactions. | Yes |
| 3. Post material | Session summaries go to accepted friends' feeds and, from 1.2, the person's profile, which only those friends can open. People also type usernames, display names and names of workouts, activities, runs and custom exercises that friends can see. | Yes |
| 4. Recommender or account-only feature | **Feedback feature: yes.** A user sees how many reactions each post got. **Endless feed: no.** The feed loads one page of friends' posts and stops; nothing loads as you scroll. The grid on a friend's profile does the same. **Time-limited posts: no.** A blue ring for training today, or a gold one for a record today, around the circle with someone's initial goes at midnight, but it isn't a post, and the session itself stays. **Recommender: probably not.** The feed shows accepted friends' posts newest first, and nothing is picked by interest or engagement. A broad reading could still count "posts from your friends" as selection by account information. | Yes, through the feedback feature |

So conditions 1 to 4 may all be met, and the answer rests on the health
exclusion.

## The health exclusion

The explanatory statement for the Rules says the exclusion "is intended to
capture access to both physical and mental health support". It says the
purpose "should be determined by considering the experience of end-users of the
service, rather than how its purpose might be characterised by the service
provider". Among its examples of such features: letting users "track personal
goals using activity trackers and in-app journals".

What a person actually does in Rust Strength:

- Logs strength training (exercises, sets, reps, weights) and follows the
  suggested next weight.
- Records runs and other activities, and tracks steps and bodyweight.
- From version 1.2, keeps a food diary against calorie and nutrient goals.
- Sees their own progress: personal records, streaks, a body chart of muscles
  trained, trophies.

Every tab except Friends is about one person's own training. The social layer
is small and private:
- friends only, and only people you accept;
- summaries only;
- no public profiles or posts;
- no content from strangers;
- no comments or direct messages;
- no photos or videos;
- no follower counts;
- no recommendations.

**Conclusion.** Rust Strength's primary purpose, as its users experience it, is
supporting their physical health through training and activity tracking. It
falls within s 5(1)(f), so it is not an age-restricted social media platform,
and its minimum age in Australia stays 13.

## Weak points in this view

- **Our own wording.** The Terms say the app is not a medical device or a
  healthcare service. "Supporting health" is broader than healthcare, and the
  explanatory statement's examples (activity trackers, journals) match what the
  app does. Still, someone could read the exclusion more narrowly.
- **The friends feed is on by default for now.** That makes the social layer
  more prominent than it needs to be. Version 1.2 turns sharing off for new
  accounts and asks once when someone accepts their first friend.
- **Not tested.** eSafety's November 2025 lists don't include any fitness app
  either way.
- **The Friends tab now looks more like a photo-sharing app.** See the
  reassessment below.

## Reassessed November 8, 2026, for the 1.2 Friends redesign

Version 1.2 redraws the Friends tab:
- a row of friends across the top, with a blue ring for who trained today and a
  gold one for a record today;
- large full-width posts with a graphic made from the session;
- double-tapping a post to react;
- a grid of a friend's sessions on their profile, one page of 30 and no more;
- a count of accepted friends on that profile, visible only to those friends;
- a podium on the leaderboard.

Most of this isn't on the "what would change the answer" list below. There are
still no public profiles or posts, comments, direct messages, photos or video,
recommendations or endless feed, and no new kind of data is posted or collected:
every number on a post was already in the session summary.

Three things are close enough to record:
- **The friend count.** It isn't a follower count as the list means it: friending
  takes both people's agreement, nobody can follow anyone, and only accepted
  friends can see it. It is still a visible number of connections, which it wasn't
  before.
- **The order of the row.** It puts people with a ring first and records before
  the rest. That is sorted by what they did today, not by interest or engagement,
  and it only reorders people the viewer already accepted, so it doesn't change
  the recommender answer above. A broad reading of "recommender" is still possible.
- **The grid.** It gathers one person's sessions in one place. A friend could
  already fetch them, but the app now makes it easy to look back through someone's
  training.

The honest weak point is the look. The explanatory statement asks about the
experience of end-users, and a feed designed to be more engaging moves that
experience toward the social side, even though it shares no data it didn't share
before. The primary purpose is still each person's own training, so the conclusion
above stands, but with less margin than it had.

## What would change the answer

Adding any of these would make the social layer a bigger part of the app:
- public profiles or posts;
- comments or direct messages;
- photos or video;
- follower counts;
- recommending people or posts from non-friends;
- an endless feed.

Reassess before shipping any of them.

If the answer ever flips, the minimum age for Australian accounts has to become
16, with reasonable steps to enforce it. Version 1.2 sets the minimum age by
the phone's region, so the code change is adding `AU` to the 16-and-over list.
The "reasonable steps" (age assurance) would be the larger piece of work.

## Sources

- Online Safety Act 2021, ss 63C and 63D:
  https://www.legislation.gov.au/C2021A00076/latest/text
- Online Safety (Age-Restricted Social Media Platforms) Rules 2025, s 5:
  https://www.legislation.gov.au/F2025L00889/asmade/2025-07-30/text/original/epub/OEBPS/document_1/document_1.html
- Amendment Rules 2026, s 4A (in force March 26, 2026):
  https://www.legislation.gov.au/F2026L00370/asmade/text
- Explanatory statement to the 2025 Rules, paragraph 5(1)(f):
  https://www.legislation.gov.au/F2025L00889/asmade/2025-07-30/es/original/epub/OEBPS/document_1/document_1.html
- eSafety, "Which platforms are age-restricted?":
  https://www.esafety.gov.au/about-us/industry-regulation/social-media-age-restrictions/which-platforms-are-age-restricted
