import { LEGAL } from './config';

/**
 * Consumer Health Data Privacy Policy.
 *
 * Washington's My Health My Data Act (RCW 19.373.020) asks for a policy about
 * health data on its own, linked from the website's homepage, the App Store
 * page and the app's settings. This is that policy, kept to health data only.
 * Like the Privacy Policy it is written against what the code does: if the app
 * starts collecting, using or sharing health data in a new way, change this
 * first.
 *
 * URLs are written out because the app's MarkdownView doesn't render links;
 * the website turns them into links.
 */
export const HEALTH_DATA_POLICY = `# Consumer Health Data Privacy Policy

**Last updated: ${LEGAL.lastUpdated}**

This policy covers the health information ${LEGAL.appName} handles: what it is, where it comes from, why we have it, who else receives it, and how to see it, delete it or stop it. It is written for Washington's My Health My Data Act and similar state laws, and it applies to everyone who uses the app. Our Privacy Policy covers everything else: ${LEGAL.privacyPolicyUrl}

${LEGAL.appName} is operated by ${LEGAL.entity} ("we", "us"). We do not sell health data, we do not use it for advertising, and we do not share it with any affiliate.

## 1. The health data we collect, and why

We treat all of the following as consumer health data. We collect each kind only when you use the feature it belongs to, and use it only to run that feature.

| What | What it includes | What we use it for |
|---|---|---|
| Training | Exercises, weights, reps, timed holds, effort ratings (RPE), sets, workouts, presets, planned sessions and rest days | Your history, one-rep max estimates, next-weight suggestions, stats, streaks, trophies and the weekly body chart |
| Activities | Activities you log, how long they lasted and, if you enter them, distance, steps and calories | Your history and stats, and, if you turn it on, adding exercise calories to your food diary |
| Runs | While a run records: the route from your phone's precise location, distance, times, splits, steps, best efforts, estimated calories and your effort rating | Recording and showing your runs, routes and records |
| Bodyweight | Your bodyweight and weigh-ins | Working out the load on bodyweight and assisted exercises, estimating the calories a run burns, and your weight trend |
| Steps | Daily step counts from your phone's motion sensors | Showing today's steps on your phone. Uploaded only if you turn on Share daily steps, for the steps leaderboard and the Steps trophy |
| Food diary (Pro) | What you eat and drink, with amounts, meals, times, calories and nutrients; your own foods, recipes and saved meals; day notes; water; nutrition goals and diary settings | Keeping your diary, its totals, goals and reports |
| Goal calculator | Height, birth year, sex for the equation (optional), activity level, goal weight and weekly change | Estimating a calorie goal, and deciding which goals are offered: weight-loss goals are offered only to adults |
| What the app works out | Estimated one-rep maxes, calories burned, calorie goals, body chart coverage, streaks, consistency, levels and badges | Showing them to you, and to friends as described in section 3 |

We do not collect medical records, diagnoses, medications, reproductive or sexual health information, gender-affirming care information, biometric data or genetic data, and nothing in the app is used to tell whether you are seeking health care. We use your location only while you are recording a run, and we do not use geofencing.

## 2. Where it comes from

- **You,** when you log it or type it in.
- **Your phone's sensors,** only with your permission: Motion & Fitness for steps, and precise location while a run is recording.
- **Food databases,** for the nutrition of the foods you choose to log: the USDA FoodData Central catalog we hold, and Open Food Facts for packaged foods.
- **The app itself,** which works out the estimates and totals above from what you log.

## 3. Who else receives it

| Who | What they receive | When |
|---|---|---|
| Other people who use the app, that you accept as friends | Summaries of your sessions (name, time, length, total weight, sets, reps, exercise names and how many records you set); your totals, streak, consistency, level, trophies and badges; your personal best for each exercise and the dates you trained; for runs, distance, time and pace, and a trimmed outline of the route only if you turn on the map; your daily step totals only if you turn on Share daily steps | Only after you choose a username and accept a friend. You can turn off the feed, step sharing and run maps in the app at any time |
| Supabase, our hosting and database provider, working on our behalf | All of the health data above, stored for us | Whenever you use the app |
| Open Food Facts, a non-profit food database | The barcode or search words for a packaged food, sent from your phone, with your IP address. Not your account or your diary | When you scan, type or search for a packaged food |

Nobody else is shown anything in your food diary, your bodyweight, your goal calculator inputs, the full route of any run or the sets inside a workout. RevenueCat (our subscription provider), Apple and Google receive no health data from us. We may disclose health data if the law requires it, or to prevent or respond to security incidents, fraud or harassment.

To contact them: Supabase at privacy@supabase.com, and Open Food Facts at contact@openfoodfacts.org. Friends can be removed or blocked in the app.

## 4. Your rights, and how to use them

- **See it.** Profile → Privacy & legal → Download my data gives you a copy of everything we hold about you, straight away. This policy lists everyone who receives health data. Ask us and we will confirm what we hold and who has received it.
- **Delete it.** Delete single entries in the app, or delete your account under Profile → Privacy & legal → Delete account, which deletes all of it immediately. Turning off Share daily steps deletes the totals already uploaded. Copies in our provider's backups and logs are overwritten on the provider's own schedule.
- **Stop it.** You can withdraw your consent at any time: stop using a feature and delete what it holds, turn off the feed, step sharing or run maps, remove friends, or delete your account. You can also ask us.
- **Ask us.** Email ${LEGAL.contactEmail} from your account's email address, so we can confirm the request is yours. We will answer within 45 days. If we need longer, up to 45 more days, we will tell you why within the first 45. Requests are free, up to twice a year.
- **Appeal.** If we turn down a request, email ${LEGAL.contactEmail} with "Appeal" in the subject. We will answer in writing within 45 days, with our reasons. If we still turn it down, you can complain to the Washington State Attorney General at https://www.atg.wa.gov/file-complaint

We will not treat you differently for using any of these rights.

## 5. How we protect it

Health data travels over encrypted connections (HTTPS/TLS). The database lets each account read and write only its own records, apart from what you share with friends as described above. Only we and our hosting provider can reach the database, and only to run and support the app.

## 6. Changes and contact

If we change this policy materially, we will update the date above and tell you in the app. We will ask for your separate consent before we collect, use or share health data in a way this policy doesn't describe.

${LEGAL.entity}
${LEGAL.contactEmail}
`;
